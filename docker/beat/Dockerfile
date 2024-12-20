# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application code
COPY . .

# Default command (will be overridden by docker-compose)
CMD ["celery", "-A", "././services.scrape_worker", "beat", "--loglevel=info"]`