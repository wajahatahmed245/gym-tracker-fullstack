"""Tests for /api/me/unavailability endpoints."""
from datetime import date, timedelta
import pytest
from tests.conftest import make_trainer, make_exerciser, login, auth


def future(days=3):
    return str(date.today() + timedelta(days=days))


class TestUnavailability:
    def test_add_unavailable_date(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.post("/api/me/unavailability", headers=auth(token), json={"date": future()})
        assert res.status_code == 201
        assert res.json()["date"] == future()

    def test_list_unavailable_dates(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        client.post("/api/me/unavailability", headers=auth(token), json={"date": future(3)})
        client.post("/api/me/unavailability", headers=auth(token), json={"date": future(5)})
        res = client.get("/api/me/unavailability", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_add_duplicate_date_idempotent(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        d = future()
        client.post("/api/me/unavailability", headers=auth(token), json={"date": d})
        res = client.post("/api/me/unavailability", headers=auth(token), json={"date": d})
        assert res.status_code == 201  # idempotent
        dates = client.get("/api/me/unavailability", headers=auth(token)).json()
        assert len(dates) == 1

    def test_add_past_date_rejected(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        past = str(date.today() - timedelta(days=1))
        res = client.post("/api/me/unavailability", headers=auth(token), json={"date": past})
        assert res.status_code == 422

    def test_remove_unavailable_date(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        d = future()
        client.post("/api/me/unavailability", headers=auth(token), json={"date": d})
        res = client.delete(f"/api/me/unavailability/{d}", headers=auth(token))
        assert res.status_code == 204
        assert client.get("/api/me/unavailability", headers=auth(token)).json() == []

    def test_remove_nonexistent_date(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.delete(f"/api/me/unavailability/{future(10)}", headers=auth(token))
        assert res.status_code == 404

    def test_trainer_can_mark_unavailability(self, client, db_session):
        make_trainer(db_session)
        token = login(client, "trainer@test.com", "trainer123", "trainer")
        res = client.post("/api/me/unavailability", headers=auth(token), json={"date": future()})
        assert res.status_code == 201

    def test_trainer_unavailability_visible_to_exerciser(self, client, db_session):
        trainer = make_trainer(db_session)
        make_exerciser(db_session, trainer=trainer)
        trainer_token = login(client, "trainer@test.com", "trainer123", "trainer")
        exerciser_token = login(client, "exerciser@test.com", "ex123", "exerciser")
        client.post("/api/me/unavailability", headers=auth(trainer_token), json={"date": future()})
        res = client.get("/api/exerciser/trainer/unavailability", headers=auth(exerciser_token))
        assert res.status_code == 200
        assert len(res.json()) == 1
