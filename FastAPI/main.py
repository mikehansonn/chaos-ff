# run 
# uvicorn main:app --reload

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from utils.db import ping_database, close_mongo_connection
from api import league, user, team, player, matchup, draft

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ping_database()
    yield
    await close_mongo_connection()

app = FastAPI(lifespan=lifespan)

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