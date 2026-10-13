"""
Deterministic mock response adapter. External LLM providers are not implemented.
"""
from typing import Dict, Any, Optional
from .base import PHIGuard


class MockLLM:
    def __init__(self, system_name: str = "Patient Safety Incident Triage Agent"):
        self.system_name = system_name

    def invoke(self, prompt: str) -> str:
        PHIGuard.assert_no_phi(prompt)
        return f"[{self.system_name} Deterministic Verification Engine]: No model inference performed. This is a mock response, not verified clinical analysis."


class LLMFactory:
    """Creates the demonstration-only mock adapter."""

    @staticmethod
    def create(provider: str = "mock", system_name: str = "Patient Safety Incident Triage Agent"):
        prov = str(provider).lower()
        if prov in ["mock", "deterministic", "test"]:
            return MockLLM(system_name)
        raise ValueError("Only the deterministic mock provider is implemented; no external LLM is connected.")
