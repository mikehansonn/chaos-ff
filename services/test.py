from datetime import datetime, time, timezone
from typing import Tuple


current_time = datetime.now(timezone.utc)
print(current_time)

if current_time.weekday() != 4:
    print(False)
    
activation_time = time(1, 00, tzinfo=timezone.utc)
current_day_activation = datetime.combine(
    current_time.date(),
    activation_time
)

time_difference = abs((current_time - current_day_activation).total_seconds())
print(time_difference <= 1000)