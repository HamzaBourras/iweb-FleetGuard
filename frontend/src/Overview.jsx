import { useState, useEffect } from 'react';

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // 1. On récupère le badge d'accès
      const token = localStorage.getItem('fleetguard_token');
      
      try {
        // 2. On envoie la requête avec le token dans l'en-tête
        const response = await fetch('http://localhost:8000/api/dashboard/stats', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`, // C'est LA ligne vitale pour la sécurité
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Accès refusé : Session expirée ou token invalide.");
          }
          throw new Error("Erreur de communication avec le serveur.");
        }

        const data = await response.json();
        setStats(data);

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []); // Le tableau vide signifie que ça s'exécute une seule fois au chargement du composant

  // Affichage pendant le chargement
  if (isLoading) {
    return <div className="text-gray-500 animate-pulse p-6">Analyse des systèmes en cours...</div>;
  }

  // Affichage en cas d'erreur (ex: token expiré)
  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-xl border border-red-200">
        <h3 className="text-red-700 font-bold mb-2">Alerte Système</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  // Affichage normal des données
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Vue d'ensemble</h3>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Exemple de cartes de statistiques qui s'alimentent avec les données de l'API */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Sites Actifs</p>
          <p className="text-2xl font-bold text-blue-600">{stats?.active_sites || 0}</p>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Vulnérabilités Détectées</p>
          <p className="text-2xl font-bold text-red-600">{stats?.vulnerabilities || 0}</p>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-sm text-gray-500 font-medium">Santé Globale</p>
          <p className="text-2xl font-bold text-green-500">{stats?.health_score || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}