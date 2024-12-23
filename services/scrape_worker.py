from celery import Celery
from celery.schedules import crontab
import asyncio
from services.data_scrape import DataScrapeManager
import motor.motor_asyncio
import os
from dotenv import load_dotenv
from functools import wraps

load_dotenv()

# Redis configuration
REDIS_URL = os.getenv('REDISCLOUD_URL', 'redis://localhost:6379/0')

# Create Celery app
app = Celery('fantasy_football_scraper',
             broker=REDIS_URL,
             backend=REDIS_URL)

# Configure Celery
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    broker_connection_retry_on_startup=True
)

def async_task(f):
    """Decorator to handle async tasks properly"""
    @wraps(f)
    def wrapped(*args, **kwargs):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(f(*args, **kwargs))
        finally:
            loop.close()
    return wrapped

@app.task(name='scrape-every-5-minutes')
@async_task
async def run_data_scrape():
    """
    Task to execute the NFL data scrape
    """
    try:
        # Create a fresh manager instance for each task
        scrape_manager = DataScrapeManager()
        
        # Initialize the manager
        await scrape_manager.initialize()
        
        # Run the scrape
        await scrape_manager.run_full_scrape()
        
        return {
            "status": "success",
            "message": "Data scrape completed successfully",
            "result": None
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Data scrape failed: {str(e)}",
            "result": None
        }

# Schedule the task
app.conf.beat_schedule = {
    'scrape-every-5-minutes': {
        'task': 'scrape-every-5-minutes',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
}

if __name__ == '__main__':
    app.start()