# In alembic/env.py

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add backend directory to Python path for imports
current_dir = Path(__file__).parent
backend_dir = current_dir.parent
project_root = backend_dir.parent
sys.path.append(str(project_root))

# Import your models and config
from backend import Base, DATABASE_URL
from backend.models import *  # This ensures all models are loaded

# Alembic Config object
config = context.config

# Override alembic.ini path
if not os.path.isfile(config.config_file_name):
    config.config_file_name = os.path.join(str(backend_dir), 'alembic.ini')

# Configure logging
fileConfig(config.config_file_name)

# Set the database URL in the alembic.ini dynamically
config.set_main_option('sqlalchemy.url', DATABASE_URL)

target_metadata = Base.metadata

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True  # Detect column type changes
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Don't maintain a pool during migrations
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # Detect column type changes
            compare_server_default=True  # Detect default value changes
        )

        # Ensure pgvector extension exists before running migrations
        connection.execute('CREATE EXTENSION IF NOT EXISTS vector;')
        
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()