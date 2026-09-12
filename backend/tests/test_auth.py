"""Tests for /api/auth/* endpoints."""
import pytest
from tests.conftest import make_trainer, make_exerciser, login, auth


class TestSignup:
    def test_exerciser_signup(self, client):
        res = client.post("/api/auth/signup/exerciser", json={
            "name": "Alice",
            "email": "alice@test.com",
            "password": "pass1234",
            "phone": "+10000000001",
            "goal": "General Fitness",
        })
        assert res.status_code == 201
        data = res.json()
        assert data["user"]["email"] == "alice@test.com"
        assert data["user"]["role"] == "exerciser"
        assert "access_token" in data

    def test_trainer_signup(self, client):
        res = client.post("/api/auth/signup/trainer", json={
            "name": "Bob",
            "email": "bob@test.com",
            "password": "pass1234",
            "phone": "+10000000002",
            "specialty": "Bodybuilding",
            "experience_years": 2,
        })
        assert res.status_code == 201
        data = res.json()
        assert data["user"]["role"] == "trainer"

    def test_duplicate_email_rejected(self, client):
        payload = {
            "name": "Alice",
            "email": "dup@test.com",
            "password": "pass1234",
            "phone": "+10000000003",
            "goal": "General Fitness",
        }
        client.post("/api/auth/signup/exerciser", json=payload)
        res = client.post("/api/auth/signup/exerciser", json=payload)
        assert res.status_code == 400

    def test_short_password_rejected(self, client):
        res = client.post("/api/auth/signup/exerciser", json={
            "name": "Alice",
            "email": "alice2@test.com",
            "password": "abc",
            "phone": "+10000000004",
            "goal": "General Fitness",
        })
        assert res.status_code == 422

    def test_invalid_goal_rejected(self, client):
        res = client.post("/api/auth/signup/exerciser", json={
            "name": "Alice",
            "email": "alice3@test.com",
            "password": "pass1234",
            "phone": "+10000000005",
            "goal": "invalid_goal",
        })
        assert res.status_code == 422


class TestLogin:
    def test_exerciser_login_success(self, client, db_session):
        make_exerciser(db_session)
        res = client.post("/api/auth/login", json={
            "role": "exerciser",
            "email": "exerciser@test.com",
            "password": "ex123",
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_wrong_password(self, client, db_session):
        make_exerciser(db_session)
        res = client.post("/api/auth/login", json={
            "role": "exerciser",
            "email": "exerciser@test.com",
            "password": "wrongpass",
        })
        assert res.status_code == 401

    def test_wrong_role(self, client, db_session):
        make_exerciser(db_session)
        res = client.post("/api/auth/login", json={
            "role": "trainer",
            "email": "exerciser@test.com",
            "password": "ex123",
        })
        assert res.status_code == 401

    def test_unknown_email(self, client):
        res = client.post("/api/auth/login", json={
            "role": "exerciser",
            "email": "nobody@test.com",
            "password": "pass",
        })
        assert res.status_code == 401

    def test_get_me(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/auth/me", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["email"] == "exerciser@test.com"

    def test_me_unauthenticated(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401
