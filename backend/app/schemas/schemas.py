from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

# Schéma pour recevoir la mise à jour depuis React
class SiteSettingsUpdate(BaseModel):
    auto_scan_enabled: Optional[bool] = None
    scan_frequency: Optional[int] = None


class SiteResponse(BaseModel):
    # ... tes autres attributs ...
    
    # Envoi au frontend
    auto_scan_enabled: bool = False
    scan_frequency: int = 24

    class Config:
        from_attributes = True

# 1. Le moule pour une seule alerte
class SecurityEvent(BaseModel):
    event_type: str
    severity: str
    message: str
    ip_address: str

# 2. Le moule global (qui correspond au JSON envoyé par ton agent PHP)
class AgentPayload(BaseModel):
    security_events: List[SecurityEvent]


# --- SCHÉMAS D'AUTHENTIFICATION (DASHBOARD) ---

class AdminLogin(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None # Optionnel car le frontend ne l'envoie pas au premier clic

class Token(BaseModel):
    access_token: str
    token_type: str

class MfaEnableRequest(BaseModel):
    code: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class RecoveryCodesRequest(BaseModel):
    password: str

class NotificationBase(BaseModel):
    type: str
    title: str
    message: str
    site_id: Optional[int] = None
    admin_id: Optional[int] = None

class NotificationResponse(NotificationBase):
    id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True