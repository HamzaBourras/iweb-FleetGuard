import { useState, useEffect } from 'react';

export default function SitesList() {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSites = async () => {
      const token = localStorage.getItem('fleetguard_token');
      
      try {
        const response = await fetch('http://localhost:8000/api/sites', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error("Impossible de récupérer la liste des sites.");
        }

        const data = await response.json();
        setSites(data);

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSites();
  }, []);

  if (isLoading) {
    return <div className="text-gray-500 animate-pulse p-6">Chargement de la flotte...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-xl border border-red-200">
        <p className="text-red-600 font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">🌐 Parc de Sites WordPress</h3>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Ajouter un site
        </button>
      </div>
      
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
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  Aucun site WordPress sous supervision pour le moment.
                </td>
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
                    <code className="bg-gray-100 text-xs px-2 py-1 rounded text-gray-600 border border-gray-200">
                      {site.secret_token.substring(0, 15)}...
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Actif
                    </span>
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