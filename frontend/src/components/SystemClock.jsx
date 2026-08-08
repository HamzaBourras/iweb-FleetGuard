import { useState, useEffect } from 'react';
import { Globe, Clock } from 'lucide-react';

export default function SystemClock() {
  const [time, setTime] = useState(new Date());
  
  // Détection automatique du fuseau horaire (ex: 'Africa/Casablanca', 'Europe/Paris')
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Mise à jour de l'horloge chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
      {/* Indicateur de fuseau horaire */}
      <div className="flex items-center gap-1.5" title="Fuseau horaire du système">
        <Globe className="w-3.5 h-3.5 text-blue-500" />
        <span className="truncate max-w-[120px]">{timeZone}</span>
      </div>
      
      <div className="w-px h-4 bg-slate-300"></div>
      
      {/* Horloge numérique en direct */}
      <div className="flex items-center gap-1.5" title="Heure locale">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-mono font-bold text-slate-700 tracking-wider">
          {time.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            // second: '2-digit' 
          })}
        </span>
      </div>
    </div>
  );
}