"""
Module : url_validator.py
Rôle : Empêche les attaques SSRF en validant les URLs fournies par l'utilisateur
 avant que le backend n'effectue une requête HTTP vers elles.
"""
import ipaddress
import socket
from urllib.parse import urlparse

# Plages d'adresses interdites (réseaux privés, loopback, lien-local, métadonnées cloud)
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"), # loopback
    ipaddress.ip_network("10.0.0.0/8"), # privé
    ipaddress.ip_network("172.16.0.0/12"), # privé
    ipaddress.ip_network("192.168.0.0/16"), # privé
    ipaddress.ip_network("169.254.0.0/16"), # lien-local (métadonnées cloud AWS/GCP/Azure)
    ipaddress.ip_network("::1/128"), # loopback IPv6
    ipaddress.ip_network("fc00::/7"), # IPv6 privé
    ipaddress.ip_network("fe80::/10"), # IPv6 lien-local
]

class UnsafeUrlError(Exception):
    """Levée quand une URL est jugée dangereuse (SSRF potentiel)."""
    pass

def validate_public_url(url: str) -> str:
    """
    Vérifie que l'URL :
    - utilise le schéma http ou https,
    - a un nom d'hôte résolvable,
    - ne pointe pas vers une IP privée/locale/interne.
    Renvoie l'URL si elle est valide, lève UnsafeUrlError sinon.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("Seuls les schémas http et https sont autorisés.")
    
    hostname = parsed.hostname
    if not hostname:
        raise UnsafeUrlError("URL invalide : aucun nom d'hôte détecté.")
    
    # Interdiction explicite des alias locaux courants
    if hostname.lower() in ("localhost",):
        raise UnsafeUrlError("Les URLs pointant vers localhost sont interdites.")
    
    try:
        # Résolution DNS -> on récupère toutes les IP possibles pour ce nom de domaine
        resolved_ips = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise UnsafeUrlError("Impossible de résoudre le nom de domaine fourni.")
    
    for family, _, _, _, sockaddr in resolved_ips:
        ip_str = sockaddr[0]
        ip_obj = ipaddress.ip_address(ip_str)
        
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
            # Étape 2 : l'utiliser à la création du site
            raise UnsafeUrlError(
                f"L'URL résout vers une adresse IP interne/privée ({ip_str}), ce qui est interdit."
            )
            
        for network in BLOCKED_NETWORKS:
            if ip_obj in network:
                raise UnsafeUrlError(
                    f"L'URL résout vers une plage d'adresses bloquée ({ip_str})."
                )
                
    return url