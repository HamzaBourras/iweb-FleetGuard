import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, X, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';

export default function MfaSetupModal({ onClose, showNotification }) {
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // 2. Soumission du code à 6 chiffres pour validation finale
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

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || "Le code est invalide ou a expiré.");
      }

      showNotification('success', "L'authentification multifacteur (MFA) est désormais active !");
      onClose(); // On ferme la modale en cas de succès
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
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