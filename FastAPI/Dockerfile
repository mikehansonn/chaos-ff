# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt /app/

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user
RUN useradd -m celeryuser

# Copy FastAPI application code
COPY . /app/

# Change ownership of the workdir
RUN chown -R celeryuser:celeryuser /app

# Add the application directory to PYTHONPATH
ENV PYTHONPATH=/app

# Switch to non-root user
USER celeryuser

# Default command (will be overridden by docker-compose)
CMD ["celery", "-A", "services.scrape_worker", "worker", "--loglevel=info"]