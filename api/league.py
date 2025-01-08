from aiohttp import ClientSession
from fastapi import APIRouter, HTTPException
from models.league import League
from models.team import Team
from utils.db import get_database
from pydantic import BaseModel
from models import PyObjectId, Matchup, Draft
from pymongo.errors import PyMongoError
from bson.errors import InvalidId
from datetime import datetime, time, timezone
from typing import Tuple

router = APIRouter()

class LeagueCreate(BaseModel):
    name: str
    commissioner: PyObjectId
    number_of_players: int

class LeagueJoin(BaseModel):
    user_id: PyObjectId
    league_id: PyObjectId
    team_name: str

class TeamAdd(BaseModel):
    team_id: PyObjectId

class PlayerDraft(BaseModel):
    player_id: PyObjectId

class TeamRules(BaseModel):
    qb: int = 1
    rb: int = 2
    wr: int = 2
    te: int = 1
    flex: int = 1
    defense: int = 1
    kicker: int = 1
    bench: int = 8

POSITION_MAPPING = {
    "QB": [0],
    "RB": [1, 2],
    "WR": [3, 4],
    "TE": [5],
    "FLEX": [6],
    "DEF": [7],
    "K": [8],
    "BENCH": list(range(9, 17))
}

@router.post("/leagues/create/", response_model=League)
async def create_league(league: LeagueCreate):
    db = get_database()
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                try:
                    user_id = PyObjectId(league.commissioner)
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid league ID format")
                
                user = await db.users.find_one({'_id': user_id}, session=session)
                if len(user["leagues"]) >= 10:
                    raise HTTPException(status_code=403, detail="You are in too many leagues")
                
                # Create the new league
                new_league = League(
                    name=league.name,
                    commissioner=league.commissioner,
                    number_of_players=league.number_of_players,
                    teams=[]
                )
                league_result = await db.leagues.insert_one(new_league.dict(by_alias=True), session=session)
                new_league_id = league_result.inserted_id

                # Create a new team for the user
                new_team = Team(
                    name=f"{league.name} Team",
                    owner=league.commissioner,
                    league=new_league_id,
                )
                team_result = await db.teams.insert_one(new_team.dict(by_alias=True), session=session)
                new_team_id = team_result.inserted_id

                # Create Draft
                new_draft = Draft(
                    league=new_league_id
                )
                draft_result = await db.drafts.insert_one(new_draft.dict(by_alias=True), session=session)
                new_draft_id = draft_result.inserted_id

                # Update the league with the new team
                await db.leagues.update_one(
                    {"_id": new_league_id},
                    {"$push": {"teams": new_team_id},
                     "$set":  {"draft": new_draft_id}},
                    session=session
                )

                # Update the user's leagues and teams
                await db.users.update_one(
                    {"_id": league.commissioner},
                    {
                        "$push": {
                            "leagues": new_league_id,
                            "teams": new_team_id
                        }
                    },
                    session=session
                )

                # Fetch the created league to return
                created_league = await db.leagues.find_one({"_id": new_league_id}, session=session)


                if created_league is None:
                    raise HTTPException(status_code=500, detail="Failed to create League")
                
                return League(**created_league)

    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")

@router.post("/leagues/join/", response_model=League)
async def join_league(content: LeagueJoin):
    db = get_database()

    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                try:
                    user_id = PyObjectId(content.user_id)
                except Exception:
                    raise HTTPException(status_code=403, detail="No League with this Invite ID")
                
                user = await db.users.find_one({'_id': user_id}, session=session)
                if len(user["leagues"]) >= 10:
                    raise HTTPException(status_code=403, detail="You are in too many leagues")
                
                # Check if the league exists
                league = await db.leagues.find_one({"_id": content.league_id}, session=session)
                if not league:
                    raise HTTPException(status_code=403, detail="No League with this Invite ID")

                # Check if the user is already in the league
                user = await db.users.find_one({"_id": content.user_id}, session=session)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                if content.league_id in user.get("leagues", []):
                    raise HTTPException(status_code=403, detail="You are already in this league")

                # Check if the league is full
                if len(league.get("teams", [])) >= league.get("number_of_players", 0):
                    raise HTTPException(status_code=403, detail="This league is already full")
                
                # Check if the league has already started
                draft = await db.drafts.find_one({"_id": league["draft"]}, session=session)
                if draft and draft['status'] != 'scheduled':
                    raise HTTPException(status_code=403, detail="This league has already started")          

                # Create a new team for the user
                new_team = Team(
                    name=content.team_name,
                    owner=content.user_id,
                    league=content.league_id,
                )
                team_result = await db.teams.insert_one(new_team.dict(by_alias=True), session=session)
                new_team_id = team_result.inserted_id

                # Update the league with the new team
                await db.leagues.update_one(
                    {"_id": content.league_id},
                    {"$push": {"teams": new_team_id}},
                    session=session
                )

                # Update the user's leagues and teams
                await db.users.update_one(
                    {"_id": content.user_id},
                    {
                        "$push": {
                            "leagues": content.league_id,
                            "teams": new_team_id
                        }
                    },
                    session=session
                )

                updated_league = await create_schedule(str(content.league_id), session=session)

                # Fetch the updated league to return
                updated_league = await db.leagues.find_one({"_id": content.league_id}, session=session)

                if updated_league is None:
                    raise HTTPException(status_code=500, detail="Failed to update League")
                
                return League(**updated_league)
                
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")

