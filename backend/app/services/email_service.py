"""
===============================================================================
Module      : email_service.py
Rôle        : Service de communication et d'alerting SMTP
Description :
    Ce module gère l'envoi d'e-mails asynchrones pour le SOC. Il génère 
    des modèles HTML dynamiques (templates professionnels) selon le niveau 
    de criticité de l'événement (Alerte critique, MFA, Changement de mot de passe) 
    et assure la livraison des messages via le protocole SMTP pour notifier 
    les administrateurs en temps réel.
===============================================================================
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid # ✨ NOUVEAU : Import pour les en-têtes standards
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USERNAME)

def send_soc_email(destinataire: str, sujet: str, type_alerte: str, message_alerte: str):
    if not SMTP_PASSWORD:
        print("⚠️ [Email] Erreur : Aucun mot de passe SMTP configuré.")
        return

    # 1. Préparation de l'en-tête de l'email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[FleetGuard SOC] {sujet}"
    msg["From"] = f"FleetGuard SecOps <{SENDER_EMAIL}>"
    msg["To"] = destinataire
    
    # ✨ NOUVEAU : En-têtes obligatoires pour rassurer les filtres anti-spam
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="fleetguard-soc.local") 

    # 2. Logique de couleurs (inchangée...)
    couleur_theme = "#3b82f6" 
    icone = "🛡️"
    type_min = type_alerte.lower()
    if "sécurité" in type_min or "malvaillant" in type_min:
        couleur_theme = "#ef4444"
        icone = "🚨"
    elif "mfa" in type_min or "secours" in type_min:
        couleur_theme = "#f59e0b"
        icone = "🔐"
    elif "mot de passe" in type_min:
        couleur_theme = "#10b981"
        icone = "✅"

    # ✨ NOUVEAU : Version Texte Brut (Le fallback exigé par Gmail/Outlook)
    texte_brut = f"""
    FLEETGUARD SOC - ALERTE : {type_alerte}
    
    Sujet : {sujet}
    Message : {message_alerte}
    
    Une action de votre part est requise. Connectez-vous à la console d'administration.
    """
    
    # 3. Le Template HTML (Design SOC Professionnel)
    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; padding: 20px; margin: 0; -webkit-font-smoothing: antialiased;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            
            <!-- En-tête SOC -->
            <tr>
                <td style="background-color: #0B1120; padding: 30px 40px; border-bottom: 3px solid {couleur_theme};">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td>
                                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">FleetGuard <span style="color: {couleur_theme};">SOC</span></h1>
                                <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Security Operations Center</p>
                            </td>
                            <td align="right">
                                <span style="font-size: 28px;">{icone}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            
            <!-- Corps du message -->
            <tr>
                <td style="padding: 40px;">
                    <div style="display: inline-block; padding: 4px 12px; background-color: {couleur_theme}15; color: {couleur_theme}; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; border: 1px solid {couleur_theme}30;">
                        {type_alerte}
                    </div>
                    
                    <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px; font-weight: 700; line-height: 1.3;">{sujet}</h2>
                    
                    <!-- Bloc de log technique (Monospace) -->
                    <div style="background-color: #f8fafc; border-left: 4px solid {couleur_theme}; padding: 20px; margin-bottom: 30px; border-radius: 0 6px 6px 0;">
                        <p style="color: #334155; font-size: 13px; line-height: 1.7; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap;">{message_alerte}</p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0;">
                        Une analyse approfondie et une action de remédiation peuvent être requises. Veuillez vous authentifier sur la console d'administration pour évaluer la télémétrie complète de cet événement.
                    </p>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                            <td align="center">
                                <a href="http://localhost:5173/dashboard" style="background-color: {couleur_theme}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">
                                    Ouvrir la Console SOC
                                </a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            
            <!-- Pied de page -->
            <tr>
                <td style="background-color: #f1f5f9; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Automated Incident Response &bull; FleetGuard
                    </p>
                    <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">
                        Cet email a été généré automatiquement. Si vous n'êtes pas l'administrateur de cette infrastructure, veuillez ignorer ce message.<br>
                        &copy; 2026 iwebCreative Solutions
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    # L'ordre de l'attachement est crucial : texte d'abord, HTML ensuite.
    msg.attach(MIMEText(texte_brut, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    # 4. Envoi sécurisé
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SENDER_EMAIL, destinataire, msg.as_string())
            print(f"✅ [Email Service] Alerte envoyée à {destinataire}")
    except Exception as e:
        print(f"🚨 [Email Service] Échec critique : {str(e)}")