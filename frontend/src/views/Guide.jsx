import {
  BookOpen,
  ShieldCheck,
  Server,
  Activity,
  PlusCircle,
  Key,
  Terminal,
  ArrowRight,
  Globe,
  Lock,
  LayoutDashboard,
  ShieldAlert
} from 'lucide-react';

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
            Guide d'utilisation et spécifications techniques de la tour de contrôle iweb FleetGuard pour les administrateurs SOC.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 w-fit">
          <Terminal className="w-4 h-4" />
          v.1.1
        </div>
      </div>

      {/* --- SECTION 1 : À PROPOS --- */}
      <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          Qu'est-ce qu'iweb FleetGuard ?
        </h3>
        <p className="text-slate-600 leading-relaxed text-sm md:text-base mb-4">
          <strong>iweb FleetGuard</strong> est une solution centralisée de gestion de la posture de sécurité (SOC) spécialement conçue pour les infrastructures WordPress. Elle permet aux équipes de superviser, détecter et bloquer les menaces en temps réel sur une multitude de sites distants depuis une interface unique.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Globe className="w-6 h-6 text-slate-400 mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Gestion Multi-Sites</h4>
            <p className="text-xs text-slate-500 mt-1">Supervision unifiée de toute la flotte web.</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Activity className="w-6 h-6 text-slate-400 mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Détection Temps Réel</h4>
            <p className="text-xs text-slate-500 mt-1">Remontée instantanée des tentatives d'intrusion.</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <Lock className="w-6 h-6 text-slate-400 mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Architecture Zero-Trust</h4>
            <p className="text-xs text-slate-500 mt-1">Authentification des sondes par jetons uniques.</p>
          </div>
        </div>
      </section>

      {/* --- SECTION 2 : FONCTIONNEMENT TECHNIQUE --- */}
      <section className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full"></div>
        <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 relative z-10">
          <Server className="w-6 h-6 text-blue-400" />
          Comment ça marche ? (La Sonde PHP)
        </h3>
        <p className="text-slate-300 leading-relaxed text-sm md:text-base mb-6 relative z-10">
          La sécurité repose sur une architecture distribuée. Un <strong>Agent PHP léger (Sonde IDS)</strong> est déployé sous forme de <i>Must-Use Plugin</i> sur chaque site WordPress cible.
        </p>

        <div className="space-y-4 relative z-10">
          <div className="flex gap-4 items-start">
            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg shrink-0 mt-1">
              <span className="font-mono font-bold text-sm">1</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm md:text-base">Interception WAF</h4>
              <p className="text-slate-400 text-xs md:text-sm mt-1">L'agent analyse chaque requête entrante (GET, POST) avant même le chargement du cœur de WordPress.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg shrink-0 mt-1">
              <span className="font-mono font-bold text-sm">2</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm md:text-base">Filtrage des Signatures</h4>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Si un payload malveillant (SQLi, XSS) est détecté, la requête est immédiatement rejetée (Erreur 403).</p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg shrink-0 mt-1">
              <span className="font-mono font-bold text-sm">3</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-sm md:text-base">Transmission Sécurisée</h4>
              <p className="text-slate-400 text-xs md:text-sm mt-1">Les détails de l'attaque sont chiffrés et envoyés via une requête asynchrone vers l'API FastAPI centrale, authentifiée par le Token de l'agent.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 3 : NAVIGATION --- */}
      <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Terminal className="w-6 h-6 text-slate-600" />
          Les Espaces de la Tour de Contrôle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-emerald-500" />
              Vue d'ensemble
            </h4>
            <p className="text-sm text-slate-600">Le tableau de bord décisionnel. Affiche les indicateurs clés de performance (KPI), le score de santé global et les graphiques de volume d'attaques sur 7 jours.</p>
          </div>
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Sites WordPress
            </h4>
            <p className="text-sm text-slate-600">Le gestionnaire de la flotte. Permet d'ajouter de nouvelles cibles, de générer leurs jetons de sécurité et de retirer temporairement (Soft Delete) des sites.</p>
          </div>
          <div className="border border-slate-100 p-5 rounded-xl hover:shadow-md transition-shadow md:col-span-2">
            <h4 className="font-extrabold text-slate-800 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Alertes de Sécurité
            </h4>
            <p className="text-sm text-slate-600">Le centre d'analyse forensique. Centralise tous les événements de sécurité bloqués par les sondes, avec l'IP source, la sévérité et le payload exact de l'attaquant pour investigation.</p>
          </div>
        </div>
      </section>

      {/* --- SECTION 4 : COMMENT AJOUTER UN SITE --- */}
      <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-emerald-600" />
          Comment provisionner un nouveau site ?
        </h3>

        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1 space-y-6 w-full">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <h4 className="font-bold text-slate-800">Déclarer la cible</h4>
                <p className="text-sm text-slate-600 mt-1">Allez dans la page "Sites WordPress", cliquez sur "Ajouter un site" et renseignez le nom et l'URL du site cible.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <h4 className="font-bold text-slate-800">Générer le Token</h4>
                <p className="text-sm text-slate-600 mt-1">Validez. L'API va générer un jeton cryptographique unique. <strong>Copiez-le immédiatement</strong>, il ne sera plus jamais affiché en clair.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">3</div>
              <div>
                <h4 className="font-bold text-slate-800">Déployer l'Agent</h4>
                <p className="text-sm text-slate-600 mt-1">Sur le site WordPress cible, collez le fichier <code className="bg-slate-100 px-1.5 py-0.5 rounded text-red-600">iwebcreative-agent.php</code> dans le dossier <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">/wp-content/mu-plugins/</code> et insérez le token dans le code source de l'agent.</p>
              </div>
            </div>
          </div>

          {/* Illustration visuelle */}
          <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <Key className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-sm font-bold text-slate-700 mb-2">Sécurité des Jetons</p>
            <p className="text-xs text-slate-500">Les tokens sont hachés dans la base de données PostgreSQL. Si un token est perdu, l'administrateur devra retirer le site et le provisionner à nouveau.</p>
          </div>
        </div>
      </section>

    </div>
  );
}