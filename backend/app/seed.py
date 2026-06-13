from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .logging_config import logger
from .models import AccountStatus, Role, User
from .security import hash_password


def seed_admin(db: Session) -> None:
    existing_admin = db.execute(select(User).where(User.role == Role.admin)).scalars().first()
    if existing_admin is not None:
        return

    admin = User(
        name=settings.admin_name,
        email=settings.admin_email,
        hashed_password=hash_password(settings.admin_password),
        role=Role.admin,
        status=AccountStatus.active,
    )
    db.add(admin)
    db.commit()
    logger.info("Seeded default admin account (email=%s)", settings.admin_email)
