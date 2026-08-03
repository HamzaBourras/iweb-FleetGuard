import { useState, useEffect } from 'react';
import { useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Globe, ShieldAlert, LogOut, Menu, X, BookOpen, ShieldCheck, CheckCircle2, ChevronDown, User } from 'lucide-react';
import logoImg from './assets/logo-dark.png';
import NotificationDropdown from './NotificationDropdown';
import SystemClock from './SystemClock';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // 🎯 ÉTAT POUR LE TITRE DYNAMIQUE DE LA PAGE
  const [dynamicSiteName, setDynamicSiteName] = useState("");

  // 📱 ÉTAT POUR LE MENU MOBILE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ÉTAT POUR LE MENU DÉROULANT DU PROFIL
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Nouveaux états pour la bannière MFA
  const [mfaEnabled, setMfaEnabled] = useState(null); // null = chargement, true/false = état réel
  const [dismissMfaAlert, setDismissMfaAlert] = useState(false); // Pour fermer la bannière

  // Vérification de la session et du statut MFA au montage du Dashboard
  useEffect(() => {
    const verifyDashboardSession = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/auth/verify', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setMfaEnabled(data.mfa_enabled);
        }
      } catch (err) {
        console.error("Erreur de vérification de session :", err);
      }
    };

    verifyDashboardSession();
  }, []);

  const handleLogout = async () => {
    try {
      // 1. On demande au serveur de détruire le cookie HttpOnly
      await fetch('http://localhost:8000/api/auth/logout', {
        method: 'POST',
        credentials: 'include' // 🛡️ Indispensable pour envoyer le cookie à détruire
      });
    } catch (error) {
      console.error("Erreur réseau lors de la déconnexion :", error);
    } finally {
      // 2. Peu importe si le serveur a répondu ou non, on éjecte l'utilisateur côté interface
      navigate('/login', { replace: true });
    }
  };

  // Fermer le menu mobile lors d'un clic sur un lien
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // 🎯 ROUTAGE DYNAMIQUE : Détermine le titre selon l'URL actuelle
  const getPageTitle = () => {
    const path = location.pathname;

    if (path === '/dashboard') return "Vue d'ensemble";
    if (path === '/dashboard/sites') return "Flotte WordPress";
    if (path === '/dashboard/alerts') return "Alertes de Sécurité";
    if (path === '/dashboard/guide') return "Documentation";

    // Intercepte l'URL dynamique du détail du site
    if (path.startsWith('/dashboard/sites/') && path.split('/').length === 4) {
      // Si on a récupéré le nom du site, on l'affiche, sinon on met un titre générique
      return dynamicSiteName ? `Investigation - ${dynamicSiteName}` : "Centre d'Investigation";
    }

    return "Tableau de bord";
  };


  // ✨ UI/UX : Fonction utilitaire pour les animations du menu
  const navLinkClasses = ({ isActive }) =>
    `group flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 ease-out ${isActive
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
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-[#0B1120] text-white flex flex-col justify-between p-5 shadow-2xl border-r border-slate-800/50 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
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
          <div className="pb-4 mt-4 md:mt-0 text-center flex justify-center">
            <img
              src={logoImg}
              alt="Logo iweb FleetGuard"
              className="w-48 h-auto drop-shadow-md hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="flex flex-col items-center border-b border-slate-100 pb-4 mb-6">
            <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 shadow-sm">
              Security Operations Center
            </span>
            <span className="text-xs text-slate-500 font-medium mt-2">
              Supervision unifiée de la flotte WP
            </span>
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
            <NavLink to="/dashboard/guide" className={navLinkClasses} onClick={closeMobileMenu}>
              {({ isActive }) => (
                <>
                  <BookOpen className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:scale-110 text-slate-500 group-hover:text-white'}`} />
                  Documentation SOC
                </>
              )}
            </NavLink>
          </nav>
        </div>

        <div className="relative z-10 mt-auto pt-4 border-t border-slate-800/50">
          <p className="text-center text-xs text-slate-500 font-medium">
            FleetGuard SOC v1.0
          </p>
        </div>
      </aside>

      {/* 🖥️ ZONE DE CONTENU PRINCIPALE */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">

        {/* ========================================================= */}
        {/* BANNIÈRE D'ALERTE MFA PERSISTANTE                         */}
        {/* ========================================================= */}
        {mfaEnabled === false && !dismissMfaAlert && (
          <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between shrink-0 z-20 shadow-md animate-fade-in">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-100 shrink-0" />
              <p className="text-sm font-medium leading-tight">
                <strong className="font-black">Alerte de sécurité :</strong> L'authentification multifacteur (MFA) n'est pas activée. Votre compte est vulnérable.
                <button
                  onClick={() => navigate('/dashboard/profile')}
                  className="ml-2 font-bold underline decoration-amber-300 hover:text-amber-100 transition-colors"
                >
                  Sécuriser mon compte maintenant
                </button>
              </p>
            </div>
            <button
              onClick={() => setDismissMfaAlert(true)}
              className="p-1.5 hover:bg-amber-600 rounded-lg transition-colors ml-4 shrink-0"
              title="Fermer l'alerte"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

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

          {/* ✨ NOUVEAU MENU DROIT (BADGE + PROFIL) ✨ */}
          <div className="flex items-center gap-4">


            {/* NOUVEAU : Composant d'horloge système */}
            <SystemClock />

            {/* Le système de notifications */}
            <NotificationDropdown />

            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold tracking-wide text-emerald-700 uppercase">
                Session Active
              </span>
            </div>

            {/* DROPDOWN PROFIL */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none"
              >
                <div className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                  A
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500 hidden md:block" />
              </button>

              {isProfileMenuOpen && (
                <>
                  {/* Overlay invisible pour fermer le menu si on clique en dehors */}
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>

                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-fade-in origin-top-right">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate('/dashboard/profile');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      Mon Profil
                    </button>

                    <hr className="my-1 border-slate-100" />

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </header>

        {/* CORPS DE LA PAGE */}
        <main className="p-4 md:p-8 flex-1 overflow-y-auto bg-slate-50/50">
          <Outlet context={{ setDynamicSiteName }} />
        </main>
      </div>

    </div>
  );
}



