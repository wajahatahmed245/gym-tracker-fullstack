"""
Event publisher — publishes exercise events to Redis Streams.

Stream:  exercise.events
Schema version: 1

Event types:
  exercise.workout.logged   — strength workout created
  exercise.workout.updated  — strength workout edited
  exercise.workout.deleted  — strength workout removed
  exercise.cardio.logged    — cardio session created
  exercise.cardio.deleted   — cardio session removed

Each message is a single Redis hash field ``payload`` containing JSON.
The consumer (meal-track) reads via XREADGROUP and acks after processing.

If Redis is unavailable the event is dropped with an error log but the
originating DB write is NOT rolled back — the workout is always saved.
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Any, Dict, Optional

import redis

from .config import settings
from .logging_config import logger

STREAM_NAME = "exercise.events"

_redis_client: Optional[redis.Redis] = None


def _get_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2)
    return _redis_client


def _publish(event_type: str, data: Dict[str, Any]) -> None:
    event = {
        "event_id": str(uuid.uuid4()),
        "schema_version": "1",
        "event_type": event_type,
        "source": "gym-tracker",
        "occurred_at": datetime.utcnow().isoformat() + "Z",
        "data": data,
    }
    try:
        _get_client().xadd(
            STREAM_NAME,
            {"payload": json.dumps(event, default=str)},
            maxlen=10_000,   # keep up to 10k events; older ones are trimmed
            approximate=True,
        )
        logger.info("Event published: %s source_id=%s", event_type, data.get("source_id"))
    except redis.RedisError as exc:
        logger.error(
            "Failed to publish event %s source_id=%s: %s",
            event_type, data.get("source_id"), exc,
        )


# ── Workout (strength) ─────────────────────────────────────────────────────

def publish_workout_logged(
    workout_id: int,
    exerciser_id: int,
    exercise_name: str,
    body_part: str,
    set_count: int,
    workout_date: date,
) -> None:
    _publish("exercise.workout.logged", {
        "source_id": f"gym.workout:{workout_id}",
        "exerciser_user_id": exerciser_id,
        "exercise_type": exercise_name,
        "body_part": body_part,
        # Duration estimate: 1 min active work + 3 min rest per set
        "duration_minutes": max(set_count * 4, 5),
        "calories_burned": None,
        "date": str(workout_date),
        "set_count": set_count,
    })


def publish_workout_updated(
    workout_id: int,
    exerciser_id: int,
    exercise_name: str,
    body_part: str,
    set_count: int,
    workout_date: date,
) -> None:
    _publish("exercise.workout.updated", {
        "source_id": f"gym.workout:{workout_id}",
        "exerciser_user_id": exerciser_id,
        "exercise_type": exercise_name,
        "body_part": body_part,
        "duration_minutes": max(set_count * 4, 5),
        "calories_burned": None,
        "date": str(workout_date),
        "set_count": set_count,
    })


def publish_workout_deleted(workout_id: int, exerciser_id: int) -> None:
    _publish("exercise.workout.deleted", {
        "source_id": f"gym.workout:{workout_id}",
        "exerciser_user_id": exerciser_id,
    })


# ── Cardio session ─────────────────────────────────────────────────────────

def publish_cardio_logged(
    session_id: int,
    exerciser_id: int,
    exercise_name: str,
    duration_minutes: int,
    calories_burned: Optional[int],
    session_date: date,
) -> None:
    _publish("exercise.cardio.logged", {
        "source_id": f"gym.cardio:{session_id}",
        "exerciser_user_id": exerciser_id,
        "exercise_type": exercise_name,
        "duration_minutes": duration_minutes,
        "calories_burned": calories_burned,
        "date": str(session_date),
    })


def publish_cardio_deleted(session_id: int, exerciser_id: int) -> None:
    _publish("exercise.cardio.deleted", {
        "source_id": f"gym.cardio:{session_id}",
        "exerciser_user_id": exerciser_id,
    })
