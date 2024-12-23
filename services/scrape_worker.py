from celery import Celery
from celery.schedules import crontab
import asyncio
from services.data_scrape import DataScrapeManager
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Redis configuration
REDIS_URL = os.getenv('REDISCLOUD_URL', 'redis://localhost:6379/0')

# Create Celery app
app = Celery('fantasy_football_scraper',
             broker=REDIS_URL,
             backend=REDIS_URL)
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configure Celery
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    broker_connection_retry_on_startup=True
)

def run_async_task(coro):
    """Helper function to run async code in a new event loop"""
    try:
        # Get the current event loop or create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(coro)
    except Exception as e:
        raise e

@app.task(name='scrape-every-5-minutes')
def run_data_scrape():
    """
    Task to execute the NFL data scrape
    """
    try:
        # Create a new event loop for this task
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Create a fresh manager instance for each task
        scrape_manager = DataScrapeManager()
            
        # Run initialization and scrape
        result = loop.run_until_complete(scrape_manager.run_full_scrape())
            
        return {"status": "success", "message": "Data scrape completed successfully", "result": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        loop.close()

# Schedule the task
app.conf.beat_schedule = {
    'scrape-every-5-minutes': {
        'task': 'scrape-every-5-minutes',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
}

if __name__ == '__main__':
    app.start()