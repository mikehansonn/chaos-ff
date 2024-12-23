from celery import Celery
from celery.schedules import crontab
from services.data_scrape import DataScrapeManager
import os
from dotenv import load_dotenv

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

@app.task(name='scrape-every-5-minutes')
def run_data_scrape():
    """
    Task to execute the NFL data scrape
    """
    try:
        # Initialize data scrape manager
        scrape_manager = DataScrapeManager()
        
        # Run scrape
        result = scrape_manager.run_full_scrape()
        
        return {
            "status": "success", 
            "message": "Data scrape completed successfully", 
            "result": result
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": str(e)
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