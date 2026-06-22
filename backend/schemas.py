from pydantic import BaseModel
from typing import List

# 1. Le moule pour une seule alerte
class SecurityEvent(BaseModel):
    event_type: str
    severity: str
    message: str
    ip_address: str

# 2. Le moule global (qui correspond au JSON envoyé par ton agent PHP)
class AgentPayload(BaseModel):
    security_events: List[SecurityEvent]