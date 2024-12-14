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

    # Get the matchup document
    matchup = await db.matchups.find_one({"_id": object_id})
    if not matchup:
        raise HTTPException(status_code=404, detail="Matchup not found")
    
    # Process both rosters together
    valid_ids = []
    id_positions_a = {}  # Positions for team A
    id_positions_b = {}  # Positions for team B
    
    # Process team A roster
    for position, player_id in enumerate(matchup["team_a_roster"]):
        if player_id is not None:
            try:
                object_player_id = PyObjectId(player_id)
                valid_ids.append(object_player_id)
                id_positions_a[str(player_id)] = position
            except Exception:
                pass
    
    # Process team B roster
    for position, player_id in enumerate(matchup["team_b_roster"]):
        if player_id is not None:
            try:
                object_player_id = PyObjectId(player_id)
                valid_ids.append(object_player_id)
                id_positions_b[str(player_id)] = position
            except Exception:
                pass
    
    # Fetch all valid players in a single query
    players = {}
    if valid_ids:
        cursor = db.nflplayers.find({"_id": {"$in": valid_ids}})
        player_list = await cursor.to_list(length=None)
        
        # Convert player documents to dictionaries and handle ObjectId serialization
        for player in player_list:
            player_dict = dict(player)
            player_dict["_id"] = str(player_dict["_id"])  # Convert ObjectId to string
            players[str(player["_id"])] = player_dict
    
    # Construct final rosters maintaining original positions
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
