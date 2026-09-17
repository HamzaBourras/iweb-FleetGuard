/**
 * ============================================================================
 * Composant : Login.jsx
 * Rôle      : Portail d'authentification des administrateurs
 * Description :
 *    Point d'entrée sécurisé de la plateforme. Ce composant gère la 
 *    vérification des identifiants et intègre la logique de l'Authentification 
 *    Multifacteur (MFA). Il gère la bascule dynamique entre la saisie du code 
 *    TOTP classique et l'utilisation des codes de secours en cas de perte d'appareil.
 * ============================================================================
 */
import { useState, useEffect } from 'react';
import logoImg from '../assets/logo.png';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowLeft, Clock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  
  // États de base
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 

  // États MFA
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false); 

  // États Mot de passe oublié
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  // ✨ NOUVEAUX ÉTATS : RATE LIMITING FRONT-END ✨
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // 1. Au montage, on vérifie si une pénalité est déjà stockée dans le navigateur
  useEffect(() => {
    const lockedUntil = localStorage.getItem('fleetguard_lockout_time');
    if (lockedUntil) {
      const remainingSeconds = Math.floor((parseInt(lockedUntil) - Date.now()) / 1000);
      if (remainingSeconds > 0) {
        setLockoutTimer(remainingSeconds);
      } else {
        localStorage.removeItem('fleetguard_lockout_time');
      }
    }
  }, []);

  // 2. Chronomètre dynamique qui décrémente chaque seconde
  useEffect(() => {
    let interval;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            localStorage.removeItem('fleetguard_lockout_time');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Formatage du chronomètre (ex: 14:59)
  const formatLockoutTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotSuccessMsg('');
    setIsLoading(true);

    try {
      if (isForgotPassword) {
        const response = await fetch('http://localhost:8000/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email }),
        });
        
        const data = await response.json();
        setForgotSuccessMsg(data.message);
        setIsLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email, 
          password,
          mfa_code: mfaCode ? mfaCode : null 
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // ✨ INTERCEPTION DU RATE LIMITING (CODE 429) ✨
        if (response.status === 429) {
          const lockDuration = 15 * 60; // 15 minutes
          setLockoutTimer(lockDuration);
          localStorage.setItem('fleetguard_lockout_time', Date.now() + (lockDuration * 1000));
          throw new Error("Trop de tentatives échouées. Par mesure de sécurité, la connexion est bloquée.");
        }

        if (response.status === 403 && data.detail === "MFA_REQUIRED") {
          setRequiresMfa(true); 
          return; 
        }
        throw new Error(data.detail || 'Erreur de connexion');
      }

      // En cas de succès, on purge les potentielles pénalités fantômes
      localStorage.removeItem('fleetguard_lockout_time');
      navigate('/dashboard', { replace: true });
      
    } catch (err) {
      setError(err.message);
      if (requiresMfa && lockoutTimer === 0) setMfaCode(''); 
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
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r flex items-start gap-2 text-sm font-semibold animate-fade-in">
             <AlertTriangle className="w-5 h-5 shrink-0" /> 
             <span>{error}</span>
          </div>
        )}

        {forgotSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r flex items-center gap-2 text-sm font-semibold animate-fade-in">
             <CheckCircle2 className="w-4 h-4" /> {forgotSuccessMsg}
          </div>
        )}

        {/* ✨ BANNIÈRE DE VERROUILLAGE VISUELLE ✨ */}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Adresse Email du compte
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-200"
                    placeholder="admin@iweb.com"
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setError(''); setForgotSuccessMsg(''); }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour à la connexion
                </button>
              </div>
            ) : requiresMfa ? (
              <div className="animate-fade-in space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                  {useRecovery ? "Code de secours à usage unique" : "Code à 6 chiffres (Google Auth / Authy)"}
                </label>
                <input 
                  type="text" 
                  required
                  value={mfaCode}
                  onChange={(e) => {
                    // Si on est en mode secours, on accepte tout (lettres, chiffres, tirets).
                    // Sinon, on n'accepte que les chiffres.
                    const val = e.target.value;
                    setMfaCode(useRecovery ? val.toUpperCase() : val.replace(/\D/g, ''));
                  }}
                  maxLength={useRecovery ? 14 : 6}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors text-center text-xl tracking-[0.2em] font-mono shadow-inner uppercase"
                  placeholder={useRecovery ? "XXXX-XXXX-XXXX" : "000000"}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <button 
                  type="button"
                  onClick={() => { setUseRecovery(!useRecovery); setMfaCode(''); }}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {useRecovery ? "Utiliser l'application d'authentification" : "J'ai perdu mon téléphone (Code de secours)"}
                </button>
                
                {/* <button 
                  type="button"
                  onClick={() => { setRequiresMfa(false); setUseRecovery(false); setMfaCode(''); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Annuler et retourner aux identifiants
                </button> */}
              </div>
            </div>
            ) : (
              <>
                <div className="animate-fade-in mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300"
                    placeholder="admin@iweb.com"
                  />
                </div>
                <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Mot de passe</label>
                    <button 
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(''); }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300"
                    placeholder="••••••••••••"
                  />
                </div>
              </>
            )}
          </div>

          {/* ✨ BOUTON SOUMETTRE DYNAMIQUE (Désactivé si LockoutTimer > 0) ✨ */}
          <button 
            type="submit"
            disabled={isLoading || lockoutTimer > 0 || (requiresMfa && !useRecovery && mfaCode.length !== 6) || (requiresMfa && useRecovery && mfaCode.length < 10)}
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