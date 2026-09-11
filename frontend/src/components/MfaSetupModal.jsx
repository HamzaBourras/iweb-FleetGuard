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
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, X, RefreshCw, AlertTriangle, Smartphone, Download, Copy, Check, Key } from 'lucide-react';

export default function MfaSetupModal({ onClose, showNotification }) {
  // Gestion des étapes : 0 = Mot de passe, 1 = QR Code, 2 = Codes de secours
  const [step, setStep] = useState(0); 
  
  // États de données
  const [password, setPassword] = useState('');
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  
  // États UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 1. Soumission du mot de passe pour récupérer le QR Code
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/mfa/setup', {
        method: 'POST', // Modifié en POST
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Impossible de générer le QR Code.");

      setQrUri(data.qr_uri);
      setSecret(data.secret);
      setStep(1); // On passe à l'affichage du QR Code

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Soumission du code MFA à 6 chiffres pour valider
  const handleMfaSubmit = async (e) => {
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

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Le code est invalide ou a expiré.");

      showNotification('success', "L'authentification multifacteur (MFA) est désormais active !");
      setRecoveryCodes(data.recovery_codes);
      setStep(2); // On passe aux codes de secours

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Gestion de la copie et du téléchargement
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
          
          {/* ÉTAPE 0 : VÉRIFICATION DU MOT DE PASSE */}
          {step === 0 && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fade-in">
              <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm font-medium border border-blue-100">
                Par mesure de sécurité, veuillez confirmer votre mot de passe avant de configurer le MFA.
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !password}
                className="w-full mt-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Vérification...</> : "Continuer"}
              </button>
            </form>
          )}

          {/* ÉTAPE 1 : QR CODE ET CODE MFA */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm">
                  <QRCodeSVG value={qrUri} size={160} level="M" includeMargin={false} />
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

              <form onSubmit={handleMfaSubmit} className="space-y-4">
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
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
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

          {/* ÉTAPE 2 : CODES DE SECOURS */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <h4 className="text-sm font-black text-amber-900 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Sauvegardez vos codes de secours
                </h4>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Si vous perdez votre téléphone, ces codes sont le <strong>seul moyen</strong> d'accéder à votre tableau de bord.
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
          )}
        </div>
      </div>
    </div>
  );
}