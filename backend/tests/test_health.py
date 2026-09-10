"""
test_health.py — health endpoint smoke tests.
These verify the app boots correctly and the /health route returns expected schema.
"""
from unittest.mock import patch, MagicMock


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        """GET /health must always return HTTP 200."""
        with patch("main.get_mongo_client") as mock_client:
            mock_client.return_value.admin.command.return_value = {"ok": 1}
            response = client.get("/health")
        assert response.status_code == 200

    def test_health_response_schema(self, client):
        """Response must include status, database, and version keys."""
        with patch("main.get_mongo_client") as mock_client:
            mock_client.return_value.admin.command.return_value = {"ok": 1}
            data = client.get("/health").json()
        assert "status" in data
        assert "database" in data
        assert "version" in data

    def test_health_status_ok(self, client):
        """status field must be 'ok' when DB is reachable."""
        with patch("main.get_mongo_client") as mock_client:
            mock_client.return_value.admin.command.return_value = {"ok": 1}
            data = client.get("/health").json()
        assert data["status"] == "ok"

    def test_health_version(self, client):
        """Version should match the app version string."""
        with patch("main.get_mongo_client") as mock_client:
            mock_client.return_value.admin.command.return_value = {"ok": 1}
            data = client.get("/health").json()
        assert data["version"] == "2.0.0"

    def test_health_db_unavailable(self, client):
        """When MongoDB ping fails, database field must indicate unavailability — not crash."""
        from pymongo.errors import PyMongoError
        with patch("main.get_mongo_client") as mock_client:
            mock_client.return_value.admin.command.side_effect = PyMongoError("connection refused")
            response = client.get("/health")
        assert response.status_code == 200
        assert "unavailable" in response.json()["database"]
