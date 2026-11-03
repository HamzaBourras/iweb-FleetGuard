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
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet, MultiFernet
from jose import jwt, JWTError

# 1. Clé JWT : DISTINCTE de la clé de chiffrement
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 43:
    raise ValueError('CRITIQUE : JWT_SECRET_KEY absente ou trop courte (64 octets aléatoires recommandés).')
if JWT_SECRET_KEY == os.getenv('ENCRYPTION_KEY'):
    raise ValueError('CRITIQUE : JWT_SECRET_KEY doit être différente de ENCRYPTION_KEY.')

ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 120

# 2. Chiffrement au repos (Fernet), avec rotation : ENCRYPTION_KEY chiffre, ENCRYPTION_KEY_OLD ne sert qu'à déchiffrer
def _build_cipher() -> MultiFernet:
    keys = [k for k in (os.getenv('ENCRYPTION_KEY'), os.getenv('ENCRYPTION_KEY_OLD')) if k]
    if not keys:
        raise ValueError('CRITIQUE : ENCRYPTION_KEY introuvable.')
    try:
        return MultiFernet([Fernet(k.encode('utf-8')) for k in keys])
    except ValueError:
        raise ValueError('CRITIQUE : clé Fernet invalide (32 octets en Base64 URL-safe).')

cipher_suite = _build_cipher()

def encrypt_token(token: str) -> str:
    return cipher_suite.encrypt(token.encode('utf-8')).decode('utf-8')

def decrypt_token(encrypted_token: str) -> str:
    return cipher_suite.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')

# 3. Mots de passe (bcrypt limité à 72 octets)
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8')[:72], bcrypt.gensalt()).decode('utf-8')

DUMMY_HASH = get_password_hash('dummy-password-for-timing')

def verify_password(plain_password: str, hashed_password) -> bool:
    # Si le compte n'existe pas (hashed_password=None), on compare quand même avec un hash factice
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8')[:72], (hashed_password or DUMMY_HASH).encode('utf-8'))
    except ValueError:
        return False

# 4. JWT typés
def create_access_token(data: dict, expires_delta: timedelta = None, token_type: str = 'access'):
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {**data, 'type': token_type, 'iat': now, 'exp': expire}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
