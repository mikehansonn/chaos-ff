from fastapi import WebSocket
from datetime import datetime, timedelta
import asyncio
from typing import Dict, List
from models.base import PyObjectId
from utils.db import get_database
from pymongo.errors import PyMongoError

class DraftManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.active_drafts = {}
            cls._instance.waiting_drafts = {}
            cls._instance.connections = {}
        return cls._instance

    def __init__(self):
        # Initialize only if it hasn't been initialized
        if not hasattr(self, 'initialized'):
            self.active_drafts: Dict[str, asyncio.Task] = {}
            self.waiting_drafts: Dict[str, asyncio.Task] = {}
            self.connections: Dict[str, List[WebSocket]] = {}
            self.initialized = True
    
    async def initialize_from_database(self):
        """Restore active and waiting drafts from database on server startup"""
        db = get_database()
        try:
            # Find all drafts that are currently in progress or waiting
            drafts = await db.drafts.find({"status": {"$in": ["started", "waiting"]}}).to_list(None)
            
            for draft in drafts:
                draft_id = str(draft["_id"])
                league_id = str(draft["league"])
                
                if draft["status"] == "waiting":
                    await self.start_waiting_monitoring(draft_id, league_id)
                elif draft["status"] == "started":
                    # Only start monitoring if the draft hasn't completed
                    total_picks = draft["total_rounds"] * len(draft["draft_order"])
                    picks_made = len(draft.get("pick_list", []))
                    
                    if picks_made < total_picks:
                        await self.start_draft_monitoring(draft_id, league_id)
                    else:
                        # Mark draft as completed if all picks are made
                        await db.drafts.update_one(
                            {"_id": draft["_id"]},
                            {"$set": {"status": "completed"}}
                        )
            
            return len(drafts)
        except PyMongoError as e:
            print(f"Error restoring drafts from database: {str(e)}")
            return 0

    async def start_waiting_monitoring(self, draft_id: str, league_id: str):
        """Start monitoring a waiting draft for start time"""
        if draft_id in self.waiting_drafts:
            return

        self.waiting_drafts[draft_id] = asyncio.create_task(
            self._monitor_waiting_draft(draft_id, league_id)
        )

    async def stop_waiting_monitoring(self, draft_id: str):
        """Stop monitoring a waiting draft"""
        if draft_id in self.waiting_drafts:
            self.waiting_drafts[draft_id].cancel()
            del self.waiting_drafts[draft_id]

    async def _monitor_waiting_draft(self, draft_id: str, league_id: str):
        """Monitor waiting draft and start it when start time is reached"""
        db = get_database()
        
        try:
            while True:
                draft = await db.drafts.find_one({"_id": PyObjectId(draft_id)})
                if not draft or draft["status"] != "waiting":
                    break

                current_time = datetime.now()
                start_time = draft["start_time"]

                if current_time >= start_time:
                    # Start the draft
                    next_pick_time = current_time + timedelta(seconds=draft["time_per_pick"])
                    
                    await db.drafts.update_one(
                        {"_id": PyObjectId(draft_id)},
                        {"$set": {
                            "status": "started",
                            "current_pick": 1,
                            "next_pick_time": next_pick_time
                        }}
                    )

                    await self.broadcast(
                        {
                            "type": "draft_started",
                            "next_pick_time": str(next_pick_time),
                            "next_drafter": str(draft["draft_order"][0])
                        },
                        league_id
                    )

                    # Start the regular draft monitoring
                    await self.start_draft_monitoring(draft_id, league_id)
                    break

                await asyncio.sleep(1)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error monitoring waiting draft {draft_id}: {str(e)}")
        finally:
            await self.stop_waiting_monitoring(draft_id)

    async def start_draft_monitoring(self, draft_id: str, league_id: str):
        """Start monitoring a draft for time-based actions"""
        if draft_id in self.active_drafts:
            return

        self.active_drafts[draft_id] = asyncio.create_task(
            self._monitor_draft(draft_id, league_id)
        )

        db = get_database()
        draft = await db.drafts.find_one({"_id": PyObjectId(draft_id)})
        if draft and not draft.get("next_pick_time"):
            next_pick_time = datetime.now() + timedelta(seconds=draft["time_per_pick"])
            await db.drafts.update_one(
                {"_id": PyObjectId(draft_id)},
                {"$set": {"next_pick_time": next_pick_time}}
            )

    async def stop_draft_monitoring(self, draft_id: str):
        """Stop monitoring a draft"""
        # Remove the database update since it's now handled in the transaction
        if draft_id in self.active_drafts:
            self.active_drafts[draft_id].cancel()
            del self.active_drafts[draft_id]

    async def _monitor_draft(self, draft_id: str, league_id: str):
        """Monitor draft and handle pick timeouts"""
        db = get_database()
        
        try:
            while True:
                draft = await db.drafts.find_one({"_id": PyObjectId(draft_id)})
                if not draft or draft["status"] != "started":
                    break
            
                current_time = datetime.now()
                next_pick_time = draft["next_pick_time"]

                if current_time > next_pick_time:
                    await self._handle_timeout(draft_id, league_id)
                
                await asyncio.sleep(1)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error monitoring draft {draft_id}: {str(e)}")

    async def _handle_timeout(self, draft_id: str, league_id: str):
        """Handle pick timeout by auto-skipping the current player's turn"""
        db = get_database()
        
        try:
            async with await db.client.start_session() as session:
                async with session.start_transaction():
                    draft = await db.drafts.find_one({"_id": PyObjectId(draft_id)}, session=session)
                    if not draft:
                        return

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
                        next_drafter = draft["draft_order"][len(draft["draft_order"]) - current_pick]

                    next_pick_time = datetime.now() + timedelta(seconds=draft["time_per_pick"] + 2)
                    if current_round > draft["total_rounds"]:
                        await db.drafts.update_one(
                            {"_id": PyObjectId(draft_id)},
                            {"$set": {
                                "current_round": current_round,
                                "current_pick": current_pick,
                                "next_pick_time": next_pick_time,
                                "status": "completed"  # Set status in same transaction
                            },
                            "$addToSet": {"pick_list": PyObjectId()}},
                            session=session
                        )

                        # Broadcast after transaction completes
                        await self.broadcast(
                            {
                                "type": "draft_ended",
                                "next_drafter": ""
                            },
                            str(league_id)
                        )

                        if draft_id in self.active_drafts:
                            self.active_drafts[draft_id].cancel()
                            del self.active_drafts[draft_id]
                            
                        return {"message": f"Player successfully drafted"}

                    await db.drafts.update_one(
                        {"_id": PyObjectId(draft_id)},
                        {
                            "$set": {
                                "current_round": current_round,
                                "current_pick": current_pick,
                                "next_pick_time": next_pick_time
                            },
                            "$push": {"pick_list": PyObjectId()}
                        },
                        session=session
                    )

                    await self.broadcast(
                        {
                            "type": "player_drafted",
                            "player_id": str(PyObjectId()),
                            "next_pick_time": str(next_pick_time),
                            "next_drafter": str(next_drafter)
                        },
                        league_id
                    )

        except PyMongoError as e:
            print(f"Database error handling timeout: {str(e)}")

    async def connect_client(self, websocket: WebSocket, league_id: str):
        """Register a new client connection"""
        await websocket.accept()
        if league_id not in self.connections:
            self.connections[league_id] = []
        self.connections[league_id].append(websocket)

    async def disconnect_client(self, websocket: WebSocket, league_id: str):
        """Remove a client connection"""
        if league_id in self.connections:
            self.connections[league_id].remove(websocket)

    async def broadcast(self, message: dict, league_id: str):
        """Broadcast message to all connected clients in a league"""
        if league_id not in self.connections:
            return
            
        disconnected = []
        for connection in self.connections[league_id]:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
                
        for connection in disconnected:
            await self.disconnect_client(connection, league_id)