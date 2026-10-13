"""Authenticated API for an illustrative deterministic evaluation engine."""
import hmac
import os
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from .base import AuditLogger, SecurityException
from .models import SystemTaskPayload
from .supervisor import SystemSupervisor

supervisor = SystemSupervisor(model_provider="mock")
app = FastAPI(
    title="Patient Safety Incident Triage Agent API",
    description="Unvalidated rule-based demonstration; not clinical decision support.",
    version="3.0.1",
)

def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("API_ACCESS_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="API_ACCESS_KEY must be configured")
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")

class ChatRequest(BaseModel):
    query: str

@app.get("/health")
def health():
    return {"status": "HEALTHY", "service": "patient-safety-incident-triage-agent", "mode": "illustrative"}

@app.get("/metrics", dependencies=[Depends(require_api_key)])
def metrics():
    return {
        "dossiers_processed_total": len(supervisor.dossier_registry),
        "audit_blocks_total": len(AuditLogger.get_trail()),
        "audit_integrity_verified": AuditLogger.verify_integrity(),
    }

@app.post("/api/audit", dependencies=[Depends(require_api_key)])
def api_audit(payload: SystemTaskPayload):
    try:
        return supervisor.process_task(payload).to_dict()
    except SecurityException:
        raise HTTPException(status_code=422, detail="Input contains a potential direct identifier")

@app.post("/api/chat", dependencies=[Depends(require_api_key)])
def api_chat(req: ChatRequest):
    try:
        return {"response": supervisor.query_supervisory_chat(req.query)}
    except SecurityException:
        raise HTTPException(status_code=422, detail="Input contains a potential direct identifier")

@app.get("/api/audit/logs", dependencies=[Depends(require_api_key)])
def api_audit_logs():
    return {"audit_trail": AuditLogger.get_trail(), "verified": AuditLogger.verify_integrity()}
