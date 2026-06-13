# gym-tracker-fullstack

A full-stack gym tracking app for exercisers, trainers, and admins.

- **Frontend**: React (`gym-tracker/`)
- **Backend**: FastAPI + SQLAlchemy + Alembic + SQLite (`backend/`)

## Running locally

```bash
# Backend
cd backend && source ../venv/bin/activate
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd gym-tracker && npm start
```

Copy `backend/.env.example` to `backend/.env` and adjust values (especially `SECRET_KEY` and `ADMIN_PASSWORD`) before running.

## Running with Docker Compose

```bash
docker compose up -d --build
```

Builds and runs both the backend (port 8000) and frontend (port 80), with Alembic migrations applied automatically on startup.
