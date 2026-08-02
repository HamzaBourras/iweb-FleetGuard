import { useState } from 'react';
import logoImg from './assets/logo.png';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  
  // États de base
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 

  // ✨ NOUVEAUX ÉTATS POUR LE MFA ✨
  const [mfaCode, setMfaCode] = useState('');
  const [requiresMfa, setRequiresMfa] = useState(false);
  // Etats pour la récupération (si vous voulez gérer les codes de récupération)
  const [useRecovery, setUseRecovery] = useState(false); // ✨ NOUVEAU

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. On envoie la requête POST avec le mfa_code (qui sera null au 1er passage)
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email, 
          password,
          mfa_code: mfaCode ? mfaCode : null // On l'injecte seulement s'il a été tapé
        }),
      });

      const data = await response.json().catch(() => ({}));

      // 2. Interception spécifique du blocage MFA
      if (!response.ok) {
        if (response.status === 403 && data.detail === "MFA_REQUIRED") {
          setRequiresMfa(true); // Déclenche l'affichage du champ MFA
          return; // On arrête l'exécution ici, pas d'erreur affichée
        }
        
        throw new Error(data.detail || 'Erreur de connexion');
      }

      // 3. Redirection fluide vers le Dashboard après validation (MFA ou non)
      navigate('/dashboard', { replace: true });
      
    } catch (err) {
      setError(err.message);
      // En cas d'erreur sur le MFA, on vide le champ pour que l'admin recommence
      if (requiresMfa) setMfaCode(''); 
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
            {requiresMfa ? "Double authentification requise" : "Accès sécurisé au tableau de bord"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-center text-sm font-semibold animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* AFFICHAGE CONDITIONNEL : IDENTIFIANTS OU CODE MFA */}
          {!requiresMfa ? (
            <>
              {/* ... (Tes champs email et password existants restent identiques) ... */}
              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adresse Email
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  placeholder="admin@iweb.com"
                />
              </div>

              <div className="animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mot de passe
                </label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  placeholder="••••••••••••"
                />
              </div>
            </>
          ) : (
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
                
                <button 
                  type="button"
                  onClick={() => { setRequiresMfa(false); setUseRecovery(false); setMfaCode(''); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Annuler et retourner aux identifiants
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading || (requiresMfa && !useRecovery && mfaCode.length !== 6) || (requiresMfa && useRecovery && mfaCode.length < 10)}
            className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow transition-all duration-200 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}
          >
            {isLoading 
              ? 'Vérification...' 
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