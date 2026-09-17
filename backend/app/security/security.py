"""
===============================================================================
Module      : security.py
Rôle        : Moteur cryptographique central
Description :
    Ce module regroupe l'ensemble des fonctions liées à la cryptographie et
    à la sécurité du backend. Il gère :
    - Le hachage asymétrique (Bcrypt) des mots de passe.
    - La génération et validation des badges d'accès JWT.
    - Le chiffrement symétrique (Fernet AES-128) pour protéger les jetons 
      d'authentification des agents distants en base de données.
===============================================================================
"""

import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
from cryptography.fernet import Fernet

# 1. Configuration des Jetons JWT & Clé Maîtresse
SECRET_KEY = os.getenv("ENCRYPTION_KEY")
if not SECRET_KEY:
    raise ValueError("CRITIQUE : La variable d'environnement ENCRYPTION_KEY est introuvable. Impossible de sécuriser les tokens JWT.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120 # Déconnexion automatique après 2 heures

# ---------------------------------------------------------
# 2. Configuration du chiffrement symétrique (Fernet AES-128)
# ---------------------------------------------------------
# On utilise ta clé Base64 à haute entropie directement
try:
    cipher_suite = Fernet(SECRET_KEY.encode('utf-8'))
except ValueError:
    raise ValueError("CRITIQUE : La ENCRYPTION_KEY n'est pas une clé Fernet valide (doit être de 32 octets en Base64 URL-safe).")

def encrypt_token(token: str) -> str:
    """Chiffre le jeton en texte clair en un jeton chiffré (réversible)"""
    return cipher_suite.encrypt(token.encode('utf-8')).decode('utf-8')

def decrypt_token(encrypted_token: str) -> str:
    """Déchiffre le jeton chiffré pour retrouver le texte clair"""
    return cipher_suite.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')

# ---------------------------------------------------------
# 3. Fonctions de Hachage avec Bcrypt en direct (Mots de passe Admin)
# ---------------------------------------------------------
def verify_password(plain_password, hashed_password):
    """Compare le mot de passe tapé avec l'empreinte en base de données"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def get_password_hash(password):
    """Transforme un mot de passe en clair en empreinte irréversible"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

# ---------------------------------------------------------
# 4. Fonction de création du Token JWT
# ---------------------------------------------------------
def create_access_token(data: dict, expires_delta: timedelta = None):
    """Génère le badge d'accès cryptographique (JWT)"""
    to_encode = data.copy()
    
    # ✨ NOUVEAU : Si une durée spécifique est demandée, on l'utilise
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# ---------------------------------------------------------
# 5. Fonction de vérification et décodage du Token JWT
# ---------------------------------------------------------
def decode_access_token(token: str):
    """
    Déchiffre le badge JWT et vérifie cryptographiquement sa signature.
    Rejette automatiquement les jetons expirés ou falsifiés.
    """
    try:
        # jwt.decode vérifie automatiquement la signature avec SECRET_KEY et l'expiration (exp)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        # Retourne None si la signature est mauvaise, si le token est expiré, ou s'il est malformé
        return None