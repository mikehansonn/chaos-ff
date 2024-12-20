worker: celery -A services.scrape_worker worker --loglevel=info -n worker@%h
beat: celery -A services.scrape_worker beat --loglevel=info -n beat@%h