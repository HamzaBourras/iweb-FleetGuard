import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
import app.models.models as models

# Import de tes nouveaux routeurs
from app.routers import auth, dashboard, sites, alerts

# Configuration BDD
DATABASE_URL = "postgresql://fleetguard_admin:super_secret_password@db:5432/fleetguard_db"
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

# Route de test
@app.get("/")
def read_root():
    return {"status": "En ligne"}

# ... Ton code du planificateur CRON (APScheduler) reste ici ou va dans un fichier séparé ...