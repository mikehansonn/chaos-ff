# config.py
import os

# Celery configuration
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# tasks.py
from celery import Celery
from services.data_scrape import DataScrapeManager
import asyncio

# Create Celery app
celery_app = Celery('fantasy_football_tasks', 
                    broker=CELERY_BROKER_URL, 
                    backend=CELERY_RESULT_BACKEND)

# Configure Celery to use JSON serializer
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

@celery_app.task
def periodic_data_scrape():
    """
    Wrapper function to run async data scrape in a synchronous context
    """
    # Create event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Initialize data scrape manager
        scrape_manager = DataScrapeManager()
        
        # Run the full scrape
        loop.run_until_complete(scrape_manager.run_full_scrape())
    except Exception as e:
        # Log any errors
        print(f"Error in periodic data scrape: {e}")
    finally:
        # Close the event loop
        loop.close()

# Celery beat configuration to schedule tasks
celery_app.conf.beat_schedule = {
    'periodic-data-scrape': {
        'task': 'tasks.periodic_data_scrape',
        'schedule': 300.0,  # Every 5 minutes
    },
}