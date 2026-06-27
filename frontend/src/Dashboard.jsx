import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('fleetguard_token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      
      {/* 📁 MENU LATÉRAL (SIDEBAR) */}
      <div className="w-64 bg-slate-900 text-white flex flex-col justify-between p-4 shadow-xl">
        <div>
          <div className="pb-6 mb-6 border-b border-slate-700 text-center">
            <h1 className="text-xl font-bold text-cyan-400 tracking-wider">iweb FleetGuard</h1>
            <p className="text-xs text-slate-400 mt-1">Supervision Active</p>
          </div>
          
          <nav className="space-y-2">
            <button className="w-full text-left bg-slate-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
              📊 Vue d'ensemble
            </button>
            <button className="w-full text-left text-slate-300 hover:bg-slate-800 hover:text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
              🌐 Sites WordPress
            </button>
            <button className="w-full text-left text-slate-300 hover:bg-slate-800 hover:text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
              🚨 Alertes de Sécurité
            </button>
          </nav>
        </div>

        {/* Bouton de déconnexion en bas de la Sidebar */}
        <button 
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
        >
          <span>🚪</span> Déconnexion
        </button>
      </div>

      {/* 🖥️ ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col">
        {/* Barre supérieure (Header) */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Tableau de bord</h2>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-gray-600">Session Administrateur active</span>
          </div>
        </header>

        {/* Corps de la page */}
        <main className="p-8 flex-1 overflow-y-auto">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bienvenue Hamza</h3>
            <p className="text-gray-600">
              L'architecture de routage est en place. Tu es actuellement dans une zone hautement sécurisée, protégée par ton token d'authentification.
            </p>
          </div>
        </main>
      </div>

    </div>
  );
}