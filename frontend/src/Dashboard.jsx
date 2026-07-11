import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import logoImg from './assets/logo-dark.png';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('fleetguard_token');
    navigate('/login', { replace: true });
  };

  // Fonction utilitaire pour gérer la couleur du menu actif avec Tailwind
  const navLinkClasses = ({ isActive }) =>
    `w-full text-left px-4 py-2.5 rounded-lg font-medium transition-colors block ${isActive
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* 📁 MENU LATÉRAL */}
      <div className="w-64 bg-slate-900 text-white flex flex-col justify-between p-4 shadow-xl shrink-0">
        <div>
          <div className="pb-6 mb-6 border-b border-slate-700 text-center">
            {/* <h1 className="text-xl font-bold text-cyan-400 tracking-wider">iweb FleetGuard</h1> */}
            <img
              src={logoImg}
              alt="Logo iweb FleetGuard"
              className="w-64 h-auto mb-3 rounded-md"
            />
            {/* <p className="text-xs text-slate-400 mt-1">Supervision Active</p> */}
          </div>

          <nav className="space-y-2">
            {/* L'attribut "end" garantit que ce lien n'est actif que sur la racine /dashboard */}
            <NavLink to="/dashboard" end className={navLinkClasses}>
              📊 Vue d'ensemble
            </NavLink>

            <NavLink to="/dashboard/sites" className={navLinkClasses}>
              🌐 Sites WordPress
            </NavLink>

            <NavLink to="/dashboard/alerts" className={navLinkClasses}>
              🚨 Alertes de Sécurité
            </NavLink>
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow mt-4"
        >
          <span>🚪</span> Déconnexion
        </button>
      </div>

      {/* 🖥️ ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-8 border-b border-gray-200 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Tableau de bord</h2>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-gray-600">Session Administrateur active</span>
          </div>
        </header>

        {/* Corps de la page dynamique */}
        <main className="p-8 flex-1 overflow-y-auto">
          {/* Le composant Outlet injecte le contenu de la sous-route ici ! */}
          <Outlet />
        </main>
      </div>

    </div>
  );
}