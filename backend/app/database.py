"""
===============================================================================
Module      : database.py
Rôle        : Initialisation de la connexion à la base de données
Description :
    Ce fichier configure l'usine à sessions (SessionLocal) et le moteur de 
    connexion (Engine) pour communiquer avec l'instance PostgreSQL via SQLAlchemy.
    Il expose également la classe de base (Base) héritée par tous les modèles.
===============================================================================
"""

import os
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Configuration de la connexion à la Base de Données PostgreSQL
# Force la lecture du fichier .env
load_dotenv()
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")

# Vérification que les variables d'environnement sont bien définies
if not all([POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB]):
    raise ValueError("Les variables d'environnement POSTGRES_USER, POSTGRES_PASSWORD et POSTGRES_DB doivent être définies.")

DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@db:5432/{POSTGRES_DB}"

# Initialisation du moteur de base de données
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()