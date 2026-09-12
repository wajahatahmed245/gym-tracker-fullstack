"""Tests for /api/exerciser/* endpoints."""
import pytest
from tests.conftest import make_trainer, make_exerciser, login, auth
from app.models import AssignedWorkout, BodyPart, CardioExercise


def _seed_assigned_workout(db, trainer, exerciser, exercise="Bench Press", body_part=BodyPart.chest):
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


def _seed_cardio_exercise(db, trainer, name="Running", icon="🏃", tracks_calories=True):
    ce = CardioExercise(
        trainer_id=trainer.id,
        name=name,
        icon=icon,
        tracks_calories=tracks_calories,
    )
    db.add(ce)
    db.commit()
    db.refresh(ce)
    return ce


class TestDashboard:
    def test_dashboard(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/dashboard", headers=auth(token))
        assert res.status_code == 200
        data = res.json()
        assert "workouts_this_week" in data

    def test_dashboard_unauthenticated(self, client):
        assert client.get("/api/exerciser/dashboard").status_code == 401


class TestProfile:
    def test_get_profile(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/profile", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["goal"] == "General Fitness"

    def test_update_profile(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.patch("/api/exerciser/profile", headers=auth(token), json={
            "weight_kg": 80.0,
            "height_cm": 180.0,
            "age": 28,
        })
        assert res.status_code == 200
        assert res.json()["weight_kg"] == 80.0


class TestAssignedWorkouts:
    def test_list_assigned_workouts(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/assigned-workouts", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["exercise"] == "Bench Press"

    def test_log_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token),
            json={"sets": [{"reps": 8, "weight": 80.0}, {"reps": 6, "weight": 82.5}]},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["exercise"] == "Bench Press"
        assert len(data["sets"]) == 2

    def test_log_workout_wrong_exerciser(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser1 = make_exerciser(db_session, trainer=trainer)
        exerciser2 = make_exerciser(db_session, email="ex2@test.com", trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser1)
        token2 = login(client, "ex2@test.com", "ex123", "exerciser")
        res = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token2),
            json={"sets": [{"reps": 5, "weight": 60.0}]},
        )
        assert res.status_code == 404

    def test_log_workout_empty_sets(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token),
            json={"sets": []},
        )
        assert res.status_code == 422

    def test_log_workout_rapid_second_save_rejected(self, client, db_session):
        """Second save within 3 minutes is blocked with 429."""
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        # First save succeeds
        res1 = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token),
            json={"sets": [{"reps": 8, "weight": 80.0}]},
        )
        assert res1.status_code == 201
        # Immediate second save rejected
        res2 = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token),
            json={"sets": [{"reps": 8, "weight": 80.0}]},
        )
        assert res2.status_code == 429

    def test_log_workout_set_timestamps_insufficient_gap_rejected(self, client, db_session):
        """Sets with logged_at timestamps < 180s apart are rejected."""
        from datetime import datetime, timezone
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        t1 = datetime(2026, 1, 1, 12, 1, 0, tzinfo=timezone.utc)  # only 60s gap
        res = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token),
            json={"sets": [
                {"reps": 8, "weight": 80.0, "logged_at": t0.isoformat()},
                {"reps": 6, "weight": 80.0, "logged_at": t1.isoformat()},
            ]},
        )
        assert res.status_code == 400

    def test_log_workout_set_timestamps_sufficient_gap_accepted(self, client, db_session):
        """Sets with logged_at timestamps >= 180s apart are accepted."""
        from datetime import datetime, timezone
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        t1 = datetime(2026, 1, 1, 12, 3, 0, tzinfo=timezone.utc)  # exactly 180s
        res = client.post(
            f"/api/exerciser/assigned-workouts/{aw.id}/log",
            headers=auth(token),
            json={"sets": [
                {"reps": 8, "weight": 80.0, "logged_at": t0.isoformat()},
                {"reps": 6, "weight": 80.0, "logged_at": t1.isoformat()},
            ]},
        )
        assert res.status_code == 201


class TestWorkouts:
    def _log(self, client, token, aw_id, sets=None):
        sets = sets or [{"reps": 8, "weight": 80.0}]
        return client.post(
            f"/api/exerciser/assigned-workouts/{aw_id}/log",
            headers=auth(token),
            json={"sets": sets},
        ).json()

    def test_list_workouts(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        self._log(client, token, aw.id)
        res = client.get("/api/exerciser/workouts", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_update_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        logged = self._log(client, token, aw.id)
        res = client.patch(
            f"/api/exerciser/workouts/{logged['id']}",
            headers=auth(token),
            json={"sets": [{"reps": 10, "weight": 85.0}]},
        )
        assert res.status_code == 200
        assert res.json()["sets"][0]["weight"] == 85.0

    def test_delete_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, exerciser)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        logged = self._log(client, token, aw.id)
        res = client.delete(f"/api/exerciser/workouts/{logged['id']}", headers=auth(token))
        assert res.status_code == 204
        assert client.get("/api/exerciser/workouts", headers=auth(token)).json() == []

    def test_delete_other_users_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        ex1 = make_exerciser(db_session, trainer=trainer)
        ex2 = make_exerciser(db_session, email="ex2@test.com", trainer=trainer)
        aw = _seed_assigned_workout(db_session, trainer, ex1)
        token1 = login(client, "exerciser@test.com", "ex123", "exerciser")
        token2 = login(client, "ex2@test.com", "ex123", "exerciser")
        logged = self._log(client, token1, aw.id)
        res = client.delete(f"/api/exerciser/workouts/{logged['id']}", headers=auth(token2))
        assert res.status_code == 404


class TestTrainerSelection:
    def test_select_trainer(self, client, db_session):
        trainer = make_trainer(db_session)
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.patch("/api/exerciser/trainer", headers=auth(token), json={"trainer_id": trainer.id})
        assert res.status_code == 200

    def test_select_nonexistent_trainer(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.patch("/api/exerciser/trainer", headers=auth(token), json={"trainer_id": 9999})
        assert res.status_code == 404


class TestCardioSessions:
    def test_list_cardio_exercises(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        _seed_cardio_exercise(db_session, trainer)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/exerciser/cardio-exercises", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_log_cardio_session(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        ce = _seed_cardio_exercise(db_session, trainer)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.post("/api/exerciser/cardio-sessions", headers=auth(token), json={
            "cardio_exercise_id": ce.id,
            "duration_minutes": 45,
            "calories_burned": 300,
        })
        assert res.status_code == 201
        data = res.json()
        assert data["duration_minutes"] == 45
        assert data["calories_burned"] == 300
        assert data["exercise_name"] == "Running"

    def test_log_cardio_invalid_duration(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        ce = _seed_cardio_exercise(db_session, trainer)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.post("/api/exerciser/cardio-sessions", headers=auth(token), json={
            "cardio_exercise_id": ce.id,
            "duration_minutes": 0,
        })
        assert res.status_code == 422

    def test_delete_cardio_session(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        ce = _seed_cardio_exercise(db_session, trainer)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        logged = client.post("/api/exerciser/cardio-sessions", headers=auth(token), json={
            "cardio_exercise_id": ce.id,
            "duration_minutes": 30,
        }).json()
        res = client.delete(f"/api/exerciser/cardio-sessions/{logged['id']}", headers=auth(token))
        assert res.status_code == 204
        assert client.get("/api/exerciser/cardio-sessions", headers=auth(token)).json() == []
