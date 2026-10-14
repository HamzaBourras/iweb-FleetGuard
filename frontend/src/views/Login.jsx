/**
 * ============================================================================
 * Composant : Login.jsx
 * Rôle      : Portail d'authentification des administrateurs
 * Description :
 *    Point d'entrée sécurisé de la plateforme. Ce composant gère la
 *    vérification des identifiants et intègre la logique de l'Authentification
 *    Multifacteur (MFA). Il gère la bascule dynamique entre la saisie du code
 *    TOTP classique et l'utilisation des codes de secours en cas de perte d'appareil.
 *
 *    Gestion des erreurs API :
 *    - 422 (validation Pydantic/FastAPI) : `detail` est un TABLEAU d'objets
 *      { type, loc, msg, ctx, input }. Les messages sont traduits et affichés
 *      sous le champ concerné (jamais `input`, qui contient le mot de passe).
 *    - 401 / 403 / autres : `detail` est une chaîne.
 *    - 429 : durée de blocage lue dans Retry-After, sinon déduite de la réponse.
 *    - Erreur réseau / réponse non JSON : message explicite.
 * ============================================================================
 */
import { useState, useEffect } from 'react';
import logoImg from '../assets/logo.png';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowLeft, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LOCKOUT_KEY = 'fleetguard_lockout_time';
const LOGIN_LOCKOUT_SECONDS = 15 * 60; // Blocage défini côté backend (auth.py)
const RATE_LIMIT_FALLBACK_SECONDS = 60; // Limite slowapi "5/minute" sans en-tête Retry-After

// ---------------------------------------------------------------------------
// Utilitaires : verrouillage (stocké sous forme d'horodatage de fin)
// ---------------------------------------------------------------------------
const readStoredLockout = () => {
  try {
    const until = parseInt(localStorage.getItem(LOCKOUT_KEY), 10);
    if (Number.isFinite(until) && until > Date.now()) return until;
    localStorage.removeItem(LOCKOUT_KEY);
  } catch {
    /* stockage indisponible : on ignore */
  }
  return 0;
};

const storeLockout = (until) => {
  try {
    localStorage.setItem(LOCKOUT_KEY, String(until));
  } catch {
    /* stockage indisponible : on ignore */
  }
};

const clearStoredLockout = () => {
  try {
    localStorage.removeItem(LOCKOUT_KEY);
  } catch {
    /* stockage indisponible : on ignore */
  }
};

const formatLockoutTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ---------------------------------------------------------------------------
// Utilitaires : analyse des erreurs renvoyées par FastAPI
// ---------------------------------------------------------------------------

// Champ backend (dernier élément de `loc`) -> champ du formulaire
const FIELD_MAP = {
  email: 'email',
  password: 'password',
  mfa_code: 'mfa',
};

// Messages Pydantic v2 (anglais) traduits par type d'erreur
const translateValidationError = (err) => {
  const ctx = err.ctx || {};
  switch (err.type) {
    case 'missing':
      return 'Ce champ est obligatoire.';
    case 'string_too_short':
      return `Au moins ${ctx.min_length} caractère(s) requis.`;
    case 'string_too_long':
      return `${ctx.max_length} caractères maximum.`;
    case 'string_type':
    case 'string_pattern_mismatch':
      return 'Format invalide.';
    case 'json_invalid':
      return 'La requête envoyée est invalide.';
    case 'value_error':
      // Nos validateurs lèvent ValueError("message FR") : Pydantic préfixe "Value error, "
      return String(err.msg || 'Valeur invalide.').replace(/^Value error,\s*/i, '');
    default:
      return String(err.msg || 'Valeur invalide.').replace(/^Value error,\s*/i, '');
  }
};

/**
 * Transforme n'importe quelle réponse d'erreur en { message, fieldErrors }.
 * @param data            corps JSON de la réponse (ou {})
 * @param visibleFields   champs réellement affichés dans l'écran courant
 */
const parseApiError = (data, visibleFields) => {
  const detail = data?.detail;

  // Cas 1 : chaîne simple (HTTPException)
  if (typeof detail === 'string') {
    return { message: detail, fieldErrors: {} };
  }

  // Cas 2 : tableau de violations de validation (422)
  if (Array.isArray(detail)) {
    const fieldErrors = {};
    const general = [];

    detail.forEach((err) => {
      const text = translateValidationError(err);
      const backendField = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const field = FIELD_MAP[backendField];

      if (field && visibleFields.includes(field)) {
        // On garde la première erreur par champ
        if (!fieldErrors[field]) fieldErrors[field] = text;
      } else {
        general.push(text);
      }
    });

    const hasInline = Object.keys(fieldErrors).length > 0;
    const message = general.length > 0
      ? general.join(' ')
      : hasInline
        ? 'Certains champs sont invalides. Corrigez-les puis réessayez.'
        : 'Les données envoyées sont invalides.';

    return { message, fieldErrors };
  }

  // Cas 3 : autres formats (slowapi -> { error }, message simple, etc.)
  if (typeof data?.error === 'string') return { message: data.error, fieldErrors: {} };
  if (typeof data?.message === 'string') return { message: data.message, fieldErrors: {} };

  return { message: 'Erreur de connexion. Veuillez réessayer.', fieldErrors: {} };
};

