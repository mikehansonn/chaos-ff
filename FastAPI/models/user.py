from pydantic import BaseModel, Field
from .base import PyObjectId
from typing import List
from datetime import datetime
from bson import ObjectId

class User(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    username: str
    email: str
    password_hash: str
    name: str
    join_date: datetime = Field(default_factory=datetime.now)
    teams: List[PyObjectId] = []
    leagues: List[PyObjectId] = []

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}