import { useState } from 'react';
import { Key, X, RefreshCw, AlertTriangle, Check, Copy, Download } from 'lucide-react';

export default function RecoveryCodesModal({ onClose, showNotification }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // États pour l'affichage des codes
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/mfa/regenerate-recovery-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erreur lors de la vérification.");
      }

      setRecoveryCodes(data.recovery_codes);
      showNotification('success', data.message);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    const element = document.createElement("a");
    const file = new Blob([`Codes de secours FleetGuard SOC (Nouveaux)\n\n${recoveryCodes.join('\n')}\n\nÀ conserver en lieu sûr. Chaque code est à usage unique.`], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "fleetguard-nouveaux-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        
        {/* --- EN-TÊTE --- */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Codes de secours</h3>
              <p className="text-slate-400 text-sm mt-0.5">
                {recoveryCodes.length > 0 ? "Vos nouveaux codes sont prêts" : "Vérification d'identité requise"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-white">
          
          {recoveryCodes.length === 0 ? (
            /* ========================================================= */
            /* ÉTAPE 1 : DEMANDE DU MOT DE PASSE                         */
            /* ========================================================= */
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm font-medium border border-blue-100">
                Générer de nouveaux codes de secours invalidera immédiatement tous vos anciens codes.
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mot de passe actuel</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !password}
                className="w-full mt-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Vérification...</> : "Générer de nouveaux codes"}
              </button>
            </form>
          ) : (
            /* ========================================================= */
            /* ÉTAPE 2 : AFFICHAGE DES NOUVEAUX CODES                    */
            /* ========================================================= */
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-3 text-center">
                  {recoveryCodes.map((code, index) => (
                    <code key={index} className="block py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-700 shadow-sm select-all">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCopyCodes}
                  className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {copied ? <><Check className="w-4 h-4 text-emerald-500" /> Copié</> : <><Copy className="w-4 h-4" /> Copier</>}
                </button>
                <button
                  onClick={handleDownloadCodes}
                  className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Télécharger .txt
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center shadow-md"
              >
                J'ai sauvegardé mes nouveaux codes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}