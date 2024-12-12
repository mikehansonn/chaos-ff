from datetime import datetime, time, timezone
from typing import Tuple


def calculate_nfl_weeks(current_time) -> Tuple[int, int]:
    season_start = datetime.combine(datetime(2024, 9, 5), time(0, 0), tzinfo=timezone.utc)
    # current_time = datetime.now(timezone.utc)
    days_since_start = (current_time - season_start).days
    print(days_since_start)
    current_week = (days_since_start // 7) + 1
    
    transition_time = datetime.combine(
        current_time.date(),
        time(0, 0),
        tzinfo=timezone.utc
    )
    
    current_weekday = current_time.weekday()
    if current_time > transition_time:
        current_week += 1
    
    projection_week = current_week
    current_week = max(1, min(18, current_week))
    projection_week = max(1, min(18, projection_week))
    
    return current_week, projection_week

def calculate_nfl_weeks() -> Tuple[int, int]:
    season_start = datetime.combine(datetime(2024, 9, 4), time(0, 0), tzinfo=timezone.utc)
    current_time = datetime.now(timezone.utc)
    days_since_start = (current_time - season_start).days
    print(days_since_start)
    current_week = (days_since_start // 7) + 1

    current_week = max(1, min(18, current_week))

    return current_week, current_week

for i in range(1, 31):
    print("November ", i)
    print(calculate_nfl_weeks(datetime.combine(datetime(2024, 11, i), time(23, 59), tzinfo=timezone.utc)))
    print()

for i in range(1, 13):
    print("December ", i)
    print(calculate_nfl_weeks(datetime.combine(datetime(2024, 12, i), time(23, 59), tzinfo=timezone.utc)))
    print()