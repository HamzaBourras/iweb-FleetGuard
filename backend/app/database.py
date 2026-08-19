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

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Configuration de la connexion à la Base de Données PostgreSQL
DATABASE_URL = "postgresql://fleetguard_admin:super_secret_password@db:5432/fleetguard_db"

# Initialisation du moteur de base de données
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()