/**
 * ============================================================================
 * Composant : Guide.jsx
 * Rôle      : Centre de documentation interactif (Playbook SOC)
 * Description : 
 *    Page statique servant de manuel d'utilisation pour les opérateurs de sécurité.
 *    Elle vulgarise l'architecture hybride (Push/Pull) d'iweb FleetGuard, le processus
 *    de provisionnement d'un nouveau site et les mécanismes de sécurité internes 
 *    (Chiffrement Fernet, MFA, Pare-feu applicatif).
 * ============================================================================
 */

import { BookOpen, ShieldCheck, Server, Activity, PlusCircle, Key, Terminal, Globe, Lock, LayoutDashboard, ShieldAlert, Search, Crosshair, RefreshCw, FileWarning } from 'lucide-react';

export default function Guide() {
  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">

      {/* --- EN-TÊTE --- */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4 md:mb-8 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            Centre de Documentation
          </h2>
          <p className="text-slate-500 text-sm md:text-base mt-2 max-w-2xl">
            Guide d'utilisation et spécifications techniques de la plateforme DevSecOps iweb FleetGuard.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 w-fit">
          <Terminal className="w-4 h-4" />
          v.2.0 (SecOps Edition)
        </div>
      </div>

      {/* --- SECTION 1 : À PROPOS --- */}
      <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          Qu'est-ce qu'iweb FleetGuard ?
        </h3>
        <p className="text-slate-600 leading-relaxed text-sm md:text-base mb-4">
          <strong>iweb FleetGuard</strong> est une plateforme centralisée de gestion de la posture de sécurité spécialement conçue pour les parcs WordPress. Elle combine un pare-feu applicatif (WAF), un scanner heuristique anti-malware (EDR) et une cartographie continue des vulnérabilités (SBOM) au sein d'une interface unique.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Globe className="w-6 h-6 text-blue-500 mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Gestion Multi-Sites</h4>
            <p className="text-xs text-slate-500 mt-1">Supervision unifiée et calcul du score de santé de toute la flotte web.</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Crosshair className="w-6 h-6 text-red-500 mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Réponse aux Incidents</h4>
            <p className="text-xs text-slate-500 mt-1">Destruction de Web Shells à distance et archivage des alertes.</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Lock className="w-6 h-6 text-emerald-500 mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Sécurité Durcie (MFA)</h4>
            <p className="text-xs text-slate-500 mt-1">Accès SOC protégé par authentification multifacteur et codes de secours.</p>
          </div>
        </div>
      </section>

      {/* --- SECTION 2 : ARCHITECTURE TECHNIQUE HYBRIDE --- */}
      <section className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full"></div>
        <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 relative z-10">
          <Server className="w-6 h-6 text-blue-400" />
          Architecture Hybride (Push & Pull)
        </h3>
        <p className="text-slate-300 leading-relaxed text-sm md:text-base mb-6 relative z-10">
          La plateforme repose sur une communication bidirectionnelle sécurisée par des jetons chiffrés symétriquement (Fernet), garantissant l'intégrité des échanges entre le backend Python et les sondes PHP distantes.
        </p>

        <div className="space-y-6 relative z-10">
          <div className="flex gap-4 items-start">
            <div className="bg-red-500/20 text-red-400 p-2 rounded-lg shrink-0 mt-1">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm md:text-base">1. Le Mode "Push" : Interception WAF Temps Réel</h4>
              <p className="text-slate-400 text-xs md:text-sm mt-1">L'agent installé sur WordPress agit comme un pare-feu. S'il détecte un payload malveillant (SQLi, XSS, Brute-Force), il bloque la requête et expulse l'alerte instantanément vers le SOC.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg shrink-0 mt-1">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm md:text-base">2. Le Mode "Pull" : Tâches de Fond (CRON)</h4>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Le planificateur central (APScheduler) interroge les sites de manière asynchrone. Il effectue un Ping léger toutes les 2 heures pour vérifier l'état du serveur, et lance des analyses forensiques lourdes selon la configuration d'auto-scan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 3 : NAVIGATION ET OUTILS --- */}
      <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Terminal className="w-6 h-6 text-slate-600" />
          Les Modules de la Tour de Contrôle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-500" />
              Vue d'ensemble
            </h4>
            <p className="text-sm text-slate-600">Le tableau de bord décisionnel affiche les KPI, le score de santé global et les volumes d'attaques interceptés sur 7 jours.</p>
          </div>
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Sites WordPress
            </h4>
            <p className="text-sm text-slate-600">Le gestionnaire de la flotte. Permet d'ajouter de nouvelles cibles, de générer leurs jetons de sécurité et de retirer temporairement (Soft Delete) des sites.</p>
          </div>
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              Alertes de Sécurité
            </h4>
            <p className="text-sm text-slate-600">Le centre de triage. Centralise les événements bloqués (Sévérité, IP, Payload). Permet l'archivage manuel (Résolution) après traitement.</p>
          </div>
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow md:col-span-2 bg-slate-50">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Investigation Forénsique (Page Détaillée)
            </h4>
            <p className="text-sm text-slate-600 mb-3">Accessible en cliquant sur un site spécifique, ce module d'analyse profonde propose trois outils majeurs :</p>
            <ul className="text-sm text-slate-600 space-y-2 ml-2">
              <li><strong>• Threat Intelligence (SBOM) :</strong> Évalue l'obsolescence du noyau WordPress, de PHP et cartographie les plugins vulnérables.</li>
              <li><strong>• Scanner Anti-Malware :</strong> Recherche les signatures de Backdoors et de code obfusqué (base64, eval) dans les fichiers du serveur.</li>
              <li><strong>• Remédiation Active :</strong> Permet de détruire physiquement un fichier malveillant à distance, ou de le placer sur liste blanche (Faux Positif).</li>
            </ul>
          </div>
        </div>
      </section>

      {/* --- SECTION 4 : PROVISIONNING & SÉCURITÉ --- */}
      <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-emerald-600" />
          Déploiement et Rotation Cryptographique
        </h3>

        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1 space-y-6 w-full">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <h4 className="font-bold text-slate-800">Ajout d'un Actif</h4>
                <p className="text-sm text-slate-600 mt-1">Déclarez l'URL depuis la vue "Sites WordPress". L'API générera un jeton d'authentification unique. <strong>Copiez-le immédiatement</strong>.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <h4 className="font-bold text-slate-800">Déploiement de l'Agent</h4>
                <p className="text-sm text-slate-600 mt-1">Sur le serveur cible, placez l'agent dans le dossier <code className="bg-slate-100 px-1 font-mono text-xs text-blue-600">/wp-content/plugins</code> et définissez la constante <code className="bg-slate-100 px-1 font-mono text-xs text-red-600">IWEB_AGENT_SECRET_TOKEN</code> dans le <code className="font-mono text-xs">wp-config.php</code>.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800">Rotation des Clés (Key Rotation)</h4>
                <p className="text-sm text-slate-600 mt-1">En cas de compromission d'un jeton, naviguez sur la page d'investigation du site et cliquez sur "Rotation Token" pour révoquer l'ancien accès et en générer un nouveau sans altérer l'historique de sécurité du site.</p>
              </div>
            </div>
          </div>

          {/* Illustration visuelle */}
          <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <Key className="w-12 h-12 text-slate-400 mb-4" />
            <p className="text-sm font-bold text-slate-700 mb-2">Chiffrement Symétrique</p>
            <p className="text-xs text-slate-500">Les jetons sont chiffrés dans la base de données PostgreSQL via l'algorithme Fernet. Le backend Python les déchiffre à la volée uniquement lors de l'exécution d'un scan distant.</p>
          </div>
        </div>
      </section>

    </div>
  );
}