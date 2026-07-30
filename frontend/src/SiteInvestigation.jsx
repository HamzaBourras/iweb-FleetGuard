import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  Globe,
  Activity,
  ShieldAlert,
  Clock,
  UserCheck,
  Server,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Layers, Terminal, Box, Play, Square,
  ChevronLeft,
  ChevronRight,
  Search,
  FileWarning,
  X,
  Check,
  Key,
  Copy,
  ShieldCheck
} from 'lucide-react';

export default function SiteInvestigation() {
  // On récupère la fonction envoyée par le Dashboard
  const { setDynamicSiteName } = useOutletContext() || {};

  const { id } = useParams();
  const navigate = useNavigate();

  // États dynamiques
  const [site, setSite] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  // --- ÉTATS POUR L'INTELLIGENCE DES VERSIONS WP et PHP
  const [officialVersions, setOfficialVersions] = useState({
    wp: null,             // La dernière version exacte de WP
    phpLatest: null,      // La toute dernière version de PHP
    activePhpCycles: []   // Les branches PHP encore sécurisées (ex: ["8.1", "8.2", "8.3"])
  });

  // État pour stocker les alertes reçues de l'agent PHP
  const [alerts, setAlerts] = useState([]);

  // --- ÉTAT POUR LA GESTION DES FAUX POSITIFS ---
  const [whitelistingFile, setWhitelistingFile] = useState(null); // Gère le spinner
  const [fileToWhitelist, setFileToWhitelist] = useState(null);   // Gère l'ouverture de la modale

  // --- ÉTAT POUR LA MODALE DE RÉSULTAT DE SCAN ---
  const [scanResultModal, setScanResultModal] = useState(null); // { title: '...', type: 'audit' | 'malware', text: '...', targetSection: '...' }

  // --- ÉTATS DE PAGINATION ---
  const [pluginPage, setPluginPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const [malwarePage, setMalwarePage] = useState(1);

  // --- ÉTATS POUR LA ROTATION DU TOKEN ---
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [isResettingToken, setIsResettingToken] = useState(false);
  const [newGeneratedToken, setNewGeneratedToken] = useState(null); // Stocke le token en clair
  const [copied, setCopied] = useState(false); // Gère l'animation du bouton copier

  // --- ÉTAT POUR LE SCAN ANTI-MALWARE ---
  const [isScanningMalware, setIsScanningMalware] = useState(false);

  // --- ÉTAT POUR LA SUPPRESSION DE FICHIER ---
  const [deletingFile, setDeletingFile] = useState(null);
  // --- ÉTATS POUR L'UX DE SUPPRESSION ---
  const [fileToDelete, setFileToDelete] = useState(null); // Contient le nom du fichier si la modale est ouverte
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '...' }

  // ÉTATS POUR LA RÉSOLUTION D'ALERTE
  const [alertToResolve, setAlertToResolve] = useState(null); // Contient l'objet alerte si la modale est ouverte
  const [resolvingAlert, setResolvingAlert] = useState(null); // ID de l'alerte en cours d'archivage

  // --- LOGIQUE DE DÉCOUPAGE (PLUGINS) ---
  const plugins = site?.plugins_inventory || [];
  const pluginsPerPage = 6;
  const totalPluginPages = Math.ceil(plugins.length / pluginsPerPage);
  const currentPlugins = plugins.slice(
    (pluginPage - 1) * pluginsPerPage,
    pluginPage * pluginsPerPage
  );

  /// --- LOGIQUE DE DÉCOUPAGE (ALERTES ACTIVES UNIQUEMENT) ---
  // On filtre d'abord pour ne garder que les alertes qui ne sont pas résolues
  const activeAlerts = alerts.filter(alert => alert.status !== 'resolved');

  const alertsPerPage = 4;
  const totalAlertPages = Math.ceil(activeAlerts.length / alertsPerPage);
  const currentAlerts = activeAlerts.slice(
    (alertPage - 1) * alertsPerPage,
    alertPage * alertsPerPage
  );

  // --- LOGIQUE DE DÉCOUPAGE (MALWARES) ---
  const malwares = site?.malware_report || [];
  const malwaresPerPage = 4; // Tu peux ajuster ce nombre
  const totalMalwarePages = Math.ceil(malwares.length / malwaresPerPage);
  const currentMalwares = malwares.slice(
    (malwarePage - 1) * malwaresPerPage,
    malwarePage * malwaresPerPage
  );

  // 🧠 Logique de détection dynamique des vulnérabilités (Hardening)

  // A. Évaluation WordPress
  // On considère WP obsolète si la version du site est différente de la dernière version officielle
  const isWpObsolete = site?.wp_version && officialVersions.wp
    ? site.wp_version !== officialVersions.wp
    : false;

  // B. Évaluation PHP
  // On extrait la branche du site (ex: "7.4.33" devient "7.4")
  const sitePhpCycle = site?.php_version ? site.php_version.split('.').slice(0, 2).join('.') : null;

  // PHP est obsolète si sa branche n'est plus dans la liste des branches maintenues
  const isPhpObsolete = sitePhpCycle && officialVersions.activePhpCycles.length > 0
    ? !officialVersions.activePhpCycles.includes(sitePhpCycle)
    : false;



  // 1. Fonction pour charger les données de l'actif depuis FastAPI
  const fetchSiteInvestigations = async () => {
    const token = localStorage.getItem('fleetguard_token');
    try {
      // On lance les deux requêtes en parallèle pour gagner du temps
      const [siteRes, alertsRes] = await Promise.all([
        fetch(`http://localhost:8000/api/sites/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`http://localhost:8000/api/sites/${id}/alerts`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!siteRes.ok) throw new Error("Impossible de récupérer les détails de l'actif.");

      const siteData = await siteRes.json();
      const alertsData = alertsRes.ok ? await alertsRes.json() : [];

      setSite(siteData);
      setAlerts(alertsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial
  useEffect(() => {
    fetchSiteInvestigations();
  }, [id]);

  // 🎯 Remonte le nom du site vers la barre de navigation parente
  useEffect(() => {
    if (site && site.site_name && setDynamicSiteName) {
      setDynamicSiteName(site.site_name);
    }

    // Fonction de nettoyage quand on quitte la page
    return () => {
      if (setDynamicSiteName) {
        setDynamicSiteName("");
      }
    };
  }, [site, setDynamicSiteName]);

  // 🧠 Renseignement sur les menaces : Récupération depuis le proxy sécurisé FastAPI
  useEffect(() => {
    const fetchThreatIntel = async () => {
      const token = localStorage.getItem('fleetguard_token');
      try {
        const response = await fetch('http://localhost:8000/api/site/threat-intel', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Impossible de récupérer les indicateurs de compromission.");

        const intelData = await response.json();
        setOfficialVersions(intelData);
      } catch (error) {
        console.error("Erreur Threat Intel :", error);
      }
    };

    fetchThreatIntel();
  }, []);

  // Auto-correction de la pagination (Alertes)
  // Si la page actuelle se vide et devient supérieure au total de pages restant, on recule d'une page
  useEffect(() => {
    if (totalAlertPages > 0 && alertPage > totalAlertPages) {
      setAlertPage(totalAlertPages);
    } else if (totalAlertPages === 0 && alertPage !== 1) {
      setAlertPage(1);
    }
  }, [totalAlertPages, alertPage]);

  // 🎯 Auto-correction de la pagination (Malwares)
  // Même logique de sécurité pour les fichiers détruits
  useEffect(() => {
    if (totalMalwarePages > 0 && malwarePage > totalMalwarePages) {
      setMalwarePage(totalMalwarePages);
    } else if (totalMalwarePages === 0 && malwarePage !== 1) {
      setMalwarePage(1);
    }
  }, [totalMalwarePages, malwarePage]);


  // 2. Fonction pour déclencher un scan actif (Active Scanning)
  const handleScan = async () => {
    setIsScanning(true);
    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/scan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Si le code HTTP n'est pas 200 OK, on intercepte l'erreur
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Échec de l'audit : Impossible de communiquer avec la sonde distante.");
      }

      await fetchSiteInvestigations();

      // Ne s'exécute QUE si aucune erreur n'a été levée précédemment
      setScanResultModal({
        title: "Audit d'infrastructure terminé",
        type: "audit",
        text: "La cartographie des composants et de l'inventaire technologique (SBOM) a été mise à jour avec succès.",
        targetSection: "section-plugins"
      });

    } catch (err) {
      // Affichage propre de l'erreur via le composant Toast
      showNotification('error', err.message);
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Fonction pour déclencher le scanner anti-malware
  const handleMalwareScan = async () => {
    setIsScanningMalware(true);
    const token = localStorage.getItem('fleetguard_token');

    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/malware-scan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` } // Correction: Ajout du token manquant
      });

      // Interception stricte des erreurs
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Échec de l'analyse heuristique des fichiers.");
      }

      // On récupère les données fraîches pour compter les menaces
      const siteRes = await fetch(`http://localhost:8000/api/sites/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const siteData = await siteRes.json();
      setSite(siteData);

      const malwareCount = siteData.malware_report?.length || 0;

      // Déclenchement de la modale de résumé (Scanner Anti-Malware)
      setScanResultModal({
        title: "Analyse anti-malware terminée",
        type: "malware",
        text: malwareCount > 0
          ? `Attention : ${malwareCount} fichier(s) suspect(s) ou Web Shell ont été interceptés dans le répertoire des uploads.`
          : "Aucun code malveillant ou obfusqué n'a été détecté dans les zones cibles.",
        targetSection: "section-malware"
      });

    } catch (err) {
      // Remplacement de setError() par une notification flottante
      showNotification('error', err.message);
    } finally {
      setIsScanningMalware(false);
    }
  };

  // Fonction pour défiler vers une section spécifique après la fermeture de la modale
  const handleViewDetails = (sectionId) => {
    setScanResultModal(null);
    scrollToSection(sectionId);
  };


  // 4. Fonctions pour détruire un fichier (Incident Response)
  // A. Affiche une belle notification temporaire (Toast)
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000); // Disparaît après 5 secondes
  };

  // B. Ouvre la modale au lieu de faire un window.confirm
  const initiateDelete = (filePath) => {
    setFileToDelete(filePath);
  };

  // C. Exécute réellement la suppression (Appelée par le bouton de la modale)
  const confirmDeleteMalware = async () => {
    if (!fileToDelete) return;

    const currentFile = fileToDelete;
    setDeletingFile(currentFile);
    setFileToDelete(null); // On ferme la modale immédiatement

    const token = localStorage.getItem('fleetguard_token');

    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/delete-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_path: currentFile })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur inconnue lors de la suppression.');
      }

      await fetchSiteInvestigations(); // On met à jour l'interface
      showNotification('success', 'Le payload a été détruit avec succès du serveur distant.');

    } catch (err) {
      showNotification('error', `Échec de l'intervention : ${err.message}`);
    } finally {
      setDeletingFile(null);
    }
  };


  // 5. Fonction pour archiver (résoudre) une alerte après confirmation
  const confirmResolveAlert = async () => {
    if (!alertToResolve) return;

    const currentAlertId = alertToResolve.id;
    setResolvingAlert(currentAlertId); // Lance l'animation de chargement
    setAlertToResolve(null); // Ferme la modale immédiatement

    const token = localStorage.getItem('fleetguard_token');

    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/alerts/${currentAlertId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la résolution de l\'alerte.');
      }

      await fetchSiteInvestigations(); // Rafraîchit les données et le score
      showNotification('success', 'L\'alerte a été marquée comme résolue et archivée.');
    } catch (err) {
      showNotification('error', err.message);
    } finally {
      setResolvingAlert(null); // Arrête l'animation
    }
  };

  // Fonction pour copier le jeton dans le presse-papier
  const handleCopyToken = () => {
    if (newGeneratedToken) {
      navigator.clipboard.writeText(newGeneratedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Remet le bouton à "Copier" après 2s
    }
  };

  // 6. Fonction pour la rotation du token (Key Rotation)
  const handleRegenerateToken = async () => {
    setIsResettingToken(true);
    const token = localStorage.getItem('fleetguard_token');

    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/regenerate-token`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Échec de la rotation de la clé cryptographique.');
      }

      const data = await response.json();
      await fetchSiteInvestigations(); // Rafraîchit les données du site en arrière-plan

      // ✨ Au lieu de fermer la modale, on affiche le composant de succès
      setNewGeneratedToken(data.new_token);

    } catch (err) {
      showNotification('error', err.message);
      setShowTokenModal(false);
    } finally {
      setIsResettingToken(false);
    }
  };


  // 7. A. Ouvrir la modale de Faux Positif
  const initiateWhitelist = (filePath) => {
    setFileToWhitelist(filePath);
  };

  // 7. B. Fonction pour marquer un fichier comme sain après confirmation
  const confirmWhitelistFile = async () => {
    if (!fileToWhitelist) return;

    const currentFile = fileToWhitelist;
    setWhitelistingFile(currentFile); // Lance l'animation de chargement
    setFileToWhitelist(null); // Ferme la modale immédiatement

    const token = localStorage.getItem('fleetguard_token');

    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/whitelist-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_path: currentFile })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erreur lors du marquage du fichier.');
      }

      await fetchSiteInvestigations(); // Rafraîchit l'interface pour faire disparaître le fichier
      showNotification('success', 'Le fichier a été marqué comme sain (Faux positif).');

    } catch (err) {
      showNotification('error', `Échec de l'opération : ${err.message}`);
    } finally {
      setWhitelistingFile(null); // Arrête l'animation
    }
  };

  // 8. Fonction pour basculer le scan automatique
  const toggleAutoScan = async () => {
    const newValue = !site.auto_scan_enabled;
    const token = localStorage.getItem('fleetguard_token');

    // Mise à jour optimiste de l'UI (pour que le bouton réagisse instantanément)
    setSite({ ...site, auto_scan_enabled: newValue });

    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ auto_scan_enabled: newValue })
      });

      if (!response.ok) throw new Error();

      showNotification('success', `Scan automatique ${newValue ? 'activé (Toutes les 24h)' : 'désactivé'}.`);
    } catch (err) {
      // En cas d'erreur, on annule le changement visuel
      setSite({ ...site, auto_scan_enabled: !newValue });
      showNotification('error', "Impossible de modifier la configuration.");
    }
  };

  // Fonction pour déterminer la couleur du score de santé
  const getHealthColor = (score) => {
    if (score >= 90) return 'text-emerald-500 bg-emerald-50 border-emerald-200';
    if (score >= 70) return 'text-amber-500 bg-amber-50 border-amber-200';
    return 'text-red-500 bg-red-50 border-red-200';
  };

  // Écran de chargement SOC
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-pulse text-slate-500">
      <Server className="w-12 h-12 text-blue-300" />
      <p className="font-medium">Récupération des télémétries de l'actif...</p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 m-8">
      <h3 className="font-bold flex items-center gap-2"><AlertTriangle /> Erreur Forensique</h3>
      <p className="mt-2">{error}</p>
      <button onClick={() => navigate(-1)} className="mt-4 underline font-medium">Retourner à la flotte</button>
    </div>
  );

  const healthStyle = getHealthColor(site.health_score || 0);

  // 🧠 Moteur d'Intelligence Artificielle / Playbook SOC (Incident Response)
  const getPlaybook = (eventType) => {
    const playbooks = {
      'failed_login': {
        danger: "Tentative de compromission d'identifiants (Brute-Force ou Credential Stuffing) ciblant le panneau d'administration wp-admin.",
        action: "1. Implémentez une politique de verrouillage (Rate Limiting) via Fail2Ban ou un plugin. 2. Imposez l'authentification multifacteur (MFA) pour les rôles à privilèges."
      },
      'admin_privilege_granted': {
        danger: "Élévation de privilèges (Privilege Escalation). Un attaquant ou une Backdoor a potentiellement créé/modifié un compte pour obtenir le contrôle total (Admin).",
        action: "1. Auditez immédiatement la table 'wp_users'. 2. Révoquez l'accès du compte suspect. 3. Cherchez le vecteur d'infection initial (plugin vulnérable) dans les logs serveurs."
      },
      'plugin_deactivated': {
        danger: "Technique d'évasion (Defense Evasion). Un attaquant tente de désactiver les mécanismes de défense (WAF, journalisation) pour opérer furtivement.",
        action: "1. Réactivez l'extension critique. 2. Identifiez quelle session administrateur a exécuté cette action. 3. En cas de vol de session, forcez la déconnexion de tous les utilisateurs."
      },
      'admin_email_changed': {
        danger: "Détournement de compte (Account Takeover). L'attaquant redirige les notifications système et les liens de réinitialisation vers sa propre adresse.",
        action: "1. Restaurez l'email légitime dans la base de données (table wp_options). 2. Forcez la rotation des mots de passe pour tous les administrateurs."
      },
      'theme_switched': {
        danger: "Altération de l'interface (Defacement) ou activation d'un thème contenant du code malveillant (Backdoor PHP/JavaScript).",
        action: "1. Rétablissez le thème approuvé. 2. Scannez le dossier 'wp-content/themes' pour détecter des modifications de fichiers (ex: functions.php)."
      },
      'password_reset': {
        danger: "Prise de contrôle ciblée. Si cette action n'a pas été initiée par l'utilisateur légitime, sa boîte mail est potentiellement compromise.",
        action: "1. Contactez l'utilisateur concerné pour confirmation. 2. S'il s'agit d'une attaque, bloquez le compte temporairement et auditez la sécurité de la messagerie."
      },
      'waf_alert_sqli_xss': {
        danger: "Tentative d'exploitation active (SQLi, XSS, LFI) interceptée. L'attaquant cherche à exfiltrer des données ou à exécuter des scripts côté client.",
        action: "1. Identifiez l'URI ciblée dans les logs. 2. Mettez à jour le plugin ou le thème visé. 3. Envisagez de blacklister l'IP source au niveau du pare-feu périmétrique (ex: Cloudflare)."
      },
      'malicious_upload_attempt': {
        danger: "Tentative d'exécution de code à distance (RCE). L'attaquant a essayé de téléverser un Web Shell (Cheval de Troie) sur le serveur.",
        action: "1. Vérifiez les permissions (CHMOD) du dossier 'wp-content/uploads' (doit être 755). 2. Ajoutez un fichier .htaccess pour interdire l'exécution de PHP dans ce répertoire."
      },
      'file_editor_accessed': {
        danger: "Activité de post-exploitation. L'attaquant utilise l'éditeur interne de WordPress pour injecter du code persistant dans le cœur du site sans passer par le FTP.",
        action: "1. Désactivez l'éditeur de fichiers en ajoutant \"define('DISALLOW_FILE_EDIT', true);\" dans le wp-config.php. 2. Inspectez les dernières modifications de code."
      },
      'scanner_detected': {
        danger: "Phase de reconnaissance. Un robot automatisé (Nmap, WPScan, SQLMap) cartographie la surface d'attaque et cherche des CVE connues.",
        action: "1. Assurez-vous que la version de WordPress, de PHP et l'énumération des utilisateurs sont masquées. 2. Configurez le WAF pour bannir automatiquement les User-Agents agressifs."
      }
    };

    return playbooks[eventType] || {
      danger: "Comportement anormal détecté par la sonde télémétrique.",
      action: "Effectuez une analyse forensique des journaux d'accès (access.log) et d'erreurs (error.log) du serveur web autour de cet horodatage."
    };
  };

  // 🎯 Fonction pour défiler doucement vers une section (Version Robuste)
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // scrollIntoView gère automatiquement les conteneurs React imbriqués
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">

      {/* --- EN-TÊTE ET NAVIGATION --- */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6 border-b border-slate-200 pb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-bold mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            {site.site_name || "Cible Inconnue"}
            <span className="bg-slate-100 text-slate-500 py-1 px-3 rounded-md text-sm font-mono border border-slate-200">
              #{site.id}
            </span>
          </h2>
          <a href={site.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 text-sm md:text-base mt-2 flex items-center gap-2 w-fit group">
            <Globe className="w-4 h-4 group-hover:animate-pulse" /> {site.url}
          </a>
        </div>

        {/* ✨ PANNEAU DE CONTRÔLE (ACTIONS SEC OPS) ✨ */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 shadow-inner w-full lg:w-auto mt-4 lg:mt-0">

          {/* Switch Scan Automatique */}
          <div className="flex items-center gap-3 px-4 py-2 border-r border-slate-200/60 mr-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">Scan Auto (24h)</span>
              <span className="text-[10px] text-slate-500 font-medium">Anti-Malware & SBOM</span>
            </div>
            <button
              onClick={toggleAutoScan}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${site?.auto_scan_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${site?.auto_scan_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {/* 3. Bouton Régénérer Token (Key Rotation) */}
          <button
            onClick={() => setShowTokenModal(true)}
            className="relative mg-10 flex items-center justify-center gap-2.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all duration-300 group border border-slate-200 hover:border-indigo-200"
            title="Révocation et génération d'une nouvelle clé d'API"
          >
            <Key className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            <span className="lg:inline">Rotation Token</span>
          </button>

          {/* 1. Bouton Audit Infrastructure */}
          <button
            onClick={handleScan}
            disabled={isScanning || isScanningMalware}
            className="relative flex items-center justify-center gap-2.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group border border-slate-200 hover:border-blue-200"
            title="Cartographier les composants (SBOM) et vérifier l'état du système distant"
          >
            {isScanning ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Activity className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            )}
            {isScanning ? 'Audit en cours...' : 'Scanner d\'infrastructure'}
          </button>

          {/* 2. Bouton Analyse Fichiers (Anti-Malware) */}
          <button
            onClick={handleMalwareScan}
            disabled={isScanningMalware || isScanning}
            className="relative flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group border border-transparent"
            title="Rechercher des Web Shells dans les fichiers"
          >
            {/* Petit indicateur visuel (pulse) pour inciter au clic */}
            {!isScanningMalware && !isScanning && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 shadow"></span>
              </span>
            )}

            <Search className={`w-4 h-4 ${isScanningMalware ? 'animate-spin text-orange-400' : 'text-orange-500 group-hover:-rotate-12 transition-transform'}`} />
            {isScanningMalware ? 'Investigation...' : 'Scanner Anti-Malware'}
          </button>
        </div>
      </div>

      {/* --- LES CARTES DE SCORE ET MÉTRIQUES --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

        {/* Score de Santé */}
        <div className={`rounded-2xl p-6 border shadow-sm flex flex-col justify-between relative overflow-hidden ${healthStyle}`}>
          <div className="absolute -right-6 -top-6 opacity-10">
            <Activity className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <h3 className="font-bold uppercase tracking-wider text-sm opacity-80 mb-1">Score de Santé</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black">{site.health_score || 0}</span>
              <span className="text-xl font-bold opacity-70">/100</span>
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <div className="w-full bg-white/50 rounded-full h-2">
              <div className="h-2 rounded-full bg-current" style={{ width: `${site.health_score || 0}%` }}></div>
            </div>
          </div>
        </div>

        {/* Dernier Login Admin */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-500 font-bold uppercase tracking-wider text-sm">Dernier Login Admin</h3>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><UserCheck className="w-5 h-5" /></span>
          </div>
          <div>
            <div className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              {site.last_admin_login
                ? new Date(site.last_admin_login).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
                : "Aucune donnée"
              }
            </div>
            {site.last_admin_ip && (
              <div className="mt-2 text-sm text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100 inline-block">
                IP: {site.last_admin_ip}
              </div>
            )}
          </div>
        </div>

        {/* Menaces Récentes */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-500 font-bold uppercase tracking-wider text-sm">Menaces Récentes</h3>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg"><ShieldAlert className="w-5 h-5" /></span>
          </div>

          <div className="flex items-center gap-6 mt-1">
            {/* Métrique 1 : Alertes Actives (Mise en évidence) */}
            <div>
              <div className="text-4xl font-black text-red-600">{activeAlerts.length}</div>
              <div className="mt-1.5 text-xs text-red-500 font-bold uppercase tracking-wider">
                Actions requises
              </div>
            </div>

            {/* Séparateur visuel */}
            <div className="w-px h-12 bg-slate-200"></div>

            {/* Métrique 2 : Total Historique */}
            <div>
              <div className="text-2xl font-black text-slate-700">{alerts.length}</div>
              <div className="mt-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                Total intercepté
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* NAVBAR INTERNE (STICKY)                                   */}
      {/* ========================================================= */}
      <div className="sticky top-4 z-40 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-center gap-2 mx-auto w-fit transition-all">
        <button
          onClick={() => scrollToSection('section-plugins')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
        >
          <Layers className="w-4 h-4" /> Extensions (SBOM)
        </button>
        <button
          onClick={() => scrollToSection('section-alerts')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
        >
          <AlertTriangle className="w-4 h-4" /> Dangers & Alertes
        </button>
        <button
          onClick={() => scrollToSection('section-malware')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
        >
          <FileWarning className="w-4 h-4" /> Scanner des fichiers
        </button>
      </div>

      {/* --- ZONE 3 : SBOM (Inventaire Technologique) --- */}
      <div id="section-plugins" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-bold text-slate-800">Inventaire Technologique (SBOM)</h3>
          </div>
          <span className="text-sm font-medium text-slate-500 bg-slate-200/50 px-3 py-1 rounded-full">
            {plugins.length} extensions détectées
          </span>
        </div>

        <div className="p-6">
          {/* Noyau & Serveur */}
          {/* Noyau & Serveur */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">

            {/* Version WordPress */}
            <div className={`flex flex-col justify-center p-4 border rounded-xl ${isWpObsolete ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Globe className={`w-5 h-5 ${isWpObsolete ? 'text-orange-500' : 'text-slate-400'}`} />
                  <div>
                    <p className={`text-sm font-bold ${isWpObsolete ? 'text-orange-700' : 'text-slate-700'}`}>Noyau WordPress</p>
                    {isWpObsolete && <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mt-0.5">Mise à jour requise</p>}
                  </div>
                </div>
                <span className={`font-mono font-bold px-3 py-1.5 rounded text-sm ${isWpObsolete ? 'bg-orange-200 text-orange-800' : 'bg-slate-100 text-slate-700'}`}>
                  {site?.wp_version ? `v${site.wp_version}` : 'Inconnue'}
                </span>
              </div>
              {/* Ligne de comparaison intelligente */}
              {officialVersions.wp && isWpObsolete && (
                <div className="text-xs text-orange-600/80 font-medium border-t border-orange-200/50 pt-2 mt-1">
                  Dernière version sécurisée : <strong className="font-mono">v{officialVersions.wp}</strong>
                </div>
              )}
            </div>

            {/* Version PHP avec alerte si obsolète */}
            <div className={`flex flex-col justify-center p-4 border rounded-xl ${isPhpObsolete ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Terminal className={`w-5 h-5 ${isPhpObsolete ? 'text-red-500' : 'text-slate-400'}`} />
                  <div>
                    <p className={`text-sm font-bold ${isPhpObsolete ? 'text-red-700' : 'text-slate-700'}`}>Environnement PHP</p>
                    {isPhpObsolete && <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mt-0.5">Fin de vie (Vulnérable)</p>}
                  </div>
                </div>
                <span className={`font-mono font-bold px-3 py-1.5 rounded text-sm ${isPhpObsolete ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                  {site?.php_version || 'Inconnue'}
                </span>
              </div>
              {/* Ligne de comparaison intelligente */}
              {officialVersions.phpLatest && isPhpObsolete && (
                <div className="text-xs text-red-600/80 font-medium border-t border-red-200/50 pt-2 mt-1">
                  Branche active recommandée : <strong className="font-mono">v{officialVersions.activePhpCycles[0]}</strong> (ou <span className="font-mono">{officialVersions.phpLatest}</span>)
                </div>
              )}
            </div>

          </div>

          {/* Liste des Plugins */}
          <div>
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Box className="w-4 h-4 text-slate-400" /> Cartographie des Extensions
            </h4>

            {plugins.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                Aucune extension détectée ou le scan n'a pas encore été lancé.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nom de l'extension</th>
                      <th className="px-4 py-3 font-semibold w-32">Version</th>
                      <th className="px-4 py-3 font-semibold w-32 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentPlugins.map((plugin, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {plugin.name}
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{plugin.path.split('/')[0]}</div>
                        </td>
                        {/* ✨ NOUVELLE VERSION avec alerte visuelle : */}
                        <td className="px-4 py-3 font-mono text-xs">
                          {plugin.has_update ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-red-500 font-bold line-through" title="Version obsolète">
                                v{plugin.version}
                              </span>
                              <span className="text-emerald-500 font-black text-[10px]" title="Nouvelle version disponible">
                                ➜ v{plugin.new_version}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">v{plugin.version}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {plugin.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                              <Play className="w-3 h-3" /> Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                              <Square className="w-3 h-3" /> Inactif
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ✨ NOUVEAU : Contrôles de pagination pour les plugins */}
                {totalPluginPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                      onClick={() => setPluginPage(prev => Math.max(prev - 1, 1))}
                      disabled={pluginPage === 1}
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:text-blue-600 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Précédent
                    </button>
                    <span className="text-sm text-slate-500 font-medium">
                      Page {pluginPage} sur {totalPluginPages}
                    </span>
                    <button
                      onClick={() => setPluginPage(prev => Math.min(prev + 1, totalPluginPages))}
                      disabled={pluginPage === totalPluginPages}
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:text-blue-600 transition-colors"
                    >
                      Suivant <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* --- ZONE : DANGERS & RECOMMANDATIONS FORENSIQUES --- */}
      <div id="section-alerts" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-bold text-slate-800">Dangers & Recommandations</h3>
          </div>
          <span className="text-sm font-medium text-slate-500 bg-slate-200/50 px-3 py-1 rounded-full">
            {activeAlerts.length} événement(s) nécessitant une action
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {alerts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-bold text-slate-700">Aucune menace détectée</p>
              <p className="text-sm mt-1">L'infrastructure de ce site semble saine.</p>
            </div>
          ) : (
            currentAlerts.map((alert) => {
              const playbook = getPlaybook(alert.event_type);
              return (
                <div key={alert.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                  {/* Entête de l'alerte */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {alert.severity === 'critical' && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded border border-red-200">CRITIQUE</span>}
                        {alert.severity === 'high' && <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded border border-orange-200">ÉLEVÉ</span>}
                        {alert.severity === 'medium' && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded border border-amber-200">MOYEN</span>}
                        <span className="text-sm font-mono text-slate-500">{alert.ip_address}</span>
                      </div>
                      <h4 className="font-bold text-slate-800">{alert.message}</h4>
                    </div>
                    <div className="text-sm font-medium text-slate-400 whitespace-nowrap">
                      {new Date(alert.timestamp).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <button
                      onClick={() => setAlertToResolve(alert)}
                      disabled={resolvingAlert === alert.id}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors disabled:opacity-50"
                    >
                      {resolvingAlert === alert.id ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Archivage...</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /> Marquer comme résolu</>
                      )}
                    </button>
                  </div>

                  {/* Bloc Forensique & Remédiation */}
                  <div className="bg-slate-900 rounded-xl p-4 md:p-5 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Diagnostic */}
                      <div>
                        <h5 className="text-red-400 text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4" /> Analyse de la Menace
                        </h5>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {playbook.danger}
                        </p>
                      </div>

                      {/* Action requise */}
                      <div className="border-t md:border-t-0 md:border-l border-slate-700 pt-4 md:pt-0 md:pl-6">
                        <h5 className="text-emerald-400 text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Activity className="w-4 h-4" /> Remédiation Conseillée
                        </h5>
                        <p className="text-slate-300 text-sm leading-relaxed font-medium">
                          {playbook.action}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Contrôles de pagination pour les alertes */}
        {totalAlertPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setAlertPage(prev => Math.max(prev - 1, 1))}
              disabled={alertPage === 1}
              className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-40 hover:text-orange-600"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </button>
            <span className="text-sm text-slate-500 font-medium">
              Page {alertPage} sur {totalAlertPages}
            </span>
            <button
              onClick={() => setAlertPage(prev => Math.min(prev + 1, totalAlertPages))}
              disabled={alertPage === totalAlertPages}
              className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-40 hover:text-orange-600"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* --- ZONE : RAPPORT DE SCAN ANTI-MALWARE --- */}
      <div id="section-malware" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className={`p-6 border-b flex items-center justify-between ${site?.malware_report?.length > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <FileWarning className={`w-6 h-6 ${site?.malware_report?.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <h3 className="text-lg font-bold text-slate-800">Scanner de Fichiers Heuristique</h3>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${site?.malware_report?.length > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {site?.malware_report?.length || 0} fichier(s) suspect(s)
          </span>
        </div>

        <div className="p-6">
          {!site?.malware_report || site.malware_report.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-emerald-600">
              <CheckCircle2 className="w-10 h-10 mb-2 opacity-80" />
              <p className="font-bold">Système de fichiers sain</p>
              <p className="text-sm opacity-70">Aucun Web Shell ou code obfusqué n'a été détecté lors de la dernière analyse.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ✨ MODIFICATION ICI : On mappe sur currentMalwares au lieu de site.malware_report */}
              {/* Liste des fichiers suspects */}
              {currentMalwares.map((file, index) => (
                <div key={index} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl gap-4">

                  {/* Infos sur le fichier */}
                  <div>
                    <h4 className="font-bold text-red-800 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> {file.threat}
                    </h4>
                    <p className="font-mono text-sm text-red-600 mt-1 bg-white px-2 py-1 rounded border border-red-100 w-fit shadow-sm break-all">
                      {file.file}
                    </p>
                  </div>

                  {/* Boutons d'action (Whitelist + Destruction) */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 mt-2 md:mt-0">

                    {/* Bouton Ignorer / Faux Positif */}
                    <button
                      onClick={() => initiateWhitelist(file.file)}
                      disabled={deletingFile === file.file || whitelistingFile === file.file}
                      title="Marquer comme sain et ignorer lors des prochains scans"
                      className="bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-1 md:flex-none justify-center"
                    >
                      {whitelistingFile === file.file ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      <span className="whitespace-nowrap">Marquer Sain</span>
                    </button>

                    {/* Bouton Destruction */}
                    <button
                      onClick={() => initiateDelete(file.file)}
                      disabled={deletingFile === file.file || whitelistingFile === file.file}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-1 md:flex-none justify-center"
                    >
                      {deletingFile === file.file ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Destruction...</>
                      ) : (
                        'Détruire'
                      )}
                    </button>

                  </div>
                </div>
              ))}

              {/*  Contrôles de pagination pour les malwares */}
              {totalMalwarePages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-red-100">
                  <button
                    onClick={() => setMalwarePage(prev => Math.max(prev - 1, 1))}
                    disabled={malwarePage === 1}
                    className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-40 hover:text-red-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Précédent
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    Page {malwarePage} sur {totalMalwarePages}
                  </span>
                  <button
                    onClick={() => setMalwarePage(prev => Math.min(prev + 1, totalMalwarePages))}
                    disabled={malwarePage === totalMalwarePages}
                    className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-40 hover:text-red-600 transition-colors"
                  >
                    Suivant <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ========================================================= */}
      {/* MODALE DE CONFIRMATION (UX)                               */}
      {/* ========================================================= */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden scale-100 transition-transform">
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-red-800">Intervention Critique</h3>
                <p className="text-red-600 text-sm mt-1">Vous êtes sur le point de détruire définitivement ce fichier sur le serveur distant.</p>
              </div>
            </div>
            <div className="p-6 bg-white">
              <p className="text-sm font-bold text-slate-700 mb-2">Fichier ciblé :</p>
              <p className="font-mono text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100 break-all shadow-inner">
                {fileToDelete}
              </p>
              <p className="text-slate-500 text-sm mt-4 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Cette action est irréversible.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteMalware}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <FileWarning className="w-4 h-4" /> Confirmer la destruction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION (Succès / Erreur)                      */}
      {/* ========================================================= */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300 transform translate-y-0 opacity-100">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border-l-4 ${notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
            : 'bg-red-50 border-red-500 text-red-800'
            }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <p className="text-sm font-bold pr-4">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE DE CONFIRMATION (RÉSOLUTION D'ALERTE)              */}
      {/* ========================================================= */}
      {alertToResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden scale-100 transition-transform">
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-start gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-emerald-800">Archiver l'alerte</h3>
                <p className="text-emerald-600 text-sm mt-1">Vous êtes sur le point de marquer cet événement de sécurité comme résolu.</p>
              </div>
            </div>
            <div className="p-6 bg-white">
              <p className="text-sm font-bold text-slate-700 mb-2">Détails de l'alerte :</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800">{alertToResolve.message}</p>
                <p className="text-xs text-slate-500 mt-1 font-mono">IP Cible: {alertToResolve.ip_address}</p>
              </div>
              <p className="text-slate-500 text-sm mt-4 font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                Elle sera retirée de la vue principale mais conservée dans votre historique.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setAlertToResolve(null)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmResolveAlert}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Confirmer la résolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* POP-UP DE SYNTHÈSE DES RÉSULTATS DE SCAN                  */}
      {/* ========================================================= */}
      {scanResultModal && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4 drop-shadow-2xl animate-popup-slide">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden ring-1 ring-black/5">
            <div className={`p-5 border-b flex items-start gap-4 ${scanResultModal.type === 'malware' && site?.malware_report?.length > 0
              ? 'bg-red-50 border-red-100 text-red-800'
              : 'bg-blue-50 border-blue-100 text-blue-800'
              }`}>
              <div className={`p-2.5 rounded-full shrink-0 ${scanResultModal.type === 'malware' && site?.malware_report?.length > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-blue-100 text-blue-600'
                }`}>
                {scanResultModal.type === 'malware' ? <FileWarning className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-black leading-tight">{scanResultModal.title}</h3>
                <p className="text-xs opacity-80 mt-0.5">Rapport de télémétrie instantané</p>
              </div>
            </div>

            <div className="p-5 bg-white">
              <p className="text-slate-700 text-sm leading-relaxed font-medium">
                {scanResultModal.text}
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setScanResultModal(null)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg text-sm transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => handleViewDetails(scanResultModal.targetSection)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm shadow-sm transition-colors flex items-center gap-2"
              >
                Voir le résultat <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE DE ROTATION DU TOKEN (CONFIRMATION & SUCCÈS)         */}
      {/* ========================================================= */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Fond sombre */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
            onClick={() => !isResettingToken && !newGeneratedToken && setShowTokenModal(false)}
          ></div>

          <div className="relative bg-white rounded-2xl md:rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden transform transition-all animate-in zoom-in-[0.97] fade-in duration-300 border border-slate-100 max-h-[90vh] overflow-y-auto z-10">

            {newGeneratedToken ? (
              /* --- ÉCRAN DE SUCCÈS (Affichage du Token) --- */
              <div className="p-6 md:p-8">
                <div className="mx-auto w-12 h-12 md:w-16 md:h-16 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4 md:mb-6 shadow-sm relative">
                  <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-20 duration-1000"></span>
                  <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 relative z-10" />
                </div>

                <h3 className="text-xl md:text-2xl font-black text-center text-slate-800 tracking-tight mb-1 md:mb-2">Rotation Réussie</h3>
                <p className="text-center text-slate-500 mb-6 md:mb-8 text-xs md:text-sm font-medium">Le nouveau jeton de communication a été généré.</p>

                <div className="bg-amber-50/80 border border-amber-200/60 p-3 md:p-4 mb-4 md:mb-6 rounded-xl md:rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                  <h4 className="text-xs md:text-sm font-bold text-amber-900 mb-1 flex items-center gap-1.5 md:gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-600 shrink-0" />
                    Sauvegarde Cryptographique Requise
                  </h4>
                  <p className="text-[10px] md:text-xs text-amber-800/80 leading-relaxed ml-5 md:ml-6">
                    Copiez ce jeton pour configurer l'agent distant.
                    <span className="block mt-1 font-bold text-amber-900">Il ne sera affiché qu'une seule fois.</span>
                  </p>
                </div>

                <div className="bg-[#0B1120] p-1 md:p-1.5 rounded-xl md:rounded-2xl flex items-center justify-between gap-2 md:gap-3 mb-6 md:mb-8 shadow-inner ring-1 ring-slate-800/50">
                  <code className="text-emerald-400 font-mono text-xs md:text-sm pl-3 md:pl-4 overflow-x-auto whitespace-nowrap scrollbar-hide select-all py-2 md:py-0">
                    {newGeneratedToken}
                  </code>
                  <button
                    onClick={handleCopyToken}
                    className={`p-2 md:p-2.5 rounded-lg md:rounded-xl transition-all duration-300 shrink-0 flex items-center gap-1.5 md:gap-2 font-bold text-xs md:text-sm ${copied
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    title="Copier le jeton"
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Copié</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Copier</span></>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowTokenModal(false);
                    setNewGeneratedToken(null); // On purge le token de la mémoire front
                  }}
                  className="w-full px-4 py-3 md:py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-sm md:text-base rounded-xl transition-colors ring-1 ring-slate-200/60"
                >
                  Terminer
                </button>
              </div>
            ) : (
              /* --- ÉCRAN DE CONFIRMATION (Avertissement) --- */
              <>
                <div className="p-6 bg-indigo-50 border-b border-indigo-100 flex items-start gap-4">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full shrink-0">
                    <Key className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-indigo-900">Rotation des Clés (Key Rotation)</h3>
                    <p className="text-indigo-700 text-sm mt-1">Vous allez révoquer le token de sécurité actuel de ce site.</p>
                  </div>
                </div>

                <div className="p-6 bg-white">
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4" /> Coupure de communication
                    </h4>
                    <p className="text-sm text-amber-700 mt-2 font-medium leading-relaxed">
                      Dès que vous confirmerez, l'ancienne clé sera détruite. La sonde télémétrique installée sur le site WordPress ne pourra plus envoyer d'alertes tant que vous n'aurez pas mis à jour sa configuration avec le nouveau token.
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                    disabled={isResettingToken}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRegenerateToken}
                    disabled={isResettingToken}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isResettingToken ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Génération...</>
                    ) : (
                      <><Key className="w-4 h-4" /> Confirmer la Rotation</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALE DE CONFIRMATION (FAUX POSITIF / WHITELIST)         */}
      {/* ========================================================= */}
      {fileToWhitelist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden scale-100 transition-transform">
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-start gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-emerald-800">Validation Forensique</h3>
                <p className="text-emerald-600 text-sm mt-1">Vous êtes sur le point de marquer ce fichier comme légitime (Faux Positif).</p>
              </div>
            </div>
            <div className="p-6 bg-white">
              <p className="text-sm font-bold text-slate-700 mb-2">Fichier concerné :</p>
              <p className="font-mono text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded border border-emerald-100 break-all shadow-inner">
                {fileToWhitelist}
              </p>
              <p className="text-slate-500 text-sm mt-4 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Il sera ignoré lors des prochains scans anti-malware.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setFileToWhitelist(null)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmWhitelistFile}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Confirmer comme sain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}