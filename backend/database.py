"""Database initialization and management module."""
from alembic.config import Config
from alembic import command
from pathlib import Path
from backend import log_message


def init_db():
    """Initialize and update the database according to the models."""
    log_message("Running database migrations...")

    # Load Alembic configuration with absolute path
    current_dir = Path(__file__).parent
    alembic_cfg = Config(str(current_dir / "alembic.ini"))

    # Set the script_location to the absolute path of the alembic directory
    alembic_cfg.set_main_option('script_location', str(current_dir / "alembic"))

    try:
        # Run the migration
        command.upgrade(alembic_cfg, "head")
        log_message("Database migrations completed successfully!")
    except Exception as e:
        log_message(f"Migration failed: {str(e)}", error=True)
        raise