/**
 * ============================================================================
 * Composant : Overview.jsx
 * Rôle      : Vue d'ensemble et Statistiques (Tableau de bord principal)
 * Description :
 *    Page d'accueil du SOC affichant les indicateurs clés de performance (KPI)
 *    et le score de santé global de la flotte. Elle intègre un graphique interactif 
 *    (Recharts) de l'évolution des menaces sur 7 jours et une file d'attente de triage
 *    automatisée pour mettre en évidence les sites nécessitant une investigation urgente.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldCheck, AlertTriangle, Activity, Server, LayoutDashboard, ChevronRight, ShieldAlert, ChevronDown } from 'lucide-react';

export default function Overview() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    active_sites: 0,
    vulnerabilities: 0,
    health_score: "100%",
    chart_data: [],
    isLoading: true
  });

  // ✨ État pour stocker la liste des sites
  const [sites, setSites] = useState([]);

  // État pour gérer l'ouverture/fermeture de la file de triage
  const [isTriageOpen, setIsTriageOpen] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      
      try {
        // ✨ On fetch les stats ET les sites en parallèle
        const [statsRes, sitesRes] = await Promise.all([
          fetch('http://localhost:8000/api/dashboard/stats', {
            credentials: 'include'
          }),
          fetch('http://localhost:8000/api/sites', {
            credentials: 'include'
          })
        ]);

        if (statsRes.ok && sitesRes.ok) {
          const statsData = await statsRes.json();
          const sitesData = await sitesRes.json();
          
          
          setStats({ ...statsData, isLoading: false });
          setSites(sitesData); // Sauvegarde des sites pour le widget de triage
        }
      } catch (err) {
        console.error("Erreur de chargement du dashboard", err);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };
    fetchDashboardData();
  }, []);

  if (stats.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-pulse text-slate-500">
        <LayoutDashboard className="w-12 h-12 md:w-12 md:h-12 text-blue-300" />
        <p className="font-medium text-sm md:text-base">Chargement de la vue d'ensemble...</p>
      </div>
    );
  }

  // Calcul pour la couleur du score de santé
  const healthValue = parseInt(stats.health_score);
  const healthColor = healthValue > 80 ? 'text-green-500' : healthValue > 50 ? 'text-orange-500' : 'text-red-500';

  // 🧠 SOC Logic : Identifier les 3 sites les plus critiques (File d'attente)
  const criticalSites = sites
    .filter(site => site.health_score < 90 || (site.alerts_count && site.alerts_count > 0) || (site.malware_report && site.malware_report.length > 0))
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 3);

    
    
  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">

      {/* 📱 En-tête de page : Empilé sur mobile, aligné sur Desktop */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-4 md:mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Vue d'ensemble de la Flotte</h2>
          <p className="text-slate-500 text-xs md:text-sm mt-1">Surveillance en temps réel de vos sites WordPress.</p>
        </div>
        <div className="flex items-center justify-center sm:justify-start gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm border border-blue-100 self-stretch sm:self-auto w-full sm:w-auto">
          <Activity className="w-4 h-4 animate-pulse shrink-0" />
          <span>Système Opérationnel</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* WIDGET : FILE D'ATTENTE DE TRIAGE (TABLEAU COMPACT)       */}
      {/* ========================================================= */}
      {criticalSites.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 md:mb-8 overflow-hidden animate-fade-in">
          
          {/* En-tête du tableau (Cliquable) */}
          <div 
            onClick={() => setIsTriageOpen(!isTriageOpen)}
            className="px-5 py-3 border-b border-slate-100 bg-red-50/30 flex justify-between items-center cursor-pointer hover:bg-red-50/70 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                File d'attente de triage
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {criticalSites.length} urgence(s)
              </span>
              <button className="text-red-400 hover:text-red-700 transition-colors">
                <ChevronDown 
                  className={`w-5 h-5 transform transition-transform duration-300 ${isTriageOpen ? 'rotate-180' : ''}`} 
                />
              </button>
            </div>
          </div>

          {/* Liste des sites en danger (Animée avec Grid Transition) */}
          <div 
            className={`grid transition-all duration-300 ease-in-out ${isTriageOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
          >
            <div className="overflow-hidden">
              <div className="divide-y divide-slate-100">
                {criticalSites.map(site => {
                  const totalThreats = (site.alerts_count || 0) + (site.malware_report?.length || 0);

                  return (
                    <div key={site.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-4">

                      {/* Info Site avec point rouge clignotant */}
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            {site.site_name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{site.url}</div>
                        </div>
                      </div>

                      {/* Métriques et Action */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 ml-5 sm:ml-0">

                        {/* Score */}
                        <div className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                          Score: <span className={`font-black ${site.health_score < 50 ? 'text-red-600' : 'text-orange-600'}`}>{site.health_score}</span>
                        </div>

                        {/* Badge Alertes */}
                        {totalThreats > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-md border border-orange-200">
                            <ShieldAlert className="w-3.5 h-3.5" /> {totalThreats} menace(s)
                          </div>
                        )}

                        {/* Bouton d'action minimaliste */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Empêche le clic de fermer l'accordéon si on clique très vite
                            navigate(`/dashboard/sites/${site.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors border border-blue-100 hover:border-blue-200"
                        >
                          Investiguer <ChevronRight className="w-4 h-4" />
                        </button>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 Section 1 : Les Cartes de KPI (Restaurées) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Carte 1 : Sites Actifs */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Server className="w-16 h-16 text-blue-600" />
          </div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 font-semibold text-xs md:text-sm uppercase tracking-wider">Sites Protégés</h3>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ShieldCheck className="w-5 h-5 md:w-6 md:h-6" /></span>
          </div>
          <div className="text-3xl md:text-4xl font-black text-slate-800">{stats.active_sites}</div>
          <div className="mt-2 text-xs md:text-sm text-emerald-600 font-medium flex items-center gap-1">
            +1 depuis le mois dernier
          </div>
        </div>

        {/* Carte 2 : Vulnérabilités */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-16 h-16 text-red-600" />
          </div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 font-semibold text-xs md:text-sm uppercase tracking-wider">Alertes de sécurité</h3>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-5 h-5 md:w-6 md:h-6" /></span>
          </div>
          <div className="text-3xl md:text-4xl font-black text-slate-800">{stats.vulnerabilities}</div>
          <div className="mt-2 text-xs md:text-sm text-red-500 font-medium flex items-center gap-1">
            Interventions requises
          </div>
        </div>

        {/* Carte 3 : Santé Globale */}
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 font-semibold text-xs md:text-sm uppercase tracking-wider">Score de Santé</h3>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Activity className="w-5 h-5 md:w-6 md:h-6" /></span>
          </div>
          <div className={`text-3xl md:text-4xl font-black ${healthColor}`}>{stats.health_score}</div>

          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4">
            <div
              className={`h-1.5 rounded-full ${healthValue > 80 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: stats.health_score }}
            ></div>
          </div>
        </div>
      </div>

      {/* 📈 Section 2 : Graphique d'Activité */}
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100 mt-6 md:mt-8">
        <div className="mb-4 md:mb-6">
          <h3 className="text-base md:text-lg font-bold text-slate-800">Volume d'Alertes (7 derniers jours)</h3>
          <p className="text-xs md:text-sm text-slate-500">Menaces interceptées par iwebCreative Security Agent</p>
        </div>

        {/* Hauteur ajustée pour mobile (h-56) et desktop (md:h-72) */}
        <div className="h-56 md:h-72 w-full -ml-4 md:ml-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAttaques" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
              <Area
                type="monotone"
                dataKey="alertes"
                stroke="#ef4444"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAttaques)"
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}