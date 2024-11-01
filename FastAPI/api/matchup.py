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



# refresh matchup - aka update all of the scores from the players
