from fastapi import APIRouter, HTTPException
from models.matchup import Matchup
from utils.db import get_database
from pydantic import BaseModel
from models import PyObjectId

router = APIRouter()

class MatchupCreate(BaseModel):
    league_id: PyObjectId
    team1_id: PyObjectId
    team2_id: PyObjectId

@router.post("/matchups/", response_model=Matchup)
async def create_matchups(matchup: MatchupCreate):
    db = get_database()

    new_matchup = Matchup(
        league=matchup.league_id,
        team_a=matchup.team1_id,
        team_b=matchup.team2_id
    )

    result = await db.matchups.insert_one(new_matchup.dict(by_alias=True))
    created_matchup = await db.matchups.find_one({"_id": result.inserted_id})

    if created_matchup is None:
        raise HTTPException(status_code=500, detail="Failed to create Matchup")
    return Matchup(**created_matchup)

@router.get("/matchup/{matchup_id}", response_model=Matchup)
async def get_matchup(matchup_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(matchup_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid matchup ID format")
    
    matchup = await db.matchups.find_one({"_id": object_id})
    if matchup:
        return matchup
    raise HTTPException(status_code=404, detail="matchup not found")

@router.get("/matchups/rosters/{matchup_id}")
async def get_matchup_rosters(matchup_id: str):
    db = get_database()
    
    try:
        object_id = PyObjectId(matchup_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid matchup ID format")

    matchup = await db.matchups.find_one({"_id": object_id})
    if not matchup:
        raise HTTPException(status_code=404, detail="Matchup not found")
    
    valid_ids = []
    id_positions_a = {}  
    id_positions_b = {} 
    
    for position, player_id in enumerate(matchup["team_a_roster"]):
        if player_id is not None:
            try:
                object_player_id = PyObjectId(player_id)
                valid_ids.append(object_player_id)
                id_positions_a[str(player_id)] = position
            except Exception:
                pass
    
    for position, player_id in enumerate(matchup["team_b_roster"]):
        if player_id is not None:
            try:
                object_player_id = PyObjectId(player_id)
                valid_ids.append(object_player_id)
                id_positions_b[str(player_id)] = position
            except Exception:
                pass
    
    players = {}
    if valid_ids:
        cursor = db.nflplayers.find({"_id": {"$in": valid_ids}})
        player_list = await cursor.to_list(length=None)
        
        for player in player_list:
            player_dict = dict(player)
            player_dict["_id"] = str(player_dict["_id"])  
            players[str(player["_id"])] = player_dict
    
    team_a_roster = [None] * len(matchup["team_a_roster"])
    for player_id, position in id_positions_a.items():
        if player_id in players:
            team_a_roster[position] = players[player_id]
    
    team_b_roster = [None] * len(matchup["team_b_roster"])
    for player_id, position in id_positions_b.items():
        if player_id in players:
            team_b_roster[position] = players[player_id]
    
    return {
        "team_a_roster": team_a_roster,
        "team_b_roster": team_b_roster
    }

@router.get("/matchups/activate/{matchup_id}")
async def activate_matchup(matchup_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(matchup_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid matchup ID format")

    matchup = await db.matchups.find_one({"_id": object_id})
    if matchup:
        team_a = await db.teams.find_one({"_id": PyObjectId(matchup["team_a"])})
        if not team_a:
            team_a = {"roster": [PyObjectId() for _ in range(17)]}
        team_b = await db.teams.find_one({"_id": PyObjectId(matchup["team_b"])})
        if not team_b:
            team_b = {"roster": [PyObjectId() for _ in range(17)]}
        await db.matchups.update_one(
            {"_id": PyObjectId(matchup_id)},
            {"$set": {
                "status": "started",
                "team_a_roster": team_a["roster"],
                "team_b_roster": team_b["roster"]
            }}
        )

@router.get("/matchups/complete/{matchup_id}")
async def complete_active_matchups(matchup_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(matchup_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid matchup ID format")
    
    matchup = db.matchups.find_one({"_id" : object_id})

    active_a = matchup['team_a_roster'][:9]
    active_b = matchup['team_b_roster'][:9]
    a_total = 0
    b_total = 0
    week = matchup['week']

    for i in range(len(active_a)):
        playa = await db.nflplayers.find_one({"_id": PyObjectId(active_a[i])})
        if playa:
            a_total += playa['weeks'][week - 1]

        playb = await db.nflplayers.find_one({"_id": PyObjectId(active_b[i])})
        if playb:
            b_total += playb['weeks'][week - 1]
    
    winner = 'tie'
    team_a = await db.teams.find_one({"_id": PyObjectId(matchup['team_a'])})
    team_b = await db.teams.find_one({"_id": PyObjectId(matchup['team_b'])})
    if not team_a or not team_b:
        await db.matchups.update_one(
        {'_id': PyObjectId(matchup["_id"])},
            {"$set": {
                "team_a_score": a_total,
                "team_b_score": b_total,
                "status": "completed"
            }}
        )
        return

    if a_total > b_total:
        winner = str(matchup['team_a'])
        await db.teams.update_one(
            {'_id': PyObjectId(matchup['team_a'])},
            {"$inc": {
                "wins": 1,
                "total_points": a_total
            }}
        )

        await db.teams.update_one(
            {'_id': PyObjectId(matchup['team_b'])},
            {"$inc": {
                "losses": 1,
                "total_points": b_total
            }}
        )
    elif a_total < b_total:
        winner = str(matchup['team_b'])
        await db.teams.update_one(
            {'_id': PyObjectId(matchup['team_a'])},
            {"$inc": {
                "losses": 1,
                "total_points": a_total
            }}
        )

        await db.teams.update_one(
            {'_id': PyObjectId(matchup['team_b'])},
            {"$inc": {
                "wins": 1,
                "total_points": b_total
            }}
        )
    
    await db.matchups.update_one(
        {'_id': PyObjectId(matchup["_id"])},
        {"$set": {
            "team_a_score": a_total,
            "team_b_score": b_total,
            "status": "completed",
            "winner": winner
        }}
    )