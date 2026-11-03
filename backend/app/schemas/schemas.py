from pydantic import BaseModel, field_validator, Field, EmailStr, ConfigDict
from typing import Optional, List, Any, Literal 
from datetime import datetime
import re


# Fonction pour la validation de la force du mot de passe
SPECIALS = '!@#$%^&*(),.?:{}|<>+=_-'

def validate_password_strength(value: str) -> str:
    if not 14 <= len(value) <= 64 or len(value.encode('utf-8')) > 72:
        raise ValueError('Le mot de passe doit contenir entre 14 et 64 caractères (72 octets maximum).')
    if not (re.search('[A-Z]', value) and re.search('[a-z]', value) and re.search('[0-9]', value)):
        raise ValueError('Le mot de passe doit contenir majuscule, minuscule et chiffre.')
    if not any(c in SPECIALS for c in value):
        raise ValueError('Le mot de passe doit contenir au moins un caractère spécial.')
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
        return v


class DeleteFileRequest(BaseModel):
    file_path: str = Field(min_length=1, max_length=500)
    
class FileActionRequest(BaseModel):
    file_path: str = Field(min_length=1, max_length=500)

class SiteResponse(BaseModel):
    # Envoi au frontend
    auto_scan_enabled: bool = False
    scan_frequency: int = 24

    class Config:
        from_attributes = True

# 1. Le moule pour une seule alerte
class SecurityEvent(BaseModel):
    event_type: str = Field(min_length=1, max_length=64, pattern='^[a-z0-9_]+$')
    severity: Literal['critical', 'high', 'medium', 'low']
    message: str = Field(max_length=1000)
    ip_address: str = Field(max_length=45)

    @field_validator('message', mode='before')
    @classmethod
    def truncate_message(cls, v):
        return v[:1000] if isinstance(v, str) else v

# 2. Le moule global (qui correspond au JSON envoyé par ton agent PHP)
class AgentPayload(BaseModel):
    security_events: List[SecurityEvent] = Field(max_length=20)

class MfaEnableRequest(BaseModel):
    code: str = Field(pattern='^[0-9]{6}$')

class SiteSettingsUpdate(BaseModel):
    auto_scan_enabled: Optional[bool] = None
    scan_frequency: Optional[int] = Field(default=None, ge=1, le=168)

class RecoveryCodesRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


# --- SCHÉMAS D'AUTHENTIFICATION (DASHBOARD) ---

class AdminLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    mfa_code: Optional[str] = Field(default=None, max_length=32)  # Optionnel : absent au premier clic


class Token(BaseModel):
    access_token: str
    token_type: str


# Schéma pour la réinitialisation du mot de passe (lorsque l'utilisateur est connecté)
class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str

    @field_validator("new_password")  # Valide le mot de passe lors de la création de l'objet
    @classmethod
    def check_new_password(cls, v):
        return validate_password_strength(v)

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
    email: EmailStr

# Schéma pour la réinitialisation du mot de passe (s'il est oublié)
class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str
    mfa_code: Optional[str] = None

    @field_validator("new_password")  # Valide le mot de passe lors de la création de l'objet
    @classmethod
    def check_new_password(cls, v):
        return validate_password_strength(v)

class ResetTokenCheck(BaseModel):
    token: str = Field(min_length=20, max_length=200)