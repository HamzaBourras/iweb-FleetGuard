from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from datetime import datetime
import re


# Fonction pour la validation de la force du mot de passe
def validate_password_strength(value: str) -> str:
    if len(value) < 14 or len(value) > 16:
        raise ValueError("Le mot de passe doit contenir entre 14 et 16 caractères.")
    if not re.search(r"[A-Z]", value):
        raise ValueError("Le mot de passe doit contenir au moins une majuscule.")
    if not re.search(r"[a-z]", value):
        raise ValueError("Le mot de passe doit contenir au moins une minuscule.")
    if not re.search(r"[0-9]", value):
        raise ValueError("Le mot de passe doit contenir au moins un chiffre.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", value):
        raise ValueError("Le mot de passe doit contenir au moins un caractère spécial.")
    return value

class SiteCreate(BaseModel):
    site_name: str
    url: str

    @field_validator("url") # Valide l'URL lors de la création de l'objet
    @classmethod
    def validate_url_format(cls, v):
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("L'URL doit commencer par http:// ou https://")
        if len(v) > 2048:
            raise ValueError("URL trop longue.")
        return v
    
    @field_validator("site_name") # Valide le nom du site lors de la création de l'objet
    @classmethod
    def validate_site_name(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Le nom du site doit contenir entre 2 et 100 caractères.")


class DeleteFileRequest(BaseModel):
    file_path: str
    
class FileActionRequest(BaseModel):
    file_path: str

# Schéma pour recevoir la mise à jour depuis React
class SiteSettingsUpdate(BaseModel):
    auto_scan_enabled: Optional[bool] = None
    scan_frequency: Optional[int] = None


class SiteResponse(BaseModel):
    
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

    @field_validator("password")  # Valide le mot de passe lors de la création de l'objet
    @classmethod
    def check_password_strength(cls, v):
        return validate_password_strength(v)

class Token(BaseModel):
    access_token: str
    token_type: str

class MfaEnableRequest(BaseModel):
    code: str

# Schéma pour la réinitialisation du mot de passe (lorsque l'utilisateur est connecté)
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")  # Valide le mot de passe lors de la création de l'objet
    @classmethod
    def check_new_password(cls, v):
        return validate_password_strength(v)

    @field_validator("current_password")  # Valide le mot de passe lors de la création de l'objet
    @classmethod
    def check_current_password(cls, v):
        return validate_password_strength(v) 


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

class ForgotPasswordRequest(BaseModel):
    email: str

# Schéma pour la réinitialisation du mot de passe (s'il est oublié)
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    mfa_code: Optional[str] = None

    @field_validator("new_password")  # Valide le mot de passe lors de la création de l'objet
    @classmethod
    def check_new_password(cls, v):
        return validate_password_strength(v)