def calculate_nfl_weeks() -> Tuple[int, int]:
    season_start = datetime.combine(datetime(2024, 9, 4), time(0, 0), tzinfo=timezone.utc)
    current_time = datetime.now(timezone.utc)
    days_since_start = (current_time - season_start).days
    current_week = (days_since_start // 7) + 1

    current_week = max(1, min(18, current_week))

    return current_week, current_week

async def create_schedule(league_id: str, session: ClientSession = None):
    db = get_database()
    
    try:
        object_id = PyObjectId(league_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid league ID format")
    
    league = await db.leagues.find_one({"_id": object_id}, session=session)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    teams = league['teams']
    if len(teams) % 2 == 1:
        teams.append(PyObjectId())  # Add bye week team if odd number
    num_teams = len(teams)
    
    # Delete existing matchups
    matchups = league['schedule'].copy()
    for week in matchups:
        for matchup_id in week:
            try:
                await db.matchups.delete_one({"_id": PyObjectId(matchup_id)}, session=session)
            except InvalidId:
                print(f"Invalid matchup ID: {matchup_id}")
            except PyMongoError as e:
                print(f"Error deleting matchup {matchup_id}: {str(e)}")
    
    schedule = []
    current_week, _ = calculate_nfl_weeks()
    remaining_weeks = list(range(current_week + 1, 19))  # Weeks 9-18 if starting at week 9
    
    # Calculate how many rounds we need to repeat to fill the remaining weeks
    base_schedule_rounds = num_teams - 1
    num_remaining_weeks = len(remaining_weeks)
    
    # Generate unique matchups for each remaining week
    teams_copy = teams.copy()
    for week_num in remaining_weeks:
        round_matches = []
        
        # Rotate teams for variety in matchups
        teams_copy = [teams_copy[0]] + [teams_copy[-1]] + teams_copy[1:-1]
        
        # Create matchups for this week
        for i in range(num_teams // 2):
            team1 = teams_copy[i]
            team2 = teams_copy[num_teams - i - 1]
            
            new_match = Matchup(
                league=object_id,
                week=week_num,  # Use actual NFL week number
                team_a=team1,
                team_b=team2
            )
            match_id = await db.matchups.insert_one(new_match.dict(by_alias=True), session=session)
            round_matches.append(str(match_id.inserted_id))
        
        schedule.append(round_matches)
    
    # Update the league with the new schedule
    update_result = await db.leagues.update_one(
        {"_id": object_id},
        {"$set": {"schedule": schedule}},
        session=session
    )
    
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update League")
    
    updated_league = await db.leagues.find_one({"_id": object_id}, session=session)
    return League(**updated_league)


@router.get("/leagues/{league_id}", response_model=League)
async def get_league(league_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(league_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid league ID format")
    
    league = await db.leagues.find_one({"_id": object_id})
        
    if league:
        return league
    raise HTTPException(status_code=404, detail="League not found")

@router.delete("/leagues/{league_id}", response_model=dict)
async def delete_league(league_id: str):
    db = get_database()

    result = await db.leagues.delete_one({"_id": league_id})

    if result.deleted_count:
        return {"message": "League deleted successfully"}
    raise HTTPException(status_code=404, detail="League not found")

# curl -X POST "http://localhost:8000/leagues/66d7ce08e970f0b1a331d4d1/add_team"      -H "Content-Type: application/json"      -d '{"team_id": "66d68d8501059434755b066b"}'
@router.post("/leagues/{league_id}/add_team", response_model=League)
async def add_team_to_league(league_id: str, team: TeamAdd):
    db = get_database()

    try:
        object_id = PyObjectId(league_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid league ID format")

    league = await db.leagues.find_one({"_id": object_id})
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    current_teams = league.get("teams", [])
    if len(current_teams) >= league.get("number_of_players", 0):
        raise HTTPException(status_code=400, detail="League has reached maximum number of players")

    if team.team_id in league.get("teams", []):
        raise HTTPException(status_code=400, detail="Team is already in the league")

    result = await db.leagues.update_one(
        {"_id": object_id},
        {"$addToSet": {"teams": team.team_id}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to add team to league")

    updated_league = await db.leagues.find_one({"_id": object_id})
    return League(**updated_league)

@router.post("/leagues/{league_id}/teams/{team_id}/waiver")
async def draft_player(league_id: str, team_id: str, player: PlayerDraft):
    await check_player_availability(league_id, player.player_id)
    
    db = get_database()

    try:
        object_team_id = PyObjectId(team_id)
        object_player_id = PyObjectId(player.player_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                # Fetch team details
                team = await db.teams.find_one({"_id": object_team_id}, session=session)
                if not team:
                    raise HTTPException(status_code=404, detail="Team not found")
                
                # Fetch player details
                player_doc = await db.nflplayers.find_one({"_id": object_player_id}, session=session)
                if not player_doc:
                    raise HTTPException(status_code=404, detail="Player not found")
                
                player_position = player_doc["position"]
                
                # Check roster constraints
                roster = team.get("roster", [None] * 17)
                
                handle_roster = roster.copy()
                # Fetch all player details for the roster
                for i in range(len(handle_roster)):
                    player_return = await db.nflplayers.find_one({"_id": handle_roster[i]}, session=session)
                    if player_return != None:
                        handle_roster[i] = player_return
                    else:
                        handle_roster[i] = None
                
                # Find available slot for the player
                slot_index = None
                if player_position == "QB" and handle_roster[0] is None:
                    slot_index = 0
                elif player_position == "RB" and (handle_roster[1] is None or handle_roster[2] is None):
                    slot_index = 1 if handle_roster[1] is None else 2
                elif player_position == "WR" and (handle_roster[3] is None or handle_roster[4] is None):
                    slot_index = 3 if handle_roster[3] is None else 4
                elif player_position == "TE" and handle_roster[5] is None:
                    slot_index = 5
                elif player_position in ["RB", "WR", "TE"] and handle_roster[6] is None:
                    slot_index = 6  # FLEX position
                elif player_position == "DEF" and handle_roster[7] is None:
                    slot_index = 7
                elif player_position == "K" and handle_roster[8] is None:
                    slot_index = 8
                
                # If no specific slot found, try to add to bench
                if slot_index is None:
                    for i in range(9, 17):
                        if handle_roster[i] is None:
                            slot_index = i
                            break
                
                if slot_index is None:
                    raise HTTPException(status_code=400, detail="Team roster is full")
                
                # Update the roster
                roster[slot_index] = object_player_id

                # Update team in database
                result = await db.teams.update_one(
                    {"_id": object_team_id},
                    {"$set": {"roster": roster}},
                    session=session
                )
                
                if result.modified_count == 0:
                    raise HTTPException(status_code=500, detail="Failed to update team roster")

                return {"message": f"Player successfully drafted to position {slot_index}"}
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")

async def check_player_availability(league_id: str, player_id: str):
    db = get_database()
    
    try:
        league_object_id = PyObjectId(league_id)
        player_object_id = PyObjectId(player_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    league = await db.leagues.find_one({"_id": league_object_id})
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    teams_with_player = await db.teams.count_documents({
        "league": league_object_id,
        "roster": {"$in": [player_object_id]}
    })
    
    if teams_with_player > 0:
        raise HTTPException(status_code=400, detail="Player already drafted or picked up in this league")
    
@router.get("/leagues/{league_id}/players/{player_id}/available")
async def is_player_available(league_id: str, player_id: str):
    db = get_database()
    
    try:
        league_object_id = PyObjectId(league_id)
        player_object_id = PyObjectId(player_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    league = await db.leagues.find_one({"_id": league_object_id})
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    teams_with_player = await db.teams.count_documents({
        "league": league_object_id,
        "roster": {"$in": [player_object_id]}
    })
    
    if teams_with_player > 0:
        return False
    
    return True


@router.post("/leagues/{league_id}/teams/{team_id}/remove")
async def leave_league(league_id: str, team_id: str):
    db = get_database()

    try:
        object_team_id = PyObjectId(team_id)
        object_league_id = PyObjectId(league_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    # remove the league from user's list, remove the team from league's list, clear schedule, delete team
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                team = await db.teams.find_one({"_id" : object_team_id}, session=session) 
                user_id = team["owner"]

                # remove team from league
                league = await db.leagues.find_one({"_id": object_league_id}, session=session)
                teams = league["teams"].copy()
                matchups = league["schedule"].copy()
                index = None

                for week in matchups:
                    for matchup_id in week:
                        try:
                            await db.matchups.delete_one({"_id": PyObjectId(matchup_id)}, session=session)
                        except InvalidId:
                            print(f"Invalid matchup ID: {matchup_id}")
                        except PyMongoError as e:
                            print(f"Error deleting matchup {matchup_id}: {str(e)}")

                for i in range(len(teams)):
                    if teams[i] == object_team_id:
                        teams.pop(i)
                        index = i
                        break
                if index is None:
                    raise HTTPException(status_code=404, detail="team not found")
                
                new_league = await db.leagues.update_one(
                    {"_id": object_league_id},
                    {"$set": {"teams": teams,
                              "schedule": []}}, 
                    session=session
                )
                # remove team from user
                user = await db.users.find_one({"_id": user_id}, session=session)
                user_teams = user["teams"].copy()
                index = None

                for i in range(len(user_teams)):
                    if user_teams[i] == object_team_id:
                        user_teams.pop(i)
                        index = i
                        break
                if index is None:
                    raise HTTPException(status_code=404, detail="team not found")
                
                user_leagues = user["leagues"].copy()
                index = None

                for i in range(len(user_leagues)):
                    if user_leagues[i] == object_league_id:
                        user_leagues.pop(i)
                        index = i
                        break
                if index is None:
                    raise HTTPException(status_code=404, detail="league not found")
                
                new_user = await db.users.update_one(
                    {"_id": user_id},
                    {"$set": {"teams": user_teams,
                              "leagues": user_leagues}},
                    session=session
                )

                remove_team = await db.teams.delete_one({"_id" : object_team_id}, session=session)
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")

@router.post("/leagues/{league_id}/remove")
async def remove_league(league_id: str):
    db = get_database()

    try:
        object_league_id = PyObjectId(league_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    # remove the league from user's list, remove the team from league's list, clear schedule, delete team
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                league = await db.leagues.find_one({"_id": object_league_id}, session=session)

                if not league:
                    raise HTTPException(status_code=404, detail="League not found")
                
                if str(league["commissioner"]) == "66fef1d3baec7927b3f35e08":
                    raise HTTPException(status_code=403, detail="This league cannot be deleted")

                teams = league["teams"].copy()
                matchups = league["schedule"].copy()

                # remove league from users, remove team from users
                for team_id in teams:
                    team = await db.teams.find_one({"_id": PyObjectId(team_id)}, session=session)
                    user = await db.users.find_one({"_id": PyObjectId(team["owner"])}, session=session)
                    user_teams = user["teams"]
                    user_leagues = user["leagues"]
                    user_teams.remove(PyObjectId(team_id))
                    user_leagues.remove(PyObjectId(league_id))

                    new_user = await db.users.update_one(
                    {"_id": PyObjectId(team["owner"])},
                    {"$set": {"teams": user_teams,
                              "leagues": user_leagues}},
                    session=session
                )

                # delete matchups
                for week in matchups:
                    for matchup_id in week:
                        try:
                            await db.matchups.delete_one({"_id": PyObjectId(matchup_id)}, session=session)
                        except InvalidId:
                            print(f"Invalid matchup ID: {matchup_id}")
                        except PyMongoError as e:
                            print(f"Error deleting matchup {matchup_id}: {str(e)}")
                
                # delete teams
                for team_id in teams:
                    try:
                        await db.teams.delete_one({"_id": PyObjectId(team_id)}, session=session)
                    except InvalidId:
                        print(f"Invalid team ID: {team_id}")
                    except PyMongoError as e:
                        print(f"Error deleting team {team_id}: {str(e)}")

                # delete draft
                await db.drafts.delete_one({"_id": league["draft"]}, session=session)

                # delete league
                await db.leagues.delete_one({"_id": object_league_id}, session=session)

    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")