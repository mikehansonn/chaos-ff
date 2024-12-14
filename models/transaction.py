from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from .base import PyObjectId

class PlayerTransaction(BaseModel):
    player: PyObjectId
    from_team: Optional[PyObjectId]
    to_team: Optional[PyObjectId]

class Transaction(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    league: PyObjectId
    type: str
    date: datetime = Field(default_factory=datetime.now)
    teams_involved: List[PyObjectId]
    players_involved: List[PlayerTransaction]

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}