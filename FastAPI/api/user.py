from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from models.user import User
from utils.db import get_database
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from models import PyObjectId
from pymongo.errors import PyMongoError
from datetime import timedelta
from utils.auth import (
    authenticate_user, create_access_token, get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, get_password_hash
)

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    name: str

class AddTeamRequest(BaseModel):
    team_id: PyObjectId

class AddLeagueRequest(BaseModel):
    league_id: PyObjectId

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me/", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    db = get_database()

    try:
        object_id = PyObjectId(user_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    user = await db.users.find_one({"_id": object_id})
        
    if user:
        return user
    raise HTTPException(status_code=404, detail="User not found")

@router.get("/users/", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_active_user)):
    try:
        db = get_database()
        users = await db.users.find().to_list(length=None)
        return users
    except PyMongoError as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.post("/users/create/", response_model=User)
async def create_user(user: UserCreate):
    db = get_database()
    
    existing_user = await db.users.find_one({"$or": [{"username": user.username}, {"email": user.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    hashed_password = get_password_hash(user.password)
    
    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        name=user.name
    )
    
    result = await db.users.insert_one(new_user.dict(by_alias=True))
    created_user = await db.users.find_one({"_id": result.inserted_id})
    
    if created_user is None:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    return User(**created_user)

# curl -X DELETE "http://localhost:8000/users/remove/66d609e86bf936def4ed0e9d"
@router.delete("/users/{user_id}", response_model=User)
async def remove_user(user_id: str):
    db = get_database()
    
    try:
        object_id = PyObjectId(user_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    user = await db.users.find_one({"_id": object_id})
    
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.delete_one({"_id": object_id})
    
    return user


@router.post("/users/{user_id}/add_team/", response_model=User)
async def add_team(user_id: str, request: AddTeamRequest):
    db = get_database()
    
    try:
        object_id = PyObjectId(user_id)  # Using PyObjectId for validation
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    user = await db.users.find_one({"_id": object_id})

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.team_id not in user["teams"]:
        user["teams"].append(request.team_id)
        await db.users.update_one({"_id": object_id}, {"$set": {"teams": user["teams"]}})
    
    updated_user = await db.users.find_one({"_id": object_id})
    return User(**updated_user)

@router.post("/users/{user_id}/add_league/", response_model=User)
async def add_league_to_user(user_id: str, request: AddLeagueRequest):
    db = get_database()
    
    try:
        object_id = PyObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    user = await db.users.find_one({"_id": object_id})
    
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if request.league_id not in user["leagues"]:
        user["leagues"].append(request.league_id)
        await db.users.update_one({"_id": object_id}, {"$set": {"leagues": user["leagues"]}})
    
    updated_user = await db.users.find_one({"_id": object_id})
    return User(**updated_user)
