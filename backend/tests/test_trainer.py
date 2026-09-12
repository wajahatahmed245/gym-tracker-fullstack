"""Tests for /api/trainer/* endpoints."""
import pytest
from tests.conftest import make_trainer, make_exerciser, login, auth
from app.models import AssignedWorkout, BodyPart, CardioExercise


def _assign(db, trainer, exerciser, exercise="Squat", body_part=BodyPart.legs):
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


class TestClients:
    def test_list_clients(self, client, db_session):
        trainer = make_trainer(db_session)
        make_exerciser(db_session, trainer=trainer)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.get("/api/trainer/clients", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_list_clients_only_own(self, client, db_session):
        trainer1 = make_trainer(db_session, email="t1@test.com")
        trainer2 = make_trainer(db_session, email="t2@test.com")
        make_exerciser(db_session, trainer=trainer1)
        make_exerciser(db_session, email="ex2@test.com", trainer=trainer2)
        token = login(client, "t1@test.com", "trainer123", "trainer")
        res = client.get("/api/trainer/clients", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_client_detail(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.get(f"/api/trainer/clients/{exerciser.id}", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["name"] == "Exerciser One"

    def test_client_detail_not_own(self, client, db_session):
        trainer1 = make_trainer(db_session, email="t1@test.com")
        trainer2 = make_trainer(db_session, email="t2@test.com")
        exerciser = make_exerciser(db_session, trainer=trainer2)
        token = login(client, "t1@test.com", "trainer123", "trainer")
        res = client.get(f"/api/trainer/clients/{exerciser.id}", headers=auth(token))
        assert res.status_code == 404

    def test_unapproved_trainer_blocked(self, client, db_session):
        make_trainer(db_session, email="pending@test.com", approved=False)
        token = login(client, "pending@test.com", "trainer123", "trainer")
        res = client.get("/api/trainer/clients", headers=auth(token))
        assert res.status_code == 403


class TestAssignWorkout:
    def test_assign_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.post(
            f"/api/trainer/clients/{exerciser.id}/assign-workout",
            headers=auth(token),
            json={"body_part": "Chest", "exercise": "bench press"},
        )
        assert res.status_code == 201
        assert res.json()["exercise"] == "Bench Press"  # title-cased

    def test_assign_workout_title_case(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.post(
            f"/api/trainer/clients/{exerciser.id}/assign-workout",
            headers=auth(token),
            json={"body_part": "Arms", "exercise": "bicep curl"},
        )
        assert res.status_code == 201
        assert res.json()["exercise"] == "Bicep Curl"

    def test_assign_workout_to_other_trainers_client(self, client, db_session):
        trainer1 = make_trainer(db_session, email="t1@test.com")
        trainer2 = make_trainer(db_session, email="t2@test.com")
        exerciser = make_exerciser(db_session, trainer=trainer2)
        token = login(client, "t1@test.com", "trainer123", "trainer")
        res = client.post(
            f"/api/trainer/clients/{exerciser.id}/assign-workout",
            headers=auth(token),
            json={"body_part": "Chest", "exercise": "Bench Press"},
        )
        assert res.status_code == 404

    def test_update_assigned_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _assign(db_session, trainer, exerciser)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.patch(
            f"/api/trainer/clients/{exerciser.id}/assigned-workouts/{aw.id}",
            headers=auth(token),
            json={"exercise": "deadlift"},
        )
        assert res.status_code == 200
        assert res.json()["exercise"] == "Deadlift"

    def test_delete_assigned_workout(self, client, db_session):
        trainer = make_trainer(db_session)
        exerciser = make_exerciser(db_session, trainer=trainer)
        aw = _assign(db_session, trainer, exerciser)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.delete(
            f"/api/trainer/clients/{exerciser.id}/assigned-workouts/{aw.id}",
            headers=auth(token),
        )
        assert res.status_code == 204


class TestCardioLibrary:
    def test_create_cardio_exercise(self, client, db_session):
        make_trainer(db_session)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.post("/api/trainer/cardio-exercises", headers=auth(token), json={
            "name": "cycling",
            "icon": "🚴",
            "tracks_calories": True,
        })
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Cycling"  # title-cased
        assert data["icon"] == "🚴"

    def test_list_cardio_exercises(self, client, db_session):
        trainer = make_trainer(db_session)
        ce = CardioExercise(trainer_id=trainer.id, name="Running", icon="🏃", tracks_calories=True)
        db_session.add(ce)
        db_session.commit()
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.get("/api/trainer/cardio-exercises", headers=auth(token))
        assert res.status_code == 200
        assert any(e["name"] == "Running" for e in res.json())

    def test_delete_cardio_exercise(self, client, db_session):
        trainer = make_trainer(db_session)
        ce = CardioExercise(trainer_id=trainer.id, name="Swimming", icon="🏊", tracks_calories=False)
        db_session.add(ce)
        db_session.commit()
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.delete(f"/api/trainer/cardio-exercises/{ce.id}", headers=auth(token))
        assert res.status_code == 204

    def test_delete_other_trainers_exercise(self, client, db_session):
        trainer1 = make_trainer(db_session, email="t1@test.com")
        trainer2 = make_trainer(db_session, email="t2@test.com")
        ce = CardioExercise(trainer_id=trainer2.id, name="Yoga", icon="🧘", tracks_calories=False)
        db_session.add(ce)
        db_session.commit()
        token = login(client, "t1@test.com", "trainer123", "trainer")
        res = client.delete(f"/api/trainer/cardio-exercises/{ce.id}", headers=auth(token))
        assert res.status_code == 404


class TestExerciserCannotAccessTrainerRoutes:
    def test_exerciser_blocked_from_trainer_routes(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/trainer/clients", headers=auth(token))
        assert res.status_code == 403
