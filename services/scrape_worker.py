from celery import Celery
from celery.schedules import crontab
import asyncio
from services.data_scrape import DataScrapeManager
import motor.motor_asyncio
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

# Redis configuration
redis_url = os.getenv('REDIS_TLS_URL') or os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# If using TLS (Heroku Redis), modify the URL to use rediss:// protocol
if redis_url.startswith('rediss://'):
    parsed_url = urlparse(redis_url)
    REDIS_URL = f"rediss://{parsed_url.netloc}{parsed_url.path}"
else:
    REDIS_URL = redis_url

# Create Celery app
app = Celery('fantasy_football_scraper',
             broker=REDIS_URL,
             backend=REDIS_URL)
app.conf.broker_use_ssl = {
    'ssl_cert_reqs': None
}

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
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
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
        # Initialize data scrape manager
        scrape_manager = DataScrapeManager()
        
        # Run the scrape using our helper function
        run_async_task(scrape_manager.run_full_scrape())
        
        return {"status": "success", "message": "Data scrape completed successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Schedule the task
app.conf.beat_schedule = {
    'scrape-every-5-minutes': {
        'task': 'scrape-every-5-minutes',  # Must match the task name above
        'schedule': 300.0,  # 5 minutes in seconds
    },
}

if __name__ == '__main__':
    app.start()