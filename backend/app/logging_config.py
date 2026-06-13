from __future__ import annotations

import logging
from logging.config import dictConfig

from .config import settings


def setup_logging() -> None:
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    log_file = settings.log_dir / "app.log"

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                },
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "formatter": "default",
                    "filename": str(log_file),
                    "maxBytes": 5 * 1024 * 1024,
                    "backupCount": 3,
                },
            },
            "root": {
                "level": settings.log_level,
                "handlers": ["console", "file"],
            },
            "loggers": {
                "uvicorn": {"level": settings.log_level, "handlers": ["console", "file"], "propagate": False},
                "uvicorn.access": {"level": settings.log_level, "handlers": ["console", "file"], "propagate": False},
            },
        }
    )


logger = logging.getLogger("gymtrack")
