import { useState, useEffect } from 'react';

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

    // Optionnel mais recommandé : rafraîchir les alertes toutes les 30 secondes
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fonction utilitaire pour le code couleur des sévérités
  const getSeverityBadge = (severity) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-bold border border-red-200 animate-pulse">CRITIQUE</span>;
      case 'high':
        return <span className="bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full text-xs font-bold border border-orange-200">ÉLEVÉE</span>;
      case 'medium':
        return <span className="bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-full text-xs font-bold border border-yellow-200">MOYENNE</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-200">INFO</span>;
    }
  };

  if (isLoading) return <div className="text-gray-500 animate-pulse p-6">Analyse des flux de sécurité...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          🚨 Journal des Menaces
          <span className="bg-gray-200 text-gray-700 py-0.5 px-2 rounded-full text-xs font-bold">
            {alerts.length} événements
          </span>
        </h3>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 border-b border-red-100 font-medium">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
              <th className="px-6 py-4 font-semibold">Date / Heure</th>
              <th className="px-6 py-4 font-semibold">Sévérité</th>
              <th className="px-6 py-4 font-semibold">Type d'Attaque</th>
              <th className="px-6 py-4 font-semibold">IP Source</th>
              <th className="px-6 py-4 font-semibold">Site Cible</th>
              <th className="px-6 py-4 font-semibold">Détails techniques</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {alerts.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  <p className="font-medium text-lg text-gray-400 mb-1">Aucune menace détectée</p>
                  <p className="text-sm">Le périmètre est actuellement sécurisé.</p>
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-50 transition-colors font-mono text-sm">
                  <td className="px-6 py-4 text-gray-500">
                    {/* Formatage basique de la date. Ajuste selon le format stocké en BDD */}
                    {new Date(alert.timestamp || Date.now()).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-6 py-4">{getSeverityBadge(alert.severity)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{alert.event_type}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {alert.ip_address || 'Inconnue'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                      {alert.site_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={alert.message}>
                    {alert.message}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}