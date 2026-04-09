"""Backend API tests for Entrenamiento Comunicativo"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
TEST_EMAIL = "test@cibermedida.es"
TEST_PASSWORD = "Test2024!"
NEW_EMAIL = "newuser_pytest@test.es"
NEW_PASSWORD = "TestNew2024!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(api):
    resp = api.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if resp.status_code == 200:
        return resp.json()["token"]
    pytest.skip("Login failed - skipping auth tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# Health
class TestHealth:
    def test_health_returns_ok(self, api):
        r = api.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["db"] == "connected"


# Auth
class TestAuth:
    def test_login_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL

    def test_login_wrong_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_register_new_user(self, api):
        # Try to delete first if exists (ignore errors)
        r = api.post(f"{BASE_URL}/api/auth/register", json={
            "email": NEW_EMAIL, "password": NEW_PASSWORD, "name": "Pytest User"
        })
        # Either created or already exists
        assert r.status_code in [200, 400]
        if r.status_code == 200:
            data = r.json()
            assert "token" in data
            assert data["user"]["email"] == NEW_EMAIL

    def test_register_duplicate_email(self, api):
        # Register test user again should fail
        r = api.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Duplicate"
        })
        assert r.status_code == 400

    def test_get_me(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL


# Exercises
class TestExercises:
    def test_list_exercises_authenticated(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/exercises", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 40, f"Expected 40+ exercises, got {len(data)}"

    def test_list_exercises_unauthenticated(self, api):
        r = api.get(f"{BASE_URL}/api/exercises")
        assert r.status_code == 401

    def test_exercise_has_required_fields(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/exercises", headers=auth_headers)
        assert r.status_code == 200
        exercises = r.json()
        for ex in exercises[:5]:
            assert "id" in ex
            assert "title_es" in ex
            assert "category" in ex
            assert "level_required" in ex

    def test_filter_by_category(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/exercises?category=Lectura Controlada", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for ex in data:
            assert ex["category"] == "Lectura Controlada"


# Progress
class TestProgress:
    def test_progress_authenticated(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/progress", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_progress_unauthenticated(self, api):
        r = api.get(f"{BASE_URL}/api/progress")
        assert r.status_code == 401


# User profile
class TestProfile:
    def test_get_user_me(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/users/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "name" in data
        assert "current_level" in data
        assert "total_xp" in data

    def test_update_profile_name(self, api, auth_headers):
        r = api.patch(f"{BASE_URL}/api/users/profile", json={"name": "Test User Updated"}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Test User Updated"
        # Restore
        api.patch(f"{BASE_URL}/api/users/profile", json={"name": "Test User"}, headers=auth_headers)

    def test_update_invalid_job_profile(self, api, auth_headers):
        r = api.patch(f"{BASE_URL}/api/users/profile", json={"job_profile": "invalid"}, headers=auth_headers)
        assert r.status_code == 400
