from fastapi import FastAPI, Request, Response
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import sys
from openai import OpenAI
from contextlib import contextmanager
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import multiprocessing


def log_message(message: str, error: bool = False) -> None:
    """
    Helper function to log messages with consistent formatting and automatic flushing.

    Args:
        message: The message to log
        error: Whether this is an error message (default: False)
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    prefix = "ERROR" if error else "INFO"
    sys.stdout.write(f"[{timestamp}] {prefix}: {message}\n")
    sys.stdout.flush()

load_dotenv()
current_path = os.path.dirname(os.path.abspath(__file__))

def load_fields(file_path):
    fields = []
    with open(file_path, 'r') as file:
        for line in file.readlines():
            line = line.strip()
            if line != "":
                fields.append(line)
    return fields

fields_for_extraction = load_fields(f'{current_path}/fields_for_extraction.txt')

ENVIRONMENT = os.environ.get('ENVIRONMENT')
FRONTEND_URL = os.environ.get('FRONTEND_URL').rstrip('/')

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 72 * 60  # 72 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Database setup - Synchronous SQLAlchemy w/ Supabase
DATABASE_URL = os.environ.get('DATABASE_URL')

# Calculate optimal pool size based on CPU cores, but respect Supabase limits
# Free tier has 8 connection limit, leave some room for other services
cpu_count = multiprocessing.cpu_count()
POOL_SIZE = min(cpu_count, 6)  # Reduced from cpu_count * 2
MAX_OVERFLOW = 2
POOL_TIMEOUT = 30  # 30 seconds
POOL_RECYCLE = 1800  # Recycle connections after 30 minutes

log_message(f"Configuring DB pool with size {POOL_SIZE} and max overflow {MAX_OVERFLOW} based on {cpu_count} CPU cores")

engine = create_engine(
    DATABASE_URL,
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_timeout=POOL_TIMEOUT,
    pool_recycle=POOL_RECYCLE,
    pool_pre_ping=True,  # Enable connection health checks
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# Get database session
@contextmanager
def db_context():
    """Database session context manager for FastAPI dependency injection."""
    log_message("Creating database session")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        log_message("Closed database session")

# Configure OpenAI client
OPEN_AI_ORG = os.environ.get("OPEN_AI_ORG")
OPEN_AI_KEY = os.environ.get("OPEN_AI_KEY")
open_ai_client = OpenAI(
    organization=OPEN_AI_ORG,
    api_key=OPEN_AI_KEY
)

# Define allowed origins (currently only the frontend URL)
allowed_origins = {
    FRONTEND_URL,
}


def create_app():
    """Factory function to create a new FastAPI application instance."""
    # Initialize database tables
    from backend.database import init_db
    init_db()

    app = FastAPI()

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        log_message(f"Validation error details: {exc.errors()}", error=True)
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors()},
            headers={
                "Access-Control-Allow-Origin": request.headers.get("Origin", FRONTEND_URL),
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            }
        )

    @app.middleware("http")
    async def cors_middleware(request: Request, call_next):
        # Get the endpoint function
        route = request.scope.get("route")
        endpoint = route.endpoint if route else None
        no_creds = hasattr(endpoint, "no_credentials_required") if endpoint else False
        origin = request.headers.get("Origin")
        method = request.method
        path = request.url.path

        # Set CORS headers based on whether endpoint requires credentials
        allowed_origin = origin if origin in allowed_origins else FRONTEND_URL
        log_message(f"CORS: Origin: {origin}, Allowed origin: {allowed_origin}")

        headers = {
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
            "Access-Control-Expose-Headers": "*",
        }

        if not no_creds:
            headers["Access-Control-Allow-Credentials"] = "true"

        if request.method == "OPTIONS":
            return Response(headers=headers)

        try:
            response = await call_next(request)

            # Add CORS headers to response
            for key, value in headers.items():
                response.headers[key] = value

            log_message(f"CORS: Response status code: {response.status_code}")
            return response
        except Exception as e:
            log_message(f"CORS: Error in request: {str(e)}", error=True)
            if hasattr(e, "__traceback__"):
                import traceback
                log_message(f"CORS: Traceback: {''.join(traceback.format_tb(e.__traceback__))}", error=True)
            error_response = Response(
                status_code=500 if not isinstance(e, HTTPException) else e.status_code,
                content=str(e),
                headers=headers
            )
            return error_response

    # Import and include routers
    from backend.auth import router as auth_router
    from backend.experience import router as experience_router

    app.include_router(auth_router)
    app.include_router(experience_router)

    return app
