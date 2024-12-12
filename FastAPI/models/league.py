from pydantic import BaseModel, Field
from typing import List, Tuple
from datetime import datetime, time, timezone
from bson import ObjectId
from .base import PyObjectId

def calculate_nfl_weeks() -> Tuple[int, int]:
    """Calculate current NFL week and projection week"""
    season_start = datetime(2024, 9, 5, tzinfo=timezone.utc)
    current_time = datetime.now(timezone.utc)
    days_since_start = (current_time - season_start).days
    current_week = (days_since_start // 7) + 1
    
    transition_time = datetime.combine(
        current_time.date(),
        time(7, 0),
        tzinfo=timezone.utc
    )
    
    current_weekday = current_time.weekday()
    if current_weekday == 1 and current_time < transition_time:
        pass
    elif current_weekday >= 1:
        current_week += 1
    
    current_week = max(1, min(18, current_week))
    
    return current_week

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
    week: int = calculate_nfl_weeks()
    schedule: List[List[PyObjectId]] = []
    draft: PyObjectId = None

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}