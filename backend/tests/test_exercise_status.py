"""Tests for GET /api/exerciser/exercise-status endpoint."""
from datetime import date, timedelta

import pytest
from tests.conftest import make_trainer, make_exerciser, login, auth
from app.models import AssignedWorkout, BodyPart, Workout, WorkoutSet


def _assign(db, trainer, exerciser, body_part, exercise):
    aw = AssignedWorkout(
        exerciser_id=exerciser.id,
        trainer_id=trainer.id,
        body_part=body_part,
        exercise=exercise,
        active=True,
    )
    db.add(aw)
    db.commit()
    db.refresh(aw)
    return aw


def _log_workout(db, exerciser, aw, workout_date):
    w = Workout(exerciser_id=exerciser.id, assigned_workout_id=aw.id, date=workout_date)
    w.sets.append(WorkoutSet(set_number=1, reps=10, weight=50.0))
    db.add(w)
    db.commit()
    return w


class TestExerciseStatus:
    def test_empty_when_no_assignments(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        assert res.json() == []

    def test_never_status_for_unworked_body_part(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        _assign(db_session, trainer, exerciser, BodyPart.chest, "Bench Press")
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        item = items[0]
        assert item["body_part"] == "Chest"
        assert item["status"] == "never"
        assert item["last_performed_date"] is None
        assert item["days_since_last"] is None

    def test_up_to_date_status(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _assign(db_session, trainer, exerciser, BodyPart.legs, "Squat")
        _log_workout(db_session, exerciser, aw, date.today() - timedelta(days=2))
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["status"] == "up_to_date"
        assert items[0]["days_since_last"] == 2

    def test_due_soon_status(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _assign(db_session, trainer, exerciser, BodyPart.back, "Deadlift")
        _log_workout(db_session, exerciser, aw, date.today() - timedelta(days=6))
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["status"] == "due_soon"
        assert items[0]["days_since_last"] == 6

    def test_overdue_status(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _assign(db_session, trainer, exerciser, BodyPart.arms, "Curl")
        _log_workout(db_session, exerciser, aw, date.today() - timedelta(days=14))
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["status"] == "overdue"
        assert items[0]["days_since_last"] == 14

    def test_groups_by_body_part_not_exercise(self, client, db_session):
        """Two chest exercises should produce one Chest entry, not two."""
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        _assign(db_session, trainer, exerciser, BodyPart.chest, "Bench Press")
        _assign(db_session, trainer, exerciser, BodyPart.chest, "Incline Press")
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["body_part"] == "Chest"

    def test_picks_most_recent_workout_across_exercises(self, client, db_session):
        """Most recent workout date across multiple exercises in the same body part is used."""
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw1 = _assign(db_session, trainer, exerciser, BodyPart.chest, "Bench Press")
        aw2 = _assign(db_session, trainer, exerciser, BodyPart.chest, "Fly")
        _log_workout(db_session, exerciser, aw1, date.today() - timedelta(days=10))
        _log_workout(db_session, exerciser, aw2, date.today() - timedelta(days=3))
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["status"] == "up_to_date"
        assert items[0]["days_since_last"] == 3

    def test_multiple_body_parts_returned(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        _assign(db_session, trainer, exerciser, BodyPart.chest, "Bench Press")
        _assign(db_session, trainer, exerciser, BodyPart.legs, "Squat")
        _assign(db_session, trainer, exerciser, BodyPart.back, "Deadlift")
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        body_parts = [i["body_part"] for i in res.json()]
        assert set(body_parts) == {"Chest", "Legs", "Back"}

    def test_unauthenticated_returns_401(self, client):
        res = client.get("/api/exerciser/exercise-status")
        assert res.status_code == 401

    def test_inactive_assignments_excluded(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = AssignedWorkout(
            exerciser_id=exerciser.id,
            trainer_id=trainer.id,
            body_part=BodyPart.shoulders,
            exercise="Press",
            active=False,
        )
        db_session.add(aw)
        db_session.commit()
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/exercise-status", headers=auth(token))
        assert res.status_code == 200
        assert res.json() == []
