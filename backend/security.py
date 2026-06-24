# Ce fichier va contenir toute la logique pour hacher les mots de passe et générer les jetons d'accès (JWT).
import bcrypt
from jose import jwt
from datetime import datetime, timedelta
import os

# 1. Configuration des Jetons JWT
SECRET_KEY = os.getenv("ENCRYPTION_KEY")
if not SECRET_KEY:
    raise ValueError("CRITIQUE : La variable d'environnement ENCRYPTION_KEY est introuvable. Impossible de sécuriser les tokens JWT.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120 # Déconnexion automatique après 2 heures

# 2. Fonctions de Hachage avec Bcrypt en direct
def verify_password(plain_password, hashed_password):
    """Compare le mot de passe tapé avec l'empreinte en base de données"""
    # Bcrypt s'attend à recevoir des 'bytes', on doit donc encoder les chaînes
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def get_password_hash(password):
    """Transforme un mot de passe en clair en empreinte irréversible"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

# 3. Fonction de création du Token
def create_access_token(data: dict):
    """Génère le badge d'accès cryptographique (JWT)"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt