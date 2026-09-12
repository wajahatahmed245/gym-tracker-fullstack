"""Tests for /api/admin/* endpoints."""
import pytest
from tests.conftest import make_admin, make_trainer, make_exerciser, login, auth


class TestAdminDashboard:
    def test_dashboard(self, client, db_session):
        make_admin(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.get("/api/admin/dashboard", headers=auth(token))
        assert res.status_code == 200
        data = res.json()
        assert "total_users" in data
        assert "active_trainers" in data

    def test_exerciser_cannot_access_admin(self, client, db_session):
        make_exerciser(db_session)
        token = login(client, "exerciser@test.com", "ex123", "exerciser")
        res = client.get("/api/admin/dashboard", headers=auth(token))
        assert res.status_code == 403


class TestAdminUsers:
    def test_list_users(self, client, db_session):
        make_admin(db_session)
        make_exerciser(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.get("/api/admin/users", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_set_user_status(self, client, db_session):
        make_admin(db_session)
        exerciser = make_exerciser(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.patch(f"/api/admin/users/{exerciser.id}/status", headers=auth(token),
                           json={"status": "inactive"})
        assert res.status_code == 200

    def test_reset_user_password(self, client, db_session):
        make_admin(db_session)
        exerciser = make_exerciser(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.patch(f"/api/admin/users/{exerciser.id}/password", headers=auth(token),
                           json={"new_password": "newpass123"})
        assert res.status_code == 204
        # Verify new password works
        login_res = client.post("/api/auth/login", json={
            "role": "exerciser", "email": "exerciser@test.com", "password": "newpass123"
        })
        assert login_res.status_code == 200

    def test_delete_user(self, client, db_session):
        make_admin(db_session)
        exerciser = make_exerciser(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.delete(f"/api/admin/users/{exerciser.id}", headers=auth(token))
        assert res.status_code == 204


class TestAdminTrainers:
    def test_list_trainers(self, client, db_session):
        make_admin(db_session)
        make_trainer(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.get("/api/admin/trainers", headers=auth(token))
        assert res.status_code == 200
        assert len(res.json()) == 1

    def test_approve_trainer(self, client, db_session):
        make_admin(db_session)
        trainer = make_trainer(db_session, approved=False)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.patch(f"/api/admin/trainers/{trainer.id}/approve", headers=auth(token))
        assert res.status_code == 200
        assert res.json()["approval_status"] == "approved"

    def test_set_trainer_status(self, client, db_session):
        make_admin(db_session)
        trainer = make_trainer(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.patch(f"/api/admin/trainers/{trainer.id}/status", headers=auth(token),
                           json={"status": "inactive"})
        assert res.status_code == 200

    def test_reset_trainer_password(self, client, db_session):
        make_admin(db_session)
        trainer = make_trainer(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.patch(f"/api/admin/trainers/{trainer.id}/password", headers=auth(token),
                           json={"new_password": "newtrainer456"})
        assert res.status_code == 204

    def test_update_trainer_phone(self, client, db_session):
        make_admin(db_session)
        trainer = make_trainer(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.patch(f"/api/admin/trainers/{trainer.id}/phone", headers=auth(token),
                           json={"phone": "+9876543210"})
        assert res.status_code == 200

    def test_delete_trainer(self, client, db_session):
        make_admin(db_session)
        trainer = make_trainer(db_session)
        token = login(client, "admin@test.com", "admin123", "admin")
        res = client.delete(f"/api/admin/trainers/{trainer.id}", headers=auth(token))
        assert res.status_code == 204
