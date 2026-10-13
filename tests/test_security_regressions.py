"""Regression coverage for integrity, privacy and input parsing."""
import pytest
from fastapi.testclient import TestClient
from agents.base import AuditTrail, SecurityException
from agents.models import SystemTaskPayload
from agents.supervisor import SystemSupervisor
from agents.api import app
from cli import parse_boolean

def test_audit_signature_detects_change():
    trail = AuditTrail(secret_key="local-test-key-32-characters-long!")
    trail.log("tester", "test", "EVENT", {"task_id": "SYN-1"})
    assert trail.verify_integrity()
    exported = trail.get_trail()
    exported[0]["event_type"] = "CHANGED"
    assert trail.verify_integrity()
    trail.logs[0]["event_type"] = "CHANGED"
    assert not trail.verify_integrity()

def test_audit_detects_forged_signature():
    trail = AuditTrail(secret_key="local-test-key-32-characters-long!")
    trail.log("tester", "test", "EVENT", {"task_id": "SYN-1"})
    trail.logs[0]["current_hash"] = "0" * 64
    assert not trail.verify_integrity()

def test_nested_direct_identifier_rejected():
    payload = SystemTaskPayload(
        task_id="SYN-1", target_identifier="SYN-2", primary_metric=3,
        attributes={"nested": {"email": "patient@example.com"}},
    )
    with pytest.raises(SecurityException):
        SystemSupervisor().process_task(payload)

@pytest.mark.parametrize("number", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_measurement_rejected(number):
    with pytest.raises(ValueError):
        SystemTaskPayload(task_id="SYN-1", target_identifier="SYN-2", primary_metric=number)

@pytest.mark.parametrize("raw,expected", [
    ("True", True), ("False", False), ("yes", True),
    ("0", False), ("1", True), ("", False),
])
def test_csv_boolean_parsing(raw,expected):
    assert parse_boolean(raw) is expected

def test_invalid_boolean_rejected():
    with pytest.raises(ValueError):
        parse_boolean("not sure")

def test_sensitive_endpoints_require_key(monkeypatch):
    client = TestClient(app)
    payload = {"task_id":"SYN-1","target_identifier":"SYN-2","primary_metric":4}
    monkeypatch.delenv("API_ACCESS_KEY", raising=False)
    assert client.post("/api/audit", json=payload).status_code == 503
    monkeypatch.setenv("API_ACCESS_KEY", "local-test-api-key")
    assert client.post("/api/audit", json=payload).status_code == 401
    assert client.get("/api/audit/logs").status_code == 401
    response = client.post("/api/audit", json=payload, headers={"X-API-Key":"local-test-api-key"})
    assert response.status_code == 200
    assert response.json()["overall_urgency"] == "ROUTINE"
