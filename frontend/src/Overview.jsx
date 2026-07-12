import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldCheck, AlertTriangle, Activity, Server } from 'lucide-react';


export default function Overview() {
  const [stats, setStats] = useState({
    active_sites: 0,
    vulnerabilities: 0,
    health_score: "100%",
    chart_data: [], // ✨ Nouveau champ ajouté
    isLoading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('fleetguard_token');
      try {
        const response = await fetch('http://localhost:8000/api/dashboard/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStats({ ...data, isLoading: false });
        }
      } catch (err) {
        console.error("Erreur de chargement des stats", err);
      }
    };
    fetchStats();
  }, []);

  if (stats.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calcul pour la couleur du score de santé
  const healthValue = parseInt(stats.health_score);
  const healthColor = healthValue > 80 ? 'text-green-500' : healthValue > 50 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* En-tête de page */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Vue d'ensemble de la Flotte</h2>
          <p className="text-slate-500 text-sm mt-1">Surveillance en temps réel de vos sites WordPress.</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm border border-blue-100">
          <Activity className="w-4 h-4 animate-pulse" />
          Système Opérationnel
        </div>
      </div>

      {/* 📊 Section 1 : Les Cartes de KPI (Indicateurs clés) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Carte 1 : Sites Actifs */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Server className="w-16 h-16 text-blue-600" />
          </div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider">Sites Protégés</h3>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><ShieldCheck className="w-5 h-5" /></span>
          </div>
          <div className="text-4xl font-black text-slate-800">{stats.active_sites}</div>
          <div className="mt-2 text-sm text-emerald-600 font-medium flex items-center gap-1">
            +1 depuis le mois dernier
          </div>
        </div>

        {/* Carte 2 : Vulnérabilités */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-16 h-16 text-red-600" />
          </div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider">Alertes de sécurité</h3>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></span>
          </div>
          <div className="text-4xl font-black text-slate-800">{stats.vulnerabilities}</div>
          <div className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
            Interventions requises
          </div>
        </div>

        {/* Carte 3 : Santé Globale */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wider">Score de Santé</h3>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Activity className="w-5 h-5" /></span>
          </div>
          <div className={`text-4xl font-black ${healthColor}`}>{stats.health_score}</div>
          
          {/* Barre de progression visuelle */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4">
            <div 
              className={`h-1.5 rounded-full ${healthValue > 80 ? 'bg-emerald-500' : 'bg-red-500'}`} 
              style={{ width: stats.health_score }}
            ></div>
          </div>
        </div>
      </div>

      {/* 📈 Section 2 : Graphique d'Activité */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800">Volume d'Alertes (7 derniers jours)</h3>
          <p className="text-sm text-slate-500">Visualisation des menaces interceptées par iwebCreative Security Agent</p>
        </div>
        
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chart_data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAttaques" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
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