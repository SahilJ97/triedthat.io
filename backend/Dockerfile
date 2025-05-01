FROM python:3.9-slim

WORKDIR /app

COPY . ./backend
COPY requirements.txt .
RUN pip install -r requirements.txt

# Make entrypoint script executable
RUN chmod +x /app/backend/docker-entrypoint.sh

# Use our entrypoint script
ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]
