from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from utils.db import ping_database, close_mongo_connection
from api import league, user, team, player, matchup, draft
from utils.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND
from services.draft_manager import DraftManager
from services.week_manager import WeekManager
from services.matchup_manager import MatchupManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ping_database()
    
    # Initialize other managers
    draft_manager = DraftManager()
    week_manager = WeekManager()
    matchup_manager = MatchupManager()
    
    # Initialize managers
    restored_drafts = await draft_manager.initialize_from_database()
    print(f"Restored {restored_drafts} drafts")
    await week_manager.initialize()
    await matchup_manager.initialize() 
    
    yield
    
    for task in draft_manager.active_drafts.values():
        task.cancel()
    week_manager.cleanup()
    matchup_manager.cleanup()
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)

# Add Celery monitoring endpoint (optional)
@app.get("/celery-status")
async def celery_status():
    """
    Optional endpoint to check Celery task status
    """
    try:
        # You might want to add more sophisticated status checking
        return {
            "broker": CELERY_BROKER_URL,
            "backend": CELERY_RESULT_BACKEND,
            "status": "running"
        }
    except Exception as e:
        return {"error": str(e)}

# Configure CORS
origins = [
    "http://localhost:3000"  # Assuming your React app runs on port 3000
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(league.router, tags=["leagues"])
app.include_router(user.router, tags=["users"])
app.include_router(team.router, tags=["teams"])
app.include_router(player.router, tags=["nfl-players"])
app.include_router(matchup.router, tags=["matchups"])
app.include_router(draft.router, tags=["drafts"])

@app.get("/")
async def root():
    return {"message": ""}