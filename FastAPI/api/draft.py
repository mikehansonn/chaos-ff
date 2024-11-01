from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from services.draft_manager import DraftManager
from utils.db import get_database
from pydantic import BaseModel
from models import PyObjectId, Draft
import random
from typing import List
from pymongo.errors import PyMongoError

router = APIRouter()
draft_manager = DraftManager()

class DraftCreate(BaseModel):
    player_list: List[PyObjectId]

class DraftTimeUpdate(BaseModel):
    new_start_time: datetime

class PlayerDraft(BaseModel):
    player_id: PyObjectId

@router.websocket("/ws/{league_id}")
async def websocket_endpoint(websocket: WebSocket, league_id: str):
    await draft_manager.connect_client(websocket, league_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await draft_manager.disconnect_client(websocket, league_id)

@router.post("/leagues/{league_id}/teams/{team_id}/draft")
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

                try:
                    object_league_id = PyObjectId(league_id)
                    league = await db.leagues.find_one({"_id": object_league_id}, session=session)
                    object_draft_id = PyObjectId(league["draft"])
                except Exception:
                    raise HTTPException(status_code=400, detail="Invalid ID format")
                draft = await db.drafts.find_one({"_id": object_draft_id}, session=session)
                current_round = draft["current_round"]
                current_pick = draft["current_pick"]
                picks_per = len(draft["draft_order"])

                if picks_per == current_pick:
                    current_pick = 1
                    current_round += 1
                else:
                    current_pick += 1

                if current_round % 2 == 1:
                    next_drafter = draft["draft_order"][current_pick - 1]
                else:
                    next_drafter =  draft["draft_order"][len(draft["draft_order"]) - current_pick]

                next_pick_time = datetime.now() + timedelta(minutes=1) + timedelta(seconds=2)
                await db.drafts.update_one(
                    {"_id": object_draft_id},
                    {"$set": {"current_round": current_round,
                              "current_pick": current_pick,
                              "next_pick_time":  next_pick_time},
                     "$addToSet": {"pick_list": player.player_id}},
                    session=session
                )

                await draft_manager.broadcast(
                    {
                        "type": "player_drafted",
                        "player_id": str(player.player_id),
                        "next_pick_time": str(next_pick_time),
                        "next_drafter": str(next_drafter)
                    },
                    league_id
                )

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

@router.post("/drafts/{draft_id}/update-time", response_model=Draft)
async def update_draft_time(draft_id: str, update: DraftTimeUpdate):
    db = get_database()

    try:
        object_id = PyObjectId(draft_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID format")
    
    draft = await db.drafts.find_one({"_id": object_id})
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Update the draft start time
    result = await db.drafts.update_one(
        {"_id": object_id},
        {"$set": {"start_time": update.new_start_time}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Draft time update failed")

    updated_draft = await db.drafts.find_one({"_id": object_id})
    return Draft(**updated_draft)


@router.get("/drafts/{draft_id}", response_model=Draft)
async def get_draft(draft_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(draft_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID format")
    
    draft = await db.drafts.find_one({"_id": object_id})
        
    if draft:
        return draft
    raise HTTPException(status_code=404, detail="Draft not found")


@router.post("/drafts/start/{draft_id}", response_model=Draft)
async def start_draft(draft_id: str):
    db = get_database()

    try:
        object_draft_id = PyObjectId(draft_id)
        draft = await db.drafts.find_one({"_id": object_draft_id})
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        object_league_id = PyObjectId(draft["league"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID format")
    
    league = await db.leagues.find_one({"_id": object_league_id})
    league_teams = league["teams"].copy()
    random.shuffle(league_teams)
    new_draft_order = league_teams
    next_pick_time = datetime.now() + timedelta(minutes=5) + timedelta(seconds=draft["time_per_pick"])

    result = await db.drafts.update_one(
        {"_id": object_draft_id},
        {"$set": {"draft_order": new_draft_order,
                  "start_time":  datetime.now() + timedelta(minutes=5),
                  "next_pick_time":  next_pick_time,
                  "status": "started"}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to start the draft")

    await draft_manager.start_draft_monitoring(draft_id, str(draft["league"]))

    await draft_manager.broadcast(
        {
            "type": "draft_started",
            "next_pick_time": str(next_pick_time)
        },
        str(draft["league"])
    )

    updated_draft = await db.drafts.find_one({"_id": object_draft_id})
    
    return Draft(**updated_draft)