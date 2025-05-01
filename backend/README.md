### Running the dev server from this directory:
```
uvicorn backend:create_app --reload --factory
```

### Using Alembic for database migrations:
```
alembic revision --autogenerate -m "<description>"
alembic upgrade head
```

### Core structure of the `backend/` subproject:
`alembic/` is used to manage database migrations (modifying, adding, and deleting tables)
`__init.py__` defines the FastAPI app and key resources that are shared across modules
`models.py` defines the database schema
