from typing import List, Optional
from fastapi import APIRouter, HTTPException
from models.team import Team
from utils.db import get_database
from pydantic import BaseModel
from models import PyObjectId, NFLPlayer

router = APIRouter()

class PlayerAdd(BaseModel):
    player_id: PyObjectId

class ChangeName(BaseModel):
    new_name: PyObjectId

class TeamCreate(BaseModel):
    name: str
    owner: PyObjectId
    league: PyObjectId

class PlayerMove(BaseModel):
    uid1: int
    uid2: int

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

@router.post("/teams/{team_id}/name/{new_name}", response_model=Team)
async def change_team_name(team_id: str, new_name: str):
    db = get_database()

    try:
        object_id = PyObjectId(team_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")
    
    result = await db.teams.update_one( {"_id": object_id}, {"$set": {"name": new_name}})

    updated_team = await db.teams.find_one({"_id": object_id})
    return Team(**updated_team)

# curl -X POST "http://localhost:8000/teams/"      -H "Content-Type: application/json"      -d '{ "name": "Touchdown Titans", "owner": "66d68d8501059434755b066b", "league": "66d7ce08e970f0b1a331d4d1" }'
@router.post("/teams/create/", response_model=Team)
async def create_team(team: TeamCreate):
    db = get_database()

    new_team = Team(
        name=team.name,
        owner=team.owner,
        league=team.league
    )

    result = await db.teams.insert_one(new_team.dict(by_alias=True))
    created_team = await db.teams.find_one({"_id": result.inserted_id})

    if created_team is None:
        raise HTTPException(status_code=500, detail="Failed to create Team")
    return Team(**created_team)

@router.get("/teams/{team_id}", response_model=Team)
async def get_team(team_id: str):
    db = get_database()
    
    try:
        object_id = PyObjectId(team_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    team = await db.teams.find_one({"_id": object_id})
        
    if team:
        return team
    else:
        return Team(
            id=PyObjectId(),
            name="BYE",
            owner=PyObjectId(),
            league=PyObjectId(),
            roster=[PyObjectId() for _ in range(17)],
            total_points=0.0,
            wins=0,
            losses=0
        )
    
@router.get("/teams/roster/{team_id}", response_model=List[Optional[NFLPlayer]])
async def get_team_roster(team_id: str):
    db = get_database()
    
    try:
        object_id = PyObjectId(team_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    # Get the team document
    team = await db.teams.find_one({"_id": object_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Filter out None values and convert valid IDs
    valid_ids = []
    id_positions = {}  # Keep track of positions for each ID
    
    for position, player_id in enumerate(team["roster"]):
        if player_id is not None:
            try:
                object_player_id = PyObjectId(player_id)
                valid_ids.append(object_player_id)
                id_positions[str(player_id)] = position
            except Exception:
                pass
    
    # Fetch all valid players in a single query
    players = {}
    if valid_ids:
        cursor = db.nflplayers.find({"_id": {"$in": valid_ids}})
        player_list = await cursor.to_list(length=None)
        players = {str(player["_id"]): player for player in player_list}
    
    # Construct final roster maintaining original positions
    roster = [None] * len(team["roster"])
    for player_id, position in id_positions.items():
        if player_id in players:
            roster[position] = players[player_id]
    
    return roster

@router.delete("/teams/{team_id}", response_model=dict)
async def delete_team(team_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(team_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")
        
    result = await db.teams.delete_one({"_id": team_id})

    if result.deleted_count:
        return {"message": "Team deleted successfully"}
    raise HTTPException(status_code=404, detail="Team not found")

# curl -X POST "http://localhost:8000/teams/66d7dda054dc5c8694c3c66d/add_player"      -H "Content-Type: application/json"      -d '{"player_id": "66d7e3c75abe89749d086c3c"}'
@router.post("/teams/{team_id}/add_player")
async def add_player(team_id: str, player: PlayerAdd):
    db = get_database()

    try:
        object_id = PyObjectId(team_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    team = await db.teams.find_one({"_id": object_id})
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    result = await db.teams.update_one(
        {"_id": object_id},
        {"$addToSet": {"roster": player.player_id}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to add player to team.")

    updated_team = await db.teams.find_one({"_id": object_id})
    return Team(**updated_team)

@router.post("/teams/{team_id}/remove_player/{player_id}")
async def remove_player(team_id: str, player_id: str):
    db = get_database()

    try:
        object_team_id = PyObjectId(team_id)  # Using PyObjectId for validation
        object_player_id = PyObjectId(player_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    team = await db.teams.find_one({"_id": object_team_id})
    if not team:
        raise HTTPException(status_code=404, detail="team not found")

    new_roster = team["roster"].copy()
    index = None
    for i in range(len(new_roster)):
        if new_roster[i] == object_player_id:
            new_roster[i] = PyObjectId()
            index = i
            break

    if index is None:
        raise HTTPException(status_code=404, detail="player not found")

    result = await db.teams.update_one(
        {"_id": object_team_id},
        {"$set": {"roster": new_roster}}
    )

    updated_team = await db.teams.find_one({"_id": object_team_id})
    return Team(**updated_team)

@router.post("/teams/{team_id}/player/move/")
async def move_players(team_id: str, player_move: PlayerMove):
    spots = {
        "QB": [0],
        "RB": [1, 2, 6],
        "WR": [3, 4, 6],
        "TE": [5, 6],
        "FLEX": [6],
        "DEF": [7],
        "K": [8],
        "BENCH": list(range(9, 17))
    }
    db = get_database()

    try:
        object__id = PyObjectId(team_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    team = await db.teams.find_one({"_id" : object__id})
    roster = team["roster"]
    access_roster = team["roster"].copy()
    spot1 = player_move.uid1
    spot2 = player_move.uid2

    try:
        player1_id = PyObjectId(access_roster[player_move.uid1])  # Using PyObjectId for validation
        player2_id = PyObjectId(access_roster[player_move.uid2])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid team ID format")

    player1 = await db.nflplayers.find_one({"_id": player1_id})
    player2 = await db.nflplayers.find_one({"_id": player2_id})

    if player1 is None:
        spots1 = []
    else:
        spots1 = spots.get(player1["position"]) + spots.get("BENCH")

    if player2 is None:
        spots2 = []
    else:
        spots2 = spots.get(player2["position"]) + spots.get("BENCH")

    if spots1 != []:
        if spot2 in spots1:
            if spots2 == []:
                roster[spot1] = PyObjectId()
            roster[spot2] = access_roster[spot1]
        else:
            raise HTTPException(status_code=400, detail="Can't move here") 

    if spots2 != []:
        if spot1 in spots2:
            if spots1 == []:
                roster[spot2] = PyObjectId()
            roster[spot1] = access_roster[spot2]
        else:
            raise HTTPException(status_code=400, detail="Can't move here")
    
    result = await db.teams.update_one(
        {"_id": object__id},
        {"$set": {"roster": roster}}
    )

    updated_team = await db.teams.find_one({"_id": object__id})
    return Team(**updated_team)
