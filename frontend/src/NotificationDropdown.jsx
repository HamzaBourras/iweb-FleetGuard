import { useState, useEffect, useRef } from 'react';
import { Bell, ShieldAlert, Key, Lock, CheckCircle2 } from 'lucide-react';

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // ✨ NOUVEAU : États pour gérer le petit message "Nouvelle notification"
  const [showNewBadge, setShowNewBadge] = useState(false);
  const prevUnreadCount = useRef(0); // Mémorise l'ancien nombre sans recharger le composant

  const fetchNotifications = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/notifications', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        
        // Compter combien ne sont pas lues
        const currentUnread = data.filter(n => !n.is_read).length;
        
        // ✨ NOUVEAU : Logique de détection de nouvelle alerte
        // Si le nouveau nombre de non-lus est strictement supérieur à l'ancien
        if (currentUnread > prevUnreadCount.current) {
          setShowNewBadge(true);
          
          // Le message disparaît tout seul après 4 secondes
          setTimeout(() => {
            setShowNewBadge(false);
          }, 6000);
        }
        
        // On met à jour la référence et l'état
        prevUnreadCount.current = currentUnread;
        setUnreadCount(currentUnread);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des notifications", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000); // Polling toutes les 5s
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id) => {
    try {
      await fetch(`http://localhost:8000/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      
      // On met à jour le compteur et la référence manuellement pour ne pas déclencher le badge
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      prevUnreadCount.current = newCount;
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour", error);
    }
  };

  const getIconForType = (type) => {
    const t = type.toLowerCase();
    if (t.includes('sécurité') || t.includes('malvaillant')) return <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />;
    if (t.includes('mfa') || t.includes('secours')) return <Key className="w-4 h-4 text-amber-500 shrink-0" />;
    if (t.includes('mot de passe')) return <Lock className="w-4 h-4 text-emerald-500 shrink-0" />;
    return <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  return (
    <div className="relative flex items-center gap-3">
      
      {/* ✨ NOUVEAU : Message animé "Nouvelle alerte" */}
      {showNewBadge && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="text-xs font-bold whitespace-nowrap">Nouvelle notification !</span>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all outline-none"
          title="Notifications"
        >
          {/* L'icône tremble quand une nouvelle notification arrive */}
          <Bell className={`w-5 h-5 ${showNewBadge ? 'animate-bounce text-blue-600' : ''}`} />
          
          {unreadCount >= 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Panneau déroulant des notifications (Inchangé) */}
        {isOpen && (
          <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">Centre d'Alertes SOC</h3>
              <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                {unreadCount} non lue(s)
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Aucune notification pour le moment.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`p-4 transition-colors flex gap-3 items-start ${notif.is_read ? 'bg-white opacity-70' : 'bg-slate-50/80 hover:bg-slate-100/60'}`}
                  >
                    <div className="mt-0.5">
                      {getIconForType(notif.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{notif.title}</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 mt-2 block font-mono">
                        {new Date(notif.created_at + 'Z').toLocaleString('fr-FR')}
                      </span>
                    </div>

                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 shrink-0 self-center px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        Marquer lu
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}