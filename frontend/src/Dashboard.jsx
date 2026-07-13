import { useState } from 'react';
import { useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Globe, ShieldAlert, LogOut, Menu, X } from 'lucide-react';
import logoImg from './assets/logo-dark.png';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 📱 ÉTAT POUR LE MENU MOBILE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('fleetguard_token');
    navigate('/login', { replace: true });
  };

  // Fermer le menu mobile lors d'un clic sur un lien
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

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
    <div className="h-screen bg-slate-50 flex font-sans selection:bg-blue-200 overflow-hidden">

      {/* 🌑 OVERLAY MOBILE (Fond sombre) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden transition-opacity animate-in fade-in duration-300"
          onClick={closeMobileMenu}
        ></div>
      )}

      {/* 📁 MENU LATÉRAL (Sidebar) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#0B1120] text-white flex flex-col justify-between p-5 shadow-2xl border-r border-slate-800/50 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        
        {/* Bouton de fermeture mobile */}
        <button 
          onClick={closeMobileMenu}
          className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-colors z-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Effet de lueur en haut à gauche pour le design */}
        <div className="absolute top-0 left-0 w-full h-32 bg-blue-500/5 blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="pb-8 mb-6 mt-4 md:mt-0 border-b border-slate-100 text-center flex justify-center">
            <img
              src={logoImg}
              alt="Logo iweb FleetGuard"
              className="w-48 h-auto drop-shadow-md hover:scale-105 transition-transform duration-500"
            />
          </div>

          <nav className="space-y-3">
            <NavLink to="/dashboard" end className={navLinkClasses} onClick={closeMobileMenu}>
              {({ isActive }) => (
                <>
                  <LayoutDashboard className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-white'}`} />
                  Vue d'ensemble
                </>
              )}
            </NavLink>

            <NavLink to="/dashboard/sites" className={navLinkClasses} onClick={closeMobileMenu}>
              {({ isActive }) => (
                <>
                  <Globe className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-white'}`} />
                  Sites WordPress
                </>
              )}
            </NavLink>

            <NavLink to="/dashboard/alerts" className={navLinkClasses} onClick={closeMobileMenu}>
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
            className="cursor-pointer group w-full bg-slate-800/50 hover:bg-red-500/10 border border-slate-600 hover:border-red-500/30 text-slate-300 hover:text-red-500 font-bold py-3 px-4 rounded-xl transition-all duration-300 ease-out flex items-center justify-center gap-2 mt-4"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* 🖥️ ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        
        {/* HEADER DYNAMIQUE */}
        <header className="bg-white/80 backdrop-blur-md shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] h-[72px] flex items-center justify-between px-4 md:px-8 border-b border-slate-200 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Bouton Hamburger Mobile */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Le titre dynamique est injecté ici */}
            <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight transition-all duration-300 truncate max-w-[150px] sm:max-w-none">
              {getPageTitle()}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 bg-emerald-50 px-2.5 py-1.5 md:px-3 rounded-full border border-emerald-100 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] md:text-xs font-bold tracking-wide text-emerald-700 uppercase hidden sm:inline-block">
              Session Active
            </span>
          </div>
        </header>

        {/* CORPS DE LA PAGE */}
        <main className="p-4 md:p-8 flex-1 overflow-y-auto bg-slate-50/50">
          <Outlet />
        </main>
      </div>

    </div>
  );
}