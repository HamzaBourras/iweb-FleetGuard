import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function ResetPassword() {
  const navigate = useNavigate();

  // Jeton lu dans le fragment d'URL (#token=...), jamais envoyé au serveur dans l'URL
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'));

  // État du lien : 'checking' | 'invalid' | 'valid'
  const [linkStatus, setLinkStatus] = useState(token ? 'checking' : 'invalid');
  const [linkError, setLinkError] = useState(
    token ? '' : 'Lien de réinitialisation invalide ou manquant.'
  );

  // Formulaire
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // MFA
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Vérification du lien dès l'arrivée sur la page (sans consommer le jeton)
  useEffect(() => {
    // Retire le jeton de la barre d'adresse et de l'historique
    window.history.replaceState(null, '', '/reset-password');
    if (!token) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('http://localhost:8000/api/auth/reset-password/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (cancelled) return;

        if (res.ok) {
          setLinkStatus('valid');
        } else {
          const data = await res.json().catch(() => ({}));
          setLinkError(
            typeof data.detail === 'string' ? data.detail : 'Lien invalide, expiré ou déjà utilisé.'
          );
          setLinkStatus('invalid');
        }
      } catch {
        if (cancelled) return;
        setLinkError('Impossible de vérifier le lien. Réessayez plus tard.');
        setLinkStatus('invalid');
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    // Validation du mot de passe selon les critères définis dans le backend
    if (newPassword.length < 14 || newPassword.length > 16) {
      setError('Le mot de passe doit contenir entre 14 et 16 caractères.');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Le mot de passe doit contenir majuscule, minuscule et chiffre.');
      return;
    }

    if (!/[@#$%^&+=]/.test(newPassword)) {
      setError('Le mot de passe doit contenir au moins un caractère spécial (@#$%^&+=).');
      return;
    }

    if (mfaRequired) {
      // 14 caractères = anciens codes, 27 = nouveaux codes (point 5)
      if (useRecovery && mfaCode.length < 14) {
        setError('Le code de secours semble incomplet.');
        return;
      }
      if (!useRecovery && mfaCode.length !== 6) {
        setError('Le code à 6 chiffres est requis.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          mfa_code: mfaCode || null // Envoi du code s'il est saisi
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Interception de l'exigence MFA
        if (response.status === 403 && data.detail === 'MFA_REQUIRED') {
          setMfaRequired(true);
          return;
        }

        // Le lien a été invalidé entre-temps (déjà utilisé, expiré) : on affiche la vue "lien invalide"
        if (response.status === 400 && typeof data.detail === 'string' && /lien/i.test(data.detail)) {
          setLinkError(data.detail);
          setLinkStatus('invalid');
          return;
        }

        const message = typeof data.detail === 'string'
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((d) => String(d?.msg || '').replace(/^Value error,\s*/i, '')).filter(Boolean).join(' ')
            : '';
        throw new Error(message || 'Erreur lors de la réinitialisation.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">

        <div className="text-center mb-6 flex flex-col items-center border-b border-gray-200 pb-4">
          <img src={logoImg} alt="Logo iweb FleetGuard" className="w-56 h-auto mb-4" />
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Nouveau mot de passe
          </h2>
        </div>

        {/* ÉTAT 1 : vérification du lien en cours */}
        {linkStatus === 'checking' && (
          <div className="text-center text-slate-500 font-semibold animate-pulse py-6">
            Vérification du lien...
          </div>
        )}

        {/* ÉTAT 2 : lien invalide, expiré ou déjà utilisé (aucun formulaire) */}
        {linkStatus === 'invalid' && (
          <div className="text-center space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex flex-col items-center gap-2">
              <AlertTriangle className="w-10 h-10" />
              <p className="font-bold">{linkError}</p>
              <p className="text-sm">Demandez un nouveau lien depuis la page de connexion.</p>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full text-white font-bold py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 transition-all"
            >
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ÉTAT 3 : lien valide -> formulaire, puis écran de succès */}
        {linkStatus === 'valid' && (
          success ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <p className="font-bold">Mot de passe mis à jour !</p>
                <p className="text-sm">Votre compte est à nouveau sécurisé.</p>
              </div>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full text-white font-bold py-3 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 transition-all"
              >
                Retourner à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex items-start gap-2 text-sm font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* On masque les champs de mot de passe si le MFA est requis pour alléger l'interface */}
              <div className={mfaRequired ? 'hidden' : 'block'}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    required={!mfaRequired}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-200"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    required={!mfaRequired}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-200"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              {/* Champ MFA conditionnel */}
              {mfaRequired && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {useRecovery ? 'Code de secours à usage unique' : 'Code à 6 chiffres (Google Auth / Authy)'}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    {useRecovery
                      ? "Entrez l'un de vos codes de secours non utilisés."
                      : "Saisissez votre code d'application."}
                  </p>
                  <input
                    type="text"
                    required
                    value={mfaCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      // En mode secours : lettres/chiffres/tirets acceptés. Sinon : chiffres uniquement.
                      setMfaCode(useRecovery ? val.toUpperCase() : val.replace(/\D/g, ''));
                    }}
                    maxLength={useRecovery ? 27 : 6}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-200 text-center tracking-widest font-mono uppercase"
                    placeholder={useRecovery ? 'XXXXXX-XXXXXX-XXXXXX-XXXXXX' : '123456'}
                    autoComplete="off"
                  />

                  <button
                    type="button"
                    onClick={() => { setUseRecovery(!useRecovery); setMfaCode(''); setError(''); }}
                    className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors mt-3"
                  >
                    {useRecovery
                      ? "Utiliser l'application d'authentification"
                      : "J'ai perdu mon téléphone (Code de secours)"}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow transition-all ${
                  isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Vérification...' : (mfaRequired ? 'Valider le code MFA' : 'Valider le mot de passe')}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}