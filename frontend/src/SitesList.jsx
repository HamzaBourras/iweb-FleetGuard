import { useState, useEffect } from 'react';

export default function SitesList() {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // --- ÉTATS POUR LA MODALE D'AJOUT ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fonction pour charger la liste des sites
  const fetchSites = async () => {
    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch('http://localhost:8000/api/sites', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Impossible de récupérer la liste des sites.");
      const data = await response.json();
      setSites(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // --- FONCTION POUR AJOUTER UN SITE ---
  const handleAddSite = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem('fleetguard_token');

    try {
      const response = await fetch('http://localhost:8000/api/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_name: newSiteName,
          url: newSiteUrl
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de l'ajout du site.");

      // Si le succès est confirmé par le backend
      const addedSite = await response.json();
      
      // On met à jour le tableau visuel directement sans recharger la page
      setSites([...sites, addedSite]);
      
      // On nettoie et ferme la modale
      setNewSiteName('');
      setNewSiteUrl('');
      setIsModalOpen(false);

    } catch (err) {
      alert(err.message); // Affichage simple de l'erreur pour l'instant
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-gray-500 animate-pulse p-6">Chargement de la flotte...</div>;

  return (
    <div className="relative">
      
      {/* --- TABLEAU PRINCIPAL --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">🌐 Parc de Sites WordPress</h3>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            + Ajouter un site
          </button>
        </div>
        
        {error && <div className="p-4 bg-red-50 text-red-600 border-b border-red-100">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Nom du Site</th>
                <th className="px-6 py-4 font-semibold">URL</th>
                <th className="px-6 py-4 font-semibold">Token Agent</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sites.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Aucun site sous supervision.</td>
                </tr>
              ) : (
                sites.map((site) => (
                  <tr key={site.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 font-medium">#{site.id}</td>
                    <td className="px-6 py-4 text-gray-800 font-semibold">{site.site_name}</td>
                    <td className="px-6 py-4 text-blue-600 hover:underline">
                      <a href={site.url} target="_blank" rel="noreferrer">{site.url}</a>
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-gray-100 text-xs px-2 py-1 rounded text-gray-600 border border-gray-200 select-all cursor-pointer" title="Double-cliquez pour sélectionner">
                        {site.secret_token.substring(0, 15)}...
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        En attente
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- FENÊTRE MODALE D'AJOUT --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Nouveau Site Cible</h3>
              <p className="text-sm text-gray-500 mt-1">Générez un token unique pour le plugin WordPress.</p>
            </div>
            
            <form onSubmit={handleAddSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nom du projet</label>
                <input 
                  type="text" 
                  required
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Boutique E-commerce WordPress"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">URL (https://...)</label>
                <input 
                  type="url" 
                  required
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://www.monsite.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-blue-400"
                >
                  {isSubmitting ? 'Génération...' : 'Créer et générer le Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}