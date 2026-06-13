from __future__ import annotations

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import BASE_DIR, settings
from .database import SessionLocal
from .logging_config import logger, setup_logging
from .routers import admin, auth, exerciser, trainer
from .seed import seed_admin

setup_logging()

app = FastAPI(title="GymTrack API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    client_host = request.client.host if request.client else "-"
    logger.info(
        "%s %s -> %s (%.1fms) client=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        client_host,
    )
    return response


@app.on_event("startup")
def on_startup() -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    (BASE_DIR / "data").mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()

    logger.info("GymTrack API startup complete")


app.include_router(auth.router)
app.include_router(exerciser.router)
app.include_router(trainer.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
