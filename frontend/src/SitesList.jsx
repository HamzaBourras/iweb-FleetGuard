import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Globe, CheckCircle2, Copy, Check, Server, ShieldAlert } from 'lucide-react';

export default function SitesList() {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // États pour la modale d'ajout
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false); // Nouvel état pour le bouton copier

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

  const handleDelete = async (siteId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce site ? Il sera conservé pendant 12h avant destruction définitive.")) return;
    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchSites();
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleRestore = async (siteId) => {
    const token = localStorage.getItem('fleetguard_token');
    try {
      const response = await fetch(`http://localhost:8000/api/sites/${siteId}/restore`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchSites();
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
        body: JSON.stringify({ site_name: newSiteName, url: newSiteUrl }),
      });

      if (!response.ok) throw new Error("Erreur lors de l'ajout du site.");
      const addedSite = await response.json();
      
      fetchSites();
      setNewGeneratedToken(addedSite.secret_token);
      setNewSiteName('');
      setNewSiteUrl('');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(newGeneratedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setNewGeneratedToken(null), 300);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-pulse text-slate-500">
      <Server className="w-12 h-12 text-blue-300" />
      <p className="font-medium">Chargement de la flotte...</p>
    </div>
  );

  return (
    <div className="relative animate-fade-in">
      
      {/* --- EN-TÊTE DE PAGE --- */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Sites WordPress</h2>
          <p className="text-slate-500 text-sm mt-1">Gérez le provisionnement et la supervision de vos sites.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="group bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md flex items-center gap-2 hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          Ajouter un site
        </button>
      </div>

      {/* --- TABLEAU PRINCIPAL --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {error && <div className="p-4 bg-red-50 text-red-600 border-b border-red-100 flex items-center gap-2"><ShieldAlert className="w-5 h-5"/>{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-5 font-semibold">ID</th>
                <th className="px-6 py-5 font-semibold">Nom du Site</th>
                <th className="px-6 py-5 font-semibold">URL Site</th>
                <th className="px-6 py-5 font-semibold">Token Agent</th>
                <th className="px-6 py-5 font-semibold">Statut</th>
                <th className="px-6 py-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Globe className="w-12 h-12 text-slate-200 mb-3" />
                      <p className="text-lg font-medium text-slate-600">Aucun site supervisé</p>
                      <p className="text-sm mt-1">Commencez par ajouter une nouvelle site à votre flotte.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sites.map((site) => {
                  const isDeleted = site.deleted_at !== null;

                  return (
                    <tr key={site.id} className={`group transition-all duration-200 ${isDeleted ? 'bg-red-50/50 opacity-75' : 'hover:bg-slate-50'}`}>
                      <td className="px-6 py-4 text-slate-400 font-mono text-sm">#{site.id}</td>
                      <td className={`px-6 py-4 font-bold ${isDeleted ? 'text-red-800/60 line-through' : 'text-slate-800'}`}>
                        {site.site_name}
                      </td>
                      <td className="px-6 py-4">
                        {!isDeleted && (
                          <a href={site.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1.5 transition-colors">
                            <Globe className="w-3.5 h-3.5" /> {site.url}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-xs px-3 py-1.5 rounded-md text-slate-400 font-mono border border-slate-200 select-none">
                          ••••••••••••••••
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                            ⏳ Destr. 12h
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Actif
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isDeleted ? (
                          <button
                            onClick={() => handleRestore(site.id)}
                            className="inline-flex items-center gap-1.5 bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:shadow-sm px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Restaurer
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDelete(site.id)}
                            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          
          {/* Overlay avec animation de fondu */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
            onClick={() => !isSubmitting && !newGeneratedToken && setIsModalOpen(false)}
          ></div>

          {/* Conteneur de la Modale */}
          <div className="relative bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] w-full max-w-xl overflow-hidden transform transition-all animate-in zoom-in-[0.97] fade-in duration-300 border border-slate-100">
            
            {newGeneratedToken ? (
              /* --- ÉTAT 2 : SUCCÈS & TOKEN --- */
              <div className="p-8">
                <div className="mx-auto w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-sm relative">
                  <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-20 duration-1000"></span>
                  <CheckCircle2 className="w-8 h-8 relative z-10" />
                </div>
                
                <h3 className="text-2xl font-black text-center text-slate-800 tracking-tight mb-2">Site Ajouté</h3>
                <p className="text-center text-slate-500 mb-8 text-sm font-medium">L'environnement est prêt à recevoir les logs de sécurité.</p>

                <div className="bg-amber-50/80 border border-amber-200/60 p-4 mb-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                  <h4 className="text-sm font-bold text-amber-900 mb-1.5 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" /> 
                    Sauvegarde Cryptographique Requise
                  </h4>
                  <p className="text-xs text-amber-800/80 leading-relaxed ml-6">
                    Copiez ce jeton pour configurer l'agent distant. 
                    <span className="block mt-1 font-bold text-amber-900">Il ne sera affiché qu'une seule fois.</span>
                  </p>
                </div>

                <div className="bg-[#0B1120] p-1.5 rounded-2xl flex items-center justify-between gap-3 mb-8 shadow-inner ring-1 ring-slate-800/50">
                  <code className="text-emerald-400 font-mono text-sm pl-4 overflow-x-visible whitespace-nowrap scrollbar-hide select-all">
                    {newGeneratedToken}
                  </code>
                  <button
                    onClick={handleCopyToken}
                    className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 flex items-center gap-2 font-bold text-sm ${
                      copied 
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                    title="Copier le jeton"
                  >
                    {copied ? (
                      <><Check className="w-4 h-4" /> Copié</>
                    ) : (
                      <><Copy className="w-4 h-4" /> Copier</>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full px-4 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold rounded-xl transition-colors ring-1 ring-slate-200/60"
                >
                  Terminer la configuration
                </button>
              </div>
            ) : (
              /* --- ÉTAT 1 : FORMULAIRE --- */
              <>
                {/* En-tête avec motif subtil */}
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
                  <div className="flex justify-between items-center relative z-10">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">Nouveau Site</h3>
                      <p className="text-sm text-slate-500 mt-1.5 font-medium">Provisionnez un nouveau nœud de surveillance.</p>
                    </div>
                    <div className="w-12 h-12 bg-white border border-slate-200/60 shadow-sm text-blue-600 rounded-full flex items-center justify-center">
                      <Server className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddSite} className="p-8 space-y-6 bg-white">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nom du projet</label>
                    <input
                      type="text"
                      required
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                      placeholder="Ex: API E-commerce Principale"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">URL Site</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Globe className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="url"
                        required
                        value={newSiteUrl}
                        onChange={(e) => setNewSiteUrl(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                        placeholder="https://www.exemple.com"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        'Ajouter'
                      )}
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