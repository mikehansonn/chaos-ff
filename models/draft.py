from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timedelta
from bson import ObjectId
from .base import PyObjectId

class Draft(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    draft_order: List[PyObjectId] = []
    league: PyObjectId
    start_time: datetime = datetime.now() + timedelta(weeks=1)
    next_pick_time: datetime = datetime.now() + timedelta(weeks=1) + timedelta(minutes=1)
    time_per_pick: float = 60.0
    draft_type: str = "snake"
    current_round: int = 1
    current_pick: int = 1
    total_rounds: int = 17
    status: str = "scheduled"
    pick_list: List[PyObjectId] = []

    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}
