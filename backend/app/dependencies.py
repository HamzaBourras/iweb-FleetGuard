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
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token invalide")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expiré ou corrompu")
        
    # 3. On vérifie que l'admin existe toujours en BDD
    admin = db.query(models.DashboardAdmin).filter(models.DashboardAdmin.email == email).first()
    if admin is None:
        raise HTTPException(status_code=401, detail="Administrateur introuvable")
        
    return admin