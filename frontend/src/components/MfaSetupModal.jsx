/**
 * ============================================================================
 * Composant : MfaSetupModal.jsx
 * Rôle      : Assistant de configuration de l'Authentification Multifacteur (MFA)
 * Description :
 *    Interface étape par étape pour l'activation du TOTP (Time-Based One-Time 
 *    Password). Elle affiche le QR Code généré par le backend, valide le 
 *    premier code à 6 chiffres, puis expose de manière éphémère les codes 
 *    de secours à usage unique pour téléchargement ou copie.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, X, RefreshCw, AlertTriangle, Smartphone, Download, Copy, Check } from 'lucide-react';

export default function MfaSetupModal({ onClose, showNotification }) {
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ✨ NOUVEAUX ÉTATS POUR LES CODES DE SECOURS ✨
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [copied, setCopied] = useState(false);

  // 1. Récupération des données MFA au chargement de la modale
  useEffect(() => {
    const fetchMfaSetup = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/auth/mfa/setup', {
          method: 'GET',
          credentials: 'include' // 🛡️ Toujours inclure le cookie HttpOnly
        });

        if (!response.ok) throw new Error("Impossible de communiquer avec le serveur.");

        const data = await response.json();
        setQrUri(data.qr_uri);
        setSecret(data.secret);
      } catch (err) {
        setError("Erreur lors de la génération du QR Code.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMfaSetup();
  }, []);

  // 2. Soumission du code MFA pour validation et activation et récupérer les codes de secures
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: mfaCode })
      });

      const data = await response.json(); // On parse la réponse pour récupérer les données

      if (!response.ok) {
        throw new Error(data.detail || "Le code est invalide ou a expiré.");
      }

      showNotification('success', "L'authentification multifacteur (MFA) est désormais active !");

      // 🚨 AU LIEU DE FERMER, ON AFFICHE LES CODES DE SECOURS :
      setRecoveryCodes(data.recovery_codes);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };


  // 3. Gestion du copier-coller et du téléchargement des codes de secours
  const handleCopyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    const element = document.createElement("a");
    const file = new Blob([`Codes de secours FleetGuard SOC\n\n${recoveryCodes.join('\n')}\n\nÀ conserver en lieu sûr. Chaque code est à usage unique.`], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "fleetguard-recovery-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };




  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">

        {/* --- EN-TÊTE --- */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Sécuriser le compte</h3>
              <p className="text-slate-400 text-sm mt-0.5">Authentification Multifacteur (TOTP)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-white">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
              <p className="text-sm font-bold">Génération des clés cryptographiques...</p>
            </div>
          ) : recoveryCodes.length > 0 ? (

            /* ========================================================= */
            /* ÉCRAN DES CODES DE SECOURS (APRÈS ACTIVATION RÉUSSIE)     */
            /* ========================================================= */
            <div className="space-y-6 animate-fade-in">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <h4 className="text-sm font-black text-amber-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Sauvegardez vos codes de secours
                </h4>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Si vous perdez votre téléphone, ces codes sont le <strong>seul moyen</strong> d'accéder à votre tableau de bord.
                  Ils ne seront plus jamais affichés. Chaque code ne peut être utilisé qu'une seule fois.
                </p>
              </div>

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
                J'ai sauvegardé mes codes (Terminer)
              </button>
            </div>
          ) : (
            <div className="space-y-6">

              {/* --- ÉTAPE 1 : QR CODE --- */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm">
                  {qrUri ? (
                    <QRCodeSVG value={qrUri} size={160} level="M" includeMargin={false} />
                  ) : (
                    <div className="w-[160px] h-[160px] bg-slate-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">
                    1. Scannez ce QR Code avec <strong className="text-slate-800">Google Authenticator</strong> ou <strong className="text-slate-800">Authy</strong>.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">
                    Clé manuelle : {secret}
                  </p>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* --- ÉTAPE 2 : VALIDATION --- */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> 2. Code de confirmation à 6 chiffres
                  </label>
                  <input
                    type="text"
                    required
                    maxLength="6"
                    pattern="\d{6}"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} // N'accepte que les chiffres
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono text-center text-xl tracking-widest text-slate-800 placeholder:text-slate-300 shadow-inner"
                    placeholder="000000"
                    autoComplete="off"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || mfaCode.length !== 6}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                >
                  {isSubmitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Vérification...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Activer la protection MFA</>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}