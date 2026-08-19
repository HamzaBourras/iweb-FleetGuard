"""
===============================================================================
Module      : models.py (SQLAlchemy ORM)
Rôle        : Définition du schéma de la base de données relationnelle
Description :
    Ce fichier contient toutes les entités (tables) de la base de données PostgreSQL.
    Il définit les relations entre les sites clients, les alertes de sécurité,
    les comptes administrateurs et les notifications. Il intègre également
    le type personnalisé "EncryptedString" pour le chiffrement/déchiffrement
    transparent des données sensibles (jetons d'API) à la volée via Fernet.
===============================================================================
"""

import os
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, TypeDecorator, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from cryptography.fernet import Fernet

# On importe l'objet Base que nous avons préparé dans main.py
from app.database import Base

# 1. Configuration de la clé maîtresse via l'environnement
# lit la clé qui est sur le fichier .env 
import os
raw_key = os.getenv("ENCRYPTION_KEY")
if not raw_key:
    raise ValueError("Alerte Sécurité : La clé ENCRYPTION_KEY est introuvable dans l'environnement !")

SECRET_ENCRYPTION_KEY = raw_key.encode('utf-8')
fernet = Fernet(SECRET_ENCRYPTION_KEY)

# 2. Le Moteur de Chiffrement Automatique (Type personnalisé)
class EncryptedString(TypeDecorator):
    """
    Cette colonne intelligente va chiffrer la donnée avant de l'écrire dans PostgreSQL,
    et la déchiffrer automatiquement quand Python la lira.
    """
    impl = String

    def process_bind_param(self, value, dialect):
        # Action AVANT l'insertion dans la base de données : on chiffre !
        if value is not None:
            return fernet.encrypt(value.encode('utf-8')).decode('utf-8')
        return value

    def process_result_value(self, value, dialect):
        # Action APRÈS la lecture depuis la base de données : on déchiffre !
        if value is not None:
            return fernet.decrypt(value.encode('utf-8')).decode('utf-8')
        return value

# 3. Tes Modèles de Données
class ClientSite(Base):
    __tablename__ = "client_sites"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True, nullable=False)
    
    # 🔴 MAGIE ICI : On utilise notre nouveau type EncryptedString au lieu de String !
    secret_token = Column(EncryptedString, nullable=False) 
    
    site_name = Column(String)

    alerts = relationship("SecurityAlert", back_populates="site")
    # NOUVELLE COLONNE : Stocke la date de demande de suppression
    deleted_at = Column(DateTime, nullable=True, default=None)

    last_scan_at = Column(DateTime, nullable=True)
    wp_version = Column(String, nullable=True)
    php_version = Column(String, nullable=True)
    health_score = Column(Integer, default=100)
    #colonne pour stocker la liste des plugins :
    plugins_inventory = Column(JSON, nullable=True)
    last_admin_login = Column(DateTime, nullable=True)
    last_admin_ip = Column(String, nullable=True)
    #colonne pour stocker le rapport du scan anti-malware :
    malware_report = Column(JSON, nullable=True)
    # colonne pour stocker la liste des fichiers mis en liste blanche :
    whitelisted_files = Column(JSON, default=list)
    # Configuration des scans automatiques
    auto_scan_enabled = Column(Boolean, default=False)
    scan_frequency = Column(Integer, default=24) # Fréquence en heures (par défaut 24h)
    # Enregistre le dernier signe de vie de l'agent
    last_seen = Column(DateTime, nullable=True, default=None)


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False) 
    
    event_type = Column(String, index=True) 
    severity = Column(String)               
    message = Column(String)
    ip_address = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    site = relationship("ClientSite", back_populates="alerts")

    # Nouvelle colonne pour indiquer si l'alerte est active ou résolue
    status = Column(String, default="active")


class DashboardAdmin(Base):
    """
    Table : dashboard_admins
    Rôle : Gérer les accès au tableau de bord visuel iweb FleetGuard.
    """
    __tablename__ = "dashboard_admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    
    # On stockera ici l'empreinte irréversible (hash) du mot de passe
    hashed_password = Column(String, nullable=False)
    
    # Rôle pour différencier tes droits techniques et les droits de consultation de l'agence
    role = Column(String, default="superadmin") 
    
    # Interrupteur d'urgence pour révoquer un accès instantanément
    is_active = Column(Integer, default=1) 
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # ✨ NOUVELLES COLONNES POUR LE MFA ✨
    mfa_secret = Column(String(32), nullable=True) # Clé secrète générée par pyotp
    mfa_enabled = Column(Boolean, default=False)   # Indique si le MFA est actif

    # ✨ NOUVELLE COLONNE POUR LES CODES DE SECOURS ✨
    mfa_recovery_codes = Column(Text, nullable=True) # Stockera une liste de codes hachés au format JSON ou texte


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    
    # Le type strict basé sur tes critères
    # Valeurs attendues : "alerte de sécurité", "activation de mfa", "fichier malvaillant trouvé", "mot de passe modifié", "récupération de codes de secours"
    type = Column(String(100), nullable=False)
    
    # Contenu de la notification
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # État de la notification (pour la cloche 🔔 sur le frontend React)
    is_read = Column(Boolean, default=False)
    
    # Horodatage
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- Relations (Optionnelles mais très utiles) ---
    # Si la notification concerne un site spécifique (ex: fichier malveillant trouvé)
    site_id = Column(Integer, ForeignKey("client_sites.id", ondelete="CASCADE"), nullable=True)
    
    # Si la notification concerne un compte administrateur (ex: MFA activé, mot de passe modifié)
    admin_id = Column(Integer, ForeignKey("dashboard_admins.id", ondelete="CASCADE"), nullable=True)

    # Permet d'accéder facilement à notification.site ou notification.admin dans FastAPI
    site = relationship("ClientSite")
    admin = relationship("DashboardAdmin")