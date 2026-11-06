"""
===============================================================================
Module      : dependencies.py
Rôle        : Injection de dépendances FastAPI (Middlewares de Sécurité)
Description :
    Ce fichier définit les fonctions injectables réutilisables dans les routes.
    Il contient le générateur de session de base de données (get_db) assurant
    une ouverture/fermeture propre, ainsi que le verrou de sécurité principal 
    (get_current_admin) qui lit et valide le cookie JWT pour bloquer les accès 
    non autorisés aux API privées.
===============================================================================
"""

import uuid

from fastapi import Request, Depends, HTTPException
from sqlalchemy.orm import Session
from jose import jwt, JWTError

# On importe SessionLocal depuis notre nouveau fichier database.py
from app.database import SessionLocal 

# Import des modèles et du module de sécurité
import app.models.models as models
import app.security.security as security

def get_db():
    """Ouvre et ferme proprement la session BDD à chaque requête."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_admin(request: Request, db: Session = Depends(get_db)):
    """Vérifie le cookie HTTPOnly et retourne l'administrateur authentifié."""
    # 1. On extrait le token du cookie HttpOnly
    token = request.cookies.get("fleetguard_token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié (Cookie introuvable)")
    
    try:
        # 2. On utilise ta clé secrète pour décoder
        payload = jwt.decode(token, security.JWT_SECRET_KEY, algorithms=[security.ALGORITHM])
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail='Token invalide')
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expiré ou corrompu")
        
    # 3. On vérifie que l'admin existe toujours en BDD
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == email).first()
    if admin is None or not admin.is_active:
        raise HTTPException(status_code=401, detail="Administrateur introuvable")
    if payload.get("tv", 0) != admin.token_version:
        raise HTTPException(status_code=401, detail="Session révoquée")
        
    return admin


def get_any_site(
    public_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: models.DashboardAdmin = Depends(get_current_admin),
):
    site = db.query(models.ClientSite).filter(
        models.ClientSite.public_id == str(public_id)
    ).first()
    if not site:
        raise HTTPException(
            status_code=404,
            detail="Actif introuvable dans la flotte.",
        )
    return site


def get_active_site(
    site: models.ClientSite = Depends(get_any_site),
):
    if site.deleted_at:
        raise HTTPException(
            status_code=404,
            detail="Actif en corbeille : restaurez-le d'abord.",
        )
    return site


def require_role(*roles):
    def checker(
        admin: models.DashboardAdmin = Depends(get_current_admin),
    ):
        if admin.role not in roles:
            raise HTTPException(
                status_code=403,
                detail="Droits insuffisants pour cette action.",
            )
        return admin

    return checker