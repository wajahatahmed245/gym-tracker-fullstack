"""
Shared fixtures for all tests.

Uses an in-memory SQLite database so tests are fully isolated from the
production DB and from each other (each test gets a fresh DB via
function-scoped fixtures).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import AccountStatus, ApprovalStatus, Role, User, TrainerProfile, ExerciserProfile
from app.security import hash_password

TEST_DATABASE_URL = "sqlite://"  # in-memory, discarded after each test


@pytest.fixture()
def db_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def client(db_session):
    """TestClient wired to the test DB."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── Seed helpers ──────────────────────────────────────────────────────────────

def make_admin(db):
    user = User(
        name="Admin",
        email="admin@test.com",
        hashed_password=hash_password("admin123"),
        role=Role.admin,
        status=AccountStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_trainer(db, email="trainer@test.com", password="trainer123", approved=True):
    user = User(
        name="Trainer One",
        email=email,
        hashed_password=hash_password(password),
        role=Role.trainer,
        status=AccountStatus.active,
    )
    db.add(user)
    db.flush()
    profile = TrainerProfile(
        user_id=user.id,
        specialty="Bodybuilding",
        experience_years=3,
        approval_status=ApprovalStatus.approved if approved else ApprovalStatus.pending,
        phone="+1234567890",
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user


def make_exerciser(db, email="exerciser@test.com", password="ex123", trainer=None, weight_kg=75.0):
    user = User(
        name="Exerciser One",
        email=email,
        hashed_password=hash_password(password),
        role=Role.exerciser,
        status=AccountStatus.active,
    )
    db.add(user)
    db.flush()
    profile = ExerciserProfile(
        user_id=user.id,
        goal="General Fitness",
        trainer_id=trainer.id if trainer else None,
        weight_kg=weight_kg,
        height_cm=175.0,
        age=25,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user


def login(client, email, password, role):
    res = client.post("/api/auth/login", json={"email": email, "password": password, "role": role})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}
