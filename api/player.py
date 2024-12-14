from fastapi import APIRouter, HTTPException, Query
from models.player import NFLPlayer
from utils.db import get_database
from pydantic import BaseModel
from models import PyObjectId
from typing import List, Optional, Dict, Any
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


@router.get("/nfl-players-paginated/{league_id}", response_model=Dict[str, Any])
async def get_nfl_players_paginated(
    league_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    position: Optional[str] = None,
    team: Optional[str] = None,
    name: Optional[str] = None,
    available_in_league: Optional[str] = None
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

    sort_dict = [("projected_points", -1)]

    try:
        object_league_id = PyObjectId(league_id)
    except Exception:
            raise HTTPException(status_code=400, detail="Invalid ID format")
    
    players_in_league_rosters = []
    if available_in_league:
        try:
            object_league_id = PyObjectId(available_in_league)
            players_in_league_rosters = await db.teams.distinct(
                "roster", 
                {"league": object_league_id}
            )
            query["_id"] = {"$nin": players_in_league_rosters}
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid league ID")
    
    players = await db.nflplayers.find(query).sort(sort_dict).skip(skip).limit(limit).to_list(limit)
    
    if not available_in_league:
        all_players_in_rosters = await db.teams.distinct(
            "roster",
            {"league": object_league_id}
        )
        
        enriched_players = []
        for player in players:
            player_dict = {**player, '_id': str(player['_id'])}
            player_dict['taken'] = player['_id'] in all_players_in_rosters
            enriched_players.append(player_dict)
        players = enriched_players
    else:
        players_taken_in_league = set(await db.teams.distinct(
            "roster", 
            {"league": object_league_id}
        ))
        enriched_players = []
        for player in players:
            player_dict = {**player, '_id': str(player['_id'])}
            
            is_taken = player['_id'] in players_taken_in_league
            
            player_dict['taken'] = is_taken
            enriched_players.append(player_dict)
        players = enriched_players

    total_players = await db.nflplayers.count_documents(query)
    total_pages = ceil(total_players / limit)

    return {
        "players": players,
        "page": page,
        "total_pages": total_pages,
        "total_players": total_players
    }

class PlayerAvailabilityService:
    @staticmethod
    async def is_player_available(league_id: str, player_id: str) -> bool:
        """
        Check if a player is available in a specific league
        """
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
            "roster": player_object_id
        })
        
        return teams_with_player == 0

    @staticmethod
    async def get_available_players(
        league_id: str, 
        position: Optional[str] = None,
        limit: int = 20,
        page: int = 1
    ) -> List[Dict]:
        """
        Get available players in a specific league
        """
        db = get_database()
        
        try:
            league_object_id = PyObjectId(league_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid league ID")

        # Find players already in league rosters
        players_in_league_rosters = await db.teams.distinct(
            "roster", 
            {"league": league_object_id}
        )
        
        # Build query for available players
        query = {
            "_id": {"$nin": players_in_league_rosters}
        }
        
        # Optional position filter
        if position:
            query["position"] = position
        
        # Pagination
        skip = (page - 1) * limit
        
        # Fetch available players
        available_players = await db.nflplayers.find(query).skip(skip).limit(limit).to_list(limit)
        
        return available_players

# Endpoint using the service
@router.get("/leagues/{league_id}/players/available")
async def get_available_league_players(
    league_id: str, 
    position: Optional[str] = None,
    limit: int = 20,
    page: int = 1
):
    return await PlayerAvailabilityService.get_available_players(
        league_id, position, limit, page
    )

# Individual player availability endpoint
@router.get("/leagues/{league_id}/players/{player_id}/available")
async def check_player_availability(league_id: str, player_id: str):
    return await PlayerAvailabilityService.is_player_available(league_id, player_id)