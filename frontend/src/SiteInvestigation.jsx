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
  X
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

  // État pour stocker les alertes reçues de l'agent PHP
  const [alerts, setAlerts] = useState([]);

  // --- ÉTATS DE PAGINATION ---
  const [pluginPage, setPluginPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const [malwarePage, setMalwarePage] = useState(1);

  // --- ÉTAT POUR LE SCAN ANTI-MALWARE ---
  const [isScanningMalware, setIsScanningMalware] = useState(false);

  // --- ÉTAT POUR LA SUPPRESSION DE FICHIER ---
  const [deletingFile, setDeletingFile] = useState(null);
  // --- ÉTATS POUR L'UX DE SUPPRESSION ---
  const [fileToDelete, setFileToDelete] = useState(null); // Contient le nom du fichier si la modale est ouverte
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '...' }

  // --- LOGIQUE DE DÉCOUPAGE (PLUGINS) ---
  const plugins = site?.plugins_inventory || [];
  const pluginsPerPage = 6;
  const totalPluginPages = Math.ceil(plugins.length / pluginsPerPage);
  const currentPlugins = plugins.slice(
    (pluginPage - 1) * pluginsPerPage,
    pluginPage * pluginsPerPage
  );

  // --- LOGIQUE DE DÉCOUPAGE (ALERTES) ---
  const alertsPerPage = 4;
  const totalAlertPages = Math.ceil(alerts.length / alertsPerPage);
  const currentAlerts = alerts.slice(
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

  // 🧠 Logique de détection des versions obsolètes (Hardening)
  const isPhpObsolete = site?.php_version && (site.php_version.startsWith('7.') || site.php_version.startsWith('5.'));

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

  // 2. Fonction pour déclencher un scan actif (Active Scanning)
  const handleScan = async () => {
    setIsScanning(true);
    const token = localStorage.getItem('fleetguard_token');
    try {
      // Appel à une future route FastAPI qui va contacter l'agent PHP
      const response = await fetch(`http://localhost:8000/api/sites/${id}/scan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Échec de la communication avec la sonde distante.");

      // Si le scan réussit, on rafraîchit les données affichées
      await fetchSiteInvestigations();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsScanning(false);
    }
  };


  // 3. Fonction pour déclencher un scan anti-malware (Malware Scanning)
  const handleMalwareScan = async () => {
    setIsScanningMalware(true);
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}/malware-scan`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Échec de la communication lors de l\'analyse des fichiers.');
      }

      // On rafraîchit les données du site pour afficher le nouveau rapport
      await fetchSiteInvestigations();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsScanningMalware(false);
    }
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

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">

      {/* --- EN-TÊTE ET NAVIGATION --- */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-slate-200 pb-6">
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

        {/* ✨ BOUTON DE SCAN ACTIF ✨ */}
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 md:w-auto w-full group disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <><RefreshCw className="w-5 h-5 animate-spin" /> Analyse en cours...</>
          ) : (
            <><Activity className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" /> Scanner l'infrastructure</>
          )}
        </button>

        {/* ✨ BOUTON : EDR / Anti-Malware */}
        <button
          onClick={handleMalwareScan}
          disabled={isScanningMalware || isScanning}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
        >
          <Search className={`w-4 h-4 ${isScanningMalware ? 'animate-spin' : ''}`} />
          {isScanningMalware ? 'Investigation en cours...' : 'Analyse Profonde (Fichiers)'}
        </button>
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
          <div>
            <div className="text-4xl font-black text-slate-800">{site.alerts_count || 0}</div>
            <div className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
              Alertes interceptées
            </div>
          </div>
        </div>

      </div>

      {/* --- ZONE 3 : SBOM (Inventaire Technologique) --- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            {/* Version WordPress */}
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-slate-50/30">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Noyau WordPress</p>
                  <p className="text-xs text-slate-500">CMS</p>
                </div>
              </div>
              <span className="font-mono font-bold bg-slate-100 px-3 py-1.5 rounded text-slate-700 text-sm">
                {site?.wp_version ? `v${site.wp_version}` : 'Inconnue'}
              </span>
            </div>

            {/* Version PHP avec alerte si obsolète */}
            <div className={`flex items-center justify-between p-4 border rounded-xl ${isPhpObsolete ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50/30'}`}>
              <div className="flex items-center gap-3">
                <Terminal className={`w-5 h-5 ${isPhpObsolete ? 'text-red-500' : 'text-slate-400'}`} />
                <div>
                  <p className={`text-sm font-bold ${isPhpObsolete ? 'text-red-700' : 'text-slate-700'}`}>Environnement PHP</p>
                  {isPhpObsolete && <p className="text-xs text-red-500 font-semibold mt-0.5">Obsolète (Fin de vie)</p>}
                </div>
              </div>
              <span className={`font-mono font-bold px-3 py-1.5 rounded text-sm ${isPhpObsolete ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                {site?.php_version || 'Inconnue'}
              </span>
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-bold text-slate-800">Dangers & Recommandations</h3>
          </div>
          <span className="text-sm font-medium text-slate-500 bg-slate-200/50 px-3 py-1 rounded-full">
            {alerts.length} événements enregistrés
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
        {/* ✨ NOUVEAU : Contrôles de pagination pour les alertes */}
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
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
              {currentMalwares.map((file, index) => (
                <div key={index} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div>
                    <h4 className="font-bold text-red-800 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> {file.threat}
                    </h4>
                    <p className="font-mono text-sm text-red-600 mt-1 bg-white px-2 py-1 rounded border border-red-100 w-fit shadow-sm break-all">
                      {file.file}
                    </p>
                  </div>
                  <button
                    onClick={() => initiateDelete(file.file)}
                    disabled={deletingFile === file.file}
                    className="mt-4 md:mt-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    {deletingFile === file.file ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Destruction...</>
                    ) : (
                      'Détruire le fichier'
                    )}
                  </button>
                </div>
              ))}

              {/* ✨ NOUVEAU : Contrôles de pagination pour les malwares */}
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
    </div>
  );
}