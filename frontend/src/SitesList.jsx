import { useState, useEffect } from 'react';

export default function SitesList() {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // États pour la modale d'ajout
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NOUVEL ÉTAT : Stockage temporaire du token en clair
  const [newGeneratedToken, setNewGeneratedToken] = useState(null);

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

  // Fonction pour déclencher la suppression (Soft Delete)
  const handleDelete = async (siteId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce site ? Il sera conservé pendant 12h avant destruction définitive.")) return;

    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchSites(); // On rafraîchit la liste
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  // Fonction pour annuler la suppression
  const handleRestore = async (siteId) => {
    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${siteId}/restore`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchSites(); // On rafraîchit la liste
    } catch (err) {
      alert("Erreur lors de la restauration.");
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

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

      const addedSite = await response.json();

      // On rafraîchit la liste pour inclure le nouveau site
      fetchSites();

      // On affiche l'écran de succès avec le token en clair
      setNewGeneratedToken(addedSite.secret_token);

      // On nettoie les champs du formulaire
      setNewSiteName('');
      setNewSiteUrl('');

    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour copier le token et fermer la modale proprement
  const handleCloseModal = () => {
    setIsModalOpen(false);
    // On détruit le token de la mémoire front-end !
    setTimeout(() => setNewGeneratedToken(null), 300);
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
                <th className="px-6 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sites.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">Aucun site sous supervision.</td>
                </tr>
              ) : (
                sites.map((site) => {
                  const isDeleted = site.deleted_at !== null;

                  return (
                    <tr key={site.id} className={`transition-colors ${isDeleted ? 'bg-red-50 opacity-75' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 text-gray-900 font-medium">#{site.id}</td>
                      <td className={`px-6 py-4 font-semibold ${isDeleted ? 'text-red-800 line-through' : 'text-gray-800'}`}>
                        {site.site_name}
                      </td>
                      <td className="px-6 py-4 text-blue-600">
                        {!isDeleted && <a href={site.url} target="_blank" rel="noreferrer" className="hover:underline">{site.url}</a>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-xs px-2.5 py-1.5 rounded text-slate-400 font-mono border border-slate-200 select-none">
                          ••••••••••••••••
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ⏳ Destr. dans 12h
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Actif
                          </span>
                        )}
                      </td>

                      {/* NOUVELLE COLONNE ACTIONS */}
                      <td className="px-6 py-4">
                        {isDeleted ? (
                          <button
                            onClick={() => handleRestore(site.id)}
                            className="bg-white border border-green-500 text-green-600 hover:bg-green-50 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm"
                          >
                            ♻️ Restaurer
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDelete(site.id)}
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          >
                            🗑️ Retirer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- FENÊTRE MODALE --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Si un token vient d'être généré, on affiche l'écran de sécurité */}
            {newGeneratedToken ? (
              <div className="p-6">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Site ajouté avec succès !</h3>

                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-r-lg mt-6">
                  <h4 className="text-sm font-bold text-orange-800 mb-1">⚠️ Action requise immédiatement</h4>
                  <p className="text-xs text-orange-700">
                    Copiez le token ci-dessous pour configurer votre agent PHP.
                    <strong> Pour des raisons de sécurité, il ne sera plus jamais affiché.</strong>
                  </p>
                </div>

                <div className="bg-slate-900 p-4 rounded-lg flex items-center justify-between gap-4 mb-6">
                  <code className="text-green-400 font-mono text-sm break-all">
                    {newGeneratedToken}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newGeneratedToken);
                      alert("Token copié dans le presse-papier !");
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded transition-colors shrink-0"
                    title="Copier le token"
                  >
                    📋
                  </button>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors"
                >
                  J'ai copié le token, fermer
                </button>
              </div>
            ) : (
              /* Sinon, on affiche le formulaire classique */
              <>
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900">Nouveau Site Cible</h3>
                  <p className="text-sm text-gray-500 mt-1">Provisionnez une nouvelle cible pour la flotte.</p>
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
                      placeholder="Ex: Boutique E-commerce JLM"
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
                      {isSubmitting ? 'Génération...' : 'Générer le Token'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}