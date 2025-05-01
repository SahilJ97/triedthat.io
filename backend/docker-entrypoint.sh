#!/bin/bash
set -e

# Run migrations
cd /app/backend
alembic upgrade head
cd /app

# Start the application wth a 30 second worker timeout
exec gunicorn backend:create_app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:5000 --timeout 30 --limit-request-line 8190
