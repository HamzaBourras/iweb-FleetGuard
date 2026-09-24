"""
===============================================================================
Module      : main.py
Rôle        : Point d'entrée principal de l'API FastAPI iweb FleetGuard
Description :
    Ce fichier est le cœur du backend. Il initialise l'application FastAPI,
    configure la connexion à la base de données PostgreSQL et force la création 
    des tables manquantes. Il définit également les règles de sécurité CORS 
    pour n'autoriser que le frontend React, et orchestre le routage en connectant 
    tous les sous-modules (auth, sites, alerts, dashboard, agent).
===============================================================================
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
import app.models.models as models

# Import de tes nouveaux routeurs
from app.routers import auth, dashboard, sites, alerts, agent

# Configuration BDD
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")

# Vérification que les variables d'environnement sont bien définies
if not all([POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB]):
    raise ValueError("Les variables d'environnement POSTGRES_USER, POSTGRES_PASSWORD et POSTGRES_DB doivent être définies.")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@db:5432/{POSTGRES_DB}"
engine = create_engine(DATABASE_URL)
models.Base.metadata.create_all(bind=engine)

# Initialisation de l'application FastAPI
app = FastAPI( 
    title="iweb FleetGuard API",
    description="Le cerveau central de la Tour de Contrôle SecOps",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# On branche les routeurs à l'application principale
app.include_router(auth.router)
app.include_router(sites.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(agent.router)

