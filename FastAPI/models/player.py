from bson import ObjectId
from .base import PyObjectId
from pydantic import BaseModel, Field
from typing import List, Optional

class NFLPlayerStats(BaseModel):
    passing_yards: int = 0
    passing_touchdowns: int = 0
    rushing_yards: int = 0
    rushing_touchdowns: int = 0
    receptions: int = 0
    receiving_yards: int = 0
    receiving_touchdowns: int = 0

class NFLPlayer(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    position: str
    team: str
    stats: NFLPlayerStats = NFLPlayerStats()
    weeks: List[float] = []
    projected_points: float = 0.0
    total_points: float = 0.0
    opponent: str = ""
    injury_status: Optional[str] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
