import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Clock, 
  Terminal, 
  Network, 
  Globe, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      const token = localStorage.getItem('fleetguard_token');
      try {
        const response = await fetch('http://localhost:8000/api/alerts', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Impossible de charger les logs de sécurité.");

        const data = await response.json();
        setAlerts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();

    // Rafraîchissement silencieux toutes les 30 secondes
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✨ UI/UX : Badges de sévérité optimisés avec lueurs et icônes
  const getSeverityBadge = (severity) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-red-500/30 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            CRITIQUE
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-orange-500/30">
            <AlertTriangle className="w-3 h-3" /> ÉLEVÉE
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-amber-500/30">
            MOYENNE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-blue-500/30">
            INFO
          </span>
        );
    }
  };

  // État de chargement SOC
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-pulse text-slate-500">
      <ShieldAlert className="w-12 h-12 text-slate-300" />
      <p className="font-medium tracking-wide uppercase text-sm">Analyse des flux de sécurité...</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* --- EN-TÊTE --- */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            Journal des Alertes
            <span className="bg-red-100 text-red-700 py-1 px-3 rounded-full text-xs font-black tracking-widest ring-1 ring-red-500/20 shadow-sm">
              {alerts.length} ALERTES
            </span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">Flux d'analyse iwebCreative Security Agent en temps réel.</p>
        </div>
        
        {/* Indicateur Live */}
        <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-mono text-xs font-bold border border-slate-200">
          <Activity className="w-3.5 h-3.5 animate-pulse text-blue-500" />
          SYNCHRONISÉ
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-lg font-medium flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* --- TABLEAU DES ALERTES --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-300 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold flex items-center gap-2"><Clock className="w-4 h-4"/> Horodatage</th>
                <th className="px-6 py-4 font-semibold">Sévérité</th>
                <th className="px-6 py-4 font-semibold"><Activity className="w-4 h-4 inline mr-1"/> Signature</th>
                <th className="px-6 py-4 font-semibold"><Network className="w-4 h-4 inline mr-1"/> IP Source</th>
                <th className="px-6 py-4 font-semibold"><Globe className="w-4 h-4 inline mr-1"/> Cible</th>
                <th className="px-6 py-4 font-semibold"><Terminal className="w-4 h-4 inline mr-1"/> Détails Techniques</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50/50">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      </div>
                      <p className="font-bold text-lg text-slate-800 mb-1">Périmètre Sécurisé</p>
                      <p className="text-sm text-slate-500">Aucune activité malveillante détectée sur l'infrastructure.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="group hover:bg-slate-50 transition-colors duration-200">
                    
                    {/* Date */}
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {new Date(alert.timestamp || Date.now()).toLocaleString('fr-FR', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </td>
                    
                    {/* Sévérité */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSeverityBadge(alert.severity)}
                    </td>
                    
                    {/* Type / Signature */}
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700 text-sm">{alert.event_type}</span>
                    </td>
                    
                    {/* IP Source */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-slate-100/80 text-slate-600 px-2.5 py-1 rounded-md font-mono text-xs border border-slate-200/60 transition-colors group-hover:bg-white group-hover:border-slate-300">
                        {alert.ip_address || 'Inconnue'}
                      </span>
                    </td>
                    
                    {/* Site Cible */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md text-xs border border-blue-100">
                        {alert.site_name}
                      </span>
                    </td>
                    
                    {/* Détails techniques (Sans troncature pour l'analyse) */}
                    <td className="px-6 py-4">
                      <div className="bg-slate-900 text-slate-300 p-2.5 rounded-lg font-mono text-xs break-words whitespace-pre-wrap min-w-[300px] leading-relaxed shadow-inner">
                        <span className="text-emerald-400 mr-2">❯</span> 
                        {alert.message}
                      </div>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}