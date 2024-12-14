from datetime import datetime, time, timezone
from typing import Tuple
import asyncio
from utils.db import get_database

class WeekManager:
    def __init__(self):
        self.current_week = 1
        self.week_check_task = None
        self.db = None
    
    async def initialize(self):
        """Initialize the week manager and start background task"""
        self.db = get_database()
        self.current_week = await self._get_current_week_from_db()
        self.week_check_task = asyncio.create_task(self._check_week_transition())
        return self.current_week

    async def _get_current_week_from_db(self) -> int:
        current_week, _ = self.calculate_nfl_weeks()
        return current_week

    def calculate_nfl_weeks(self) -> Tuple[int, int]:
        season_start = datetime.combine(datetime(2024, 9, 4), time(0, 0), tzinfo=timezone.utc)
        current_time = datetime.now(timezone.utc)
        days_since_start = (current_time - season_start).days
        current_week = (days_since_start // 7) + 1

        current_week = max(1, min(18, current_week))

        return current_week, current_week

    async def _update_leagues_week(self, new_week: int):
        """Update all leagues to the new week"""
        result = await self.db.leagues.update_many(
            {},
            {"$set": {"week": new_week}}
        )
        print(f"Updated {result.modified_count} leagues to week {new_week}")

    async def _check_week_transition(self):
        """Background task to check for week transitions"""
        while True:
            try:
                current_week, _ = self.calculate_nfl_weeks()
                print(f"Checking Week: {current_week}")
                # if current_week != self.current_week:
                print(f"Transitioning from week {self.current_week} to {current_week}")
                await self._update_leagues_week(current_week)
                self.current_week = current_week
                
                # Check every hour
                await asyncio.sleep(120)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in week transition check: {e}")
                await asyncio.sleep(1800)  # Still sleep on error to prevent rapid retries

    def cleanup(self):
        """Cancel the background task"""
        if self.week_check_task:
            self.week_check_task.cancel()