from pydantic import BaseModel, Field
from bson import ObjectId
from .base import PyObjectId

class Matchup(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    league: PyObjectId
    week: int
    team_a: PyObjectId
    team_b: PyObjectId
    team_a_score: float = 0.0
    team_b_score: float = 0.0
    status: str = "scheduled"
    winner: PyObjectId = None

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}