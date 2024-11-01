from pydantic import BaseModel, Field
from typing import List, Optional
from bson import ObjectId
from .base import PyObjectId

class TeamRoster(BaseModel):
    player: PyObjectId
    position: str

class Team(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    owner: PyObjectId
    league: PyObjectId
    roster: List[PyObjectId] = Field(default_factory=lambda: [PyObjectId() for _ in range(17)])
    total_points: float = 0.0
    wins: int = 0
    losses: int = 0

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}