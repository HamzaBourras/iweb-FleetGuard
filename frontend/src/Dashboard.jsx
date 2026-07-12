import { useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Globe, ShieldAlert, LogOut } from 'lucide-react';
import logoImg from './assets/logo-dark.png';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('fleetguard_token');
    navigate('/login', { replace: true });
  };

  // 🎯 ROUTAGE DYNAMIQUE : Détermine le titre selon l'URL actuelle
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard': 
        return "Vue d'ensemble";
      case '/dashboard/sites': 
        return "Sites WordPress";
      case '/dashboard/alerts': 
        return "Alertes de Sécurité";
      default: 
        return "Tableau de bord";
    }
  };

  // ✨ UI/UX : Fonction utilitaire pour les animations du menu
  const navLinkClasses = ({ isActive }) =>
    `group flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 ease-out ${
      isActive
        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.1)]"
        : "text-slate-400 hover:bg-slate-800/80 hover:text-white hover:translate-x-1"
    }`;

  return (
    <div className="h-screen bg-slate-50 flex font-sans selection:bg-blue-200">

      {/* 📁 MENU LATÉRAL (Sidebar) */}
      <div className="w-72 bg-[#0B1120] text-white flex flex-col justify-between p-5 shadow-2xl shrink-0 border-r border-slate-800/50 z-20 relative">
        
        {/* Effet de lueur en haut à gauche pour le design */}
        <div className="absolute top-0 left-0 w-full h-32 bg-blue-500/5 blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="pb-8 mb-6 border-b border-slate-100 text-center flex justify-center">
            <img
              src={logoImg}
              alt="Logo iweb FleetGuard"
              className="w-48 h-auto drop-shadow-md hover:scale-105 transition-transform duration-500"
            />
          </div>

          <nav className="space-y-3">
            <NavLink to="/dashboard" end className={navLinkClasses}>
              {({ isActive }) => (
                <>
                  <LayoutDashboard className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-white'}`} />
                  Vue d'ensemble
                </>
              )}
            </NavLink>

            <NavLink to="/dashboard/sites" className={navLinkClasses}>
              {({ isActive }) => (
                <>
                  <Globe className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-white'}`} />
                  Sites WordPress
                </>
              )}
            </NavLink>

            <NavLink to="/dashboard/alerts" className={navLinkClasses}>
              {({ isActive }) => (
                <>
                  <ShieldAlert className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-white'}`} />
                  Alertes de Sécurité
                </>
              )}
            </NavLink>
          </nav>
        </div>

        {/* Bouton de déconnexion animé */}
        <div className="relative z-10">
          <button
            onClick={handleLogout}
            className="group w-full bg-slate-800/50 hover:bg-red-500/10 border border-slate-700/50 hover:border-red-500/30 text-slate-300 hover:text-red-500 font-bold py-3 px-4 rounded-xl transition-all duration-300 ease-out flex items-center justify-center gap-2 mt-4"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* 🖥️ ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* HEADER DYNAMIQUE */}
        <header className="bg-white/80 backdrop-blur-md shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] h-[72px] flex items-center justify-between px-8 border-b border-slate-200 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Le titre dynamique est injecté ici */}
            <h2 className="text-xl font-bold text-slate-800 tracking-tight transition-all duration-300">
              {getPageTitle()}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wide text-emerald-700 uppercase">
              Session Active
            </span>
          </div>
        </header>

        {/* CORPS DE LA PAGE */}
        <main className="p-8 flex-1 overflow-y-auto bg-slate-50/50">
          <Outlet />
        </main>
      </div>

    </div>
  );
}