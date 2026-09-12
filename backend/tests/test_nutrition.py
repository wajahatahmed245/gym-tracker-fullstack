"""Tests for /api/nutrition/* endpoints."""
import pytest
from tests.conftest import make_exerciser, login, auth


class TestPreWorkout:
    def test_pre_workout_prompt(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/nutrition/pre-workout", headers=auth(token))
        assert res.status_code == 200
        data = res.json()
        assert data["meal_type"] == "pre_workout"
        assert data["protein_g_min"] == 30
        assert data["protein_g_max"] == 40
        assert data["carbs_g"] == 45
        assert len(data["food_suggestions"]) > 0

    def test_pre_workout_skips_protein_when_recently_eaten(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get(
            "/api/nutrition/pre-workout?minutes_since_last_protein_meal=60&grams_in_that_meal=25",
            headers=auth(token),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["protein_g_min"] == 0
        assert data["protein_g_max"] == 0

    def test_pre_workout_shows_protein_if_meal_too_long_ago(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get(
            "/api/nutrition/pre-workout?minutes_since_last_protein_meal=150&grams_in_that_meal=30",
            headers=auth(token),
        )
        assert res.status_code == 200
        assert res.json()["protein_g_min"] == 30

    def test_pre_workout_shows_protein_if_too_little_eaten(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get(
            "/api/nutrition/pre-workout?minutes_since_last_protein_meal=30&grams_in_that_meal=10",
            headers=auth(token),
        )
        assert res.status_code == 200
        assert res.json()["protein_g_min"] == 30

    def test_pre_workout_requires_auth(self, client):
        assert client.get("/api/nutrition/pre-workout").status_code == 401


class TestPostWorkout:
    def test_post_workout_uses_profile_weight(self, client, db_session):
        make_exerciser(db_session, weight_kg=80.0)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/nutrition/post-workout", headers=auth(token))
        assert res.status_code == 200
        data = res.json()
        assert data["meal_type"] == "post_workout"
        assert data["carbs_g"] == 80.0
        assert data["protein_g_min"] == 30
        assert len(data["food_suggestions"]) > 0

    def test_post_workout_different_weight(self, client, db_session):
        make_exerciser(db_session, weight_kg=60.0)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/nutrition/post-workout", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["carbs_g"] == 60.0

    def test_post_workout_second_dose(self, client, db_session):
        make_exerciser(db_session, weight_kg=80.0)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/nutrition/post-workout/second-dose", headers=auth(token))
        assert res.status_code == 200
        data = res.json()
        assert data["meal_type"] == "post_workout_second_dose"
        assert data["carbs_g"] == 40.0  # 80 * 0.5


class TestCardioPostPrompt:
    def test_short_session_no_prompt(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get(
            "/api/nutrition/cardio/should-show-post-prompt?duration_minutes=45&high_intensity=true",
            headers=auth(token),
        )
        assert res.status_code == 200
        assert res.json()["show_post_workout_prompt"] is False

    def test_long_low_intensity_no_prompt(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get(
            "/api/nutrition/cardio/should-show-post-prompt?duration_minutes=90&high_intensity=false",
            headers=auth(token),
        )
        assert res.status_code == 200
        assert res.json()["show_post_workout_prompt"] is False

    def test_long_high_intensity_shows_prompt(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get(
            "/api/nutrition/cardio/should-show-post-prompt?duration_minutes=60&high_intensity=true",
            headers=auth(token),
        )
        assert res.status_code == 200
        assert res.json()["show_post_workout_prompt"] is True
