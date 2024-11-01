from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
from bson import ObjectId
from .base import PyObjectId

class ScoringRules(BaseModel):
    passing_yards: float = 0.04  # 1 point per 25 yards
    passing_touchdowns: int = 4
    rushing_yards: float = 0.1  # 1 point per 10 yards
    rushing_touchdowns: int = 6
    receptions: float = 0.5  # 0.5 points per reception (PPR)
    receiving_yards: float = 0.1
    receiving_touchdowns: int = 6

class League(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    commissioner: PyObjectId
    number_of_players: int
    teams: List[PyObjectId] = []
    scoring_rules: ScoringRules = ScoringRules()
    season_start: datetime = datetime.now()
    season_end: datetime = datetime.now()
    draft_date: datetime = datetime.now()
    draft_type: str = "snake"
    transactions: List[PyObjectId] = []
    week: int = 1
    schedule: List[List[PyObjectId]] = []
    draft: PyObjectId = None

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}