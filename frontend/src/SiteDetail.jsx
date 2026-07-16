import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Globe, 
  Activity, 
  ShieldAlert, 
  Clock, 
  UserCheck,
  Server,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export default function SiteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // États dynamiques
  const [site, setSite] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  // 1. Fonction pour charger les données de l'actif depuis FastAPI
  const fetchSiteDetails = async () => {
    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Impossible de récupérer les détails de l'actif.");
      const data = await response.json();
      setSite(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial
  useEffect(() => {
    fetchSiteDetails();
  }, [id]);

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
      await fetchSiteDetails();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsScanning(false);
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

      {/* --- ZONE RÉSERVÉE POUR LES RECOMMANDATIONS --- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-bold text-slate-800">Dangers & Recommandations</h3>
        </div>
        <div className="p-12 text-center text-slate-500">
          <Server className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-medium">Zone d'analyse forensique</p>
          <p className="text-sm mt-1">Les détails des vulnérabilités et les correctifs s'afficheront ici.</p>
        </div>
      </div>

    </div>
  );
}