// ---------------------------------------------------------------------------
// Petits composants
// ---------------------------------------------------------------------------
const FieldError = ({ id, message }) =>
  message ? (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-600">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>{message}</span>
    </p>
  ) : null;

const baseInput = 'w-full px-4 py-3 rounded-lg bg-gray-50 border';
const inputBorder = (hasError, focus = 'focus:ring-2 focus:ring-blue-200') =>
  hasError
    ? `border-red-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200`
    : `border-gray-300 ${focus}`;

export default function Login() {
  const navigate = useNavigate();

  // États de base
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({}); // { email?, password?, mfa? }
  const [isLoading, setIsLoading] = useState(false);

  // États MFA
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  // États Mot de passe oublié
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  // Verrouillage : on stocke l'instant de fin, le compte à rebours en est déduit
  const [lockedUntil, setLockedUntil] = useState(readStoredLockout);
  const [now, setNow] = useState(() => Date.now());
  const lockoutTimer = lockedUntil > 0 ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;

  // Tic d'horloge tant qu'un verrouillage est actif
  useEffect(() => {
    if (lockedUntil <= 0) return undefined;

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        clearStoredLockout();
        setLockedUntil(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  const startLockout = (seconds) => {
    const until = Date.now() + seconds * 1000;
    setNow(Date.now());
    setLockedUntil(until);
    storeLockout(until);
  };

  // Efface l'erreur d'un champ dès que l'utilisateur le modifie
  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    setError('');
    setFieldErrors({});
    setForgotSuccessMsg('');
    setIsLoading(true);

    // Valeurs figées au moment du clic (le state change pendant l'appel)
    const isMfaAttempt = requiresMfa;
    const visibleFields = isForgotPassword ? ['email'] : requiresMfa ? ['mfa'] : ['email', 'password'];

    try {
      const endpoint = isForgotPassword ? '/api/auth/forgot-password' : '/api/auth/login';
      const body = isForgotPassword
        ? { email: email.trim() }
        : { email: email.trim(), password, mfa_code: mfaCode || null };

      let response;
      try {
        response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
      } catch {
        setError('Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.');
        return;
      }

      // Réponse non JSON (ex. page HTML d'erreur 500) : on continue avec {}
      const data = await response.json().catch(() => ({}));

      // --- SUCCÈS ---
      if (response.ok) {
        if (isForgotPassword) {
          setForgotSuccessMsg(
            data.message || 'Si cette adresse existe, un email contenant les instructions a été envoyé.'
          );
          return;
        }
        clearStoredLockout();
        navigate('/dashboard', { replace: true });
        return;
      }

      // --- 429 : TROP DE TENTATIVES ---
      if (response.status === 429) {
        if (isForgotPassword) {
          // La limite "3/heure" ne doit pas bloquer le formulaire de connexion
          setError('Trop de demandes de réinitialisation. Réessayez plus tard.');
          return;
        }

        const retryAfter = parseInt(response.headers.get('Retry-After'), 10);
        const seconds = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter
          : typeof data.detail === 'string'
            ? LOGIN_LOCKOUT_SECONDS // blocage par compteur d'échecs (auth.py)
            : RATE_LIMIT_FALLBACK_SECONDS; // limite slowapi

        startLockout(seconds);
        setError(
          seconds >= 120
            ? 'Trop de tentatives échouées. Par mesure de sécurité, la connexion est bloquée.'
            : 'Trop de requêtes en peu de temps. Patientez quelques instants avant de réessayer.'
        );
        return;
      }

      // --- 403 MFA_REQUIRED : passage à l'écran du code ---
      if (response.status === 403 && data.detail === 'MFA_REQUIRED' && !isForgotPassword) {
        setRequiresMfa(true);
        return;
      }

      // --- 422 / 401 / 403 / 5xx : message + erreurs par champ ---
      const parsed = parseApiError(data, visibleFields);
      setError(response.status >= 500 ? 'Erreur interne du serveur. Réessayez plus tard.' : parsed.message);
      setFieldErrors(parsed.fieldErrors);
      if (isMfaAttempt) setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100 transition-all duration-300">

        <div className="text-center mb-4 flex flex-col items-center border-b border-gray-200 pb-4">
          <img
            src={logoImg}
            alt="Logo iweb FleetGuard"
            className="w-64 h-auto mb-3 rounded-md"
          />
          <p className="text-gray-500 font-medium">
            {isForgotPassword
              ? "Récupération du compte"
              : requiresMfa
                ? "Double authentification requise"
                : "Accès sécurisé au tableau de bord"}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r flex items-start gap-2 text-sm font-semibold animate-fade-in">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {forgotSuccessMsg && (
          <div role="status" className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r flex items-center gap-2 text-sm font-semibold animate-fade-in">
            <CheckCircle2 className="w-4 h-4" /> {forgotSuccessMsg}
          </div>
        )}

        {/* BANNIÈRE DE VERROUILLAGE VISUELLE */}
        {lockoutTimer > 0 && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex flex-col items-center justify-center text-orange-800 animate-pulse">
            <Clock className="w-8 h-8 mb-2 opacity-80" />
            <span className="font-black text-2xl tracking-widest">{formatLockoutTime(lockoutTimer)}</span>
            <span className="text-xs uppercase font-bold mt-1 opacity-70">Verrouillage de sécurité</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Les vues (Oublié, MFA, Classique) sont masquées/désactivées si verrouillé */}
          <div className={lockoutTimer > 0 ? 'opacity-40 pointer-events-none filter blur-[1px]' : ''}>
            {isForgotPassword ? (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Adresse Email du compte
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'forgot-email-error' : undefined}
                    className={`${baseInput} ${inputBorder(!!fieldErrors.email)}`}
                    placeholder="admin@iweb.com"
                  />
                  <FieldError id="forgot-email-error" message={fieldErrors.email} />
                </div>
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setError(''); setFieldErrors({}); setForgotSuccessMsg(''); }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                </button>
              </div>
            ) : requiresMfa ? (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label htmlFor="mfa-code" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                    {useRecovery ? "Code de secours à usage unique" : "Code à 6 chiffres (Google Auth / Authy)"}
                  </label>
                  <input
                    id="mfa-code"
                    type="text"
                    required
                    value={mfaCode}
                    onChange={(e) => {
                      // Mode secours : lettres, chiffres, tirets. Sinon : chiffres uniquement.
                      const val = e.target.value;
                      setMfaCode(useRecovery ? val.toUpperCase() : val.replace(/\D/g, ''));
                      clearFieldError('mfa');
                    }}
                    maxLength={useRecovery ? 14 : 6}
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    aria-invalid={!!fieldErrors.mfa}
                    aria-describedby={fieldErrors.mfa ? 'mfa-code-error' : undefined}
                    className={`${baseInput} ${inputBorder(!!fieldErrors.mfa, 'focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200')} text-gray-900 transition-colors text-center text-xl tracking-[0.2em] font-mono shadow-inner uppercase`}
                    placeholder={useRecovery ? "XXXX-XXXX-XXXX" : "000000"}
                    autoComplete="off"
                    autoFocus
                  />
                  <FieldError id="mfa-code-error" message={fieldErrors.mfa} />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => { setUseRecovery(!useRecovery); setMfaCode(''); setError(''); setFieldErrors({}); }}
                    className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {useRecovery ? "Utiliser l'application d'authentification" : "J'ai perdu mon téléphone (Code de secours)"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="animate-fade-in mb-4">
                  <label htmlFor="login-email" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                    className={`${baseInput} ${inputBorder(!!fieldErrors.email, '')}`}
                    placeholder="admin@iweb.com"
                  />
                  <FieldError id="login-email-error" message={fieldErrors.email} />
                </div>
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700">Mot de passe</label>
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(''); setFieldErrors({}); }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    className={`${baseInput} ${inputBorder(!!fieldErrors.password, '')}`}
                    placeholder="••••••••••••"
                  />
                  <FieldError id="login-password-error" message={fieldErrors.password} />
                </div>
              </>
            )}
          </div>

          {/* BOUTON SOUMETTRE DYNAMIQUE (désactivé si verrouillé) */}
          <button
            type="submit"
            disabled={
              isLoading ||
              lockoutTimer > 0 ||
              (requiresMfa && !useRecovery && mfaCode.length !== 6) ||
              (requiresMfa && useRecovery && mfaCode.length < 10)
            }
            className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow transition-all duration-200 ${
              lockoutTimer > 0
                ? 'bg-slate-400 cursor-not-allowed'
                : isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {lockoutTimer > 0
              ? `Réessayez dans ${formatLockoutTime(lockoutTimer)}`
              : isLoading
                ? 'Traitement...'
                : isForgotPassword
                  ? 'Recevoir le lien'
                  : requiresMfa
                    ? 'Valider le code'
                    : 'Se connecter'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
