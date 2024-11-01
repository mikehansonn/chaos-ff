from fastapi import APIRouter, HTTPException, Query
from models.player import NFLPlayer
from utils.db import get_database
from pydantic import BaseModel
from models import PyObjectId
from typing import List, Optional
from math import ceil

router = APIRouter()

class PaginatedPlayersResponse(BaseModel):
    players: List[NFLPlayer]
    total: int
    total_pages: int

@router.get("/nfl-players/", response_model=List[NFLPlayer])
async def get_nfl_players(skip: int = 0, limit: int = 100, position: Optional[str] = None, team: Optional[str] = None):
    db = get_database()
    query = {}
    if position:
        query["position"] = position
    if team:
        query["team"] = team
    players = await db.nflplayers.find(query).skip(skip).limit(limit).to_list(limit)
    return players

@router.get("/nfl-players/{player_id}", response_model=NFLPlayer)
async def get_nfl_player(player_id: str):
    db = get_database()
    player = await db.nflplayers.find_one({"_id": PyObjectId(player_id)})
    if player is None:
        return NFLPlayer(
            name="None",
            position="",
            team=""
        )
    return player

@router.put("/nfl-players/{player_id}", response_model=NFLPlayer)
async def update_nfl_player(player_id: str, player: NFLPlayer):
    db = get_database()
    updated_player = await db.nflplayers.find_one_and_update(
        {"_id": PyObjectId(player_id)},
        {"$set": player.dict(exclude={"id"}, exclude_unset=True)},
        return_document=True
    )
    if updated_player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return updated_player


@router.get("/nfl-players-paginated/", response_model=List[NFLPlayer])
async def get_nfl_players_paginated(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    position: Optional[str] = None,
    team: Optional[str] = None,
    name: Optional[str] = None
):
    db = get_database()
    query = {}
    if position:
        query["position"] = position
    if team:
        query["team"] = team
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    
    skip = (page - 1) * limit
    
    total = await db.nflplayers.count_documents(query)/limit
    total = ceil(total)

    # Get paginated players
    players = await db.nflplayers.find(query).skip(skip).limit(limit).to_list(limit)
    players.append({"name" : total, "position": total, "team": total})

    return players