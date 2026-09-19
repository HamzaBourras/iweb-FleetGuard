import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); 

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Nouveaux états pour le MFA
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Lien de réinitialisation invalide ou manquant.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: token, 
          new_password: newPassword,
          mfa_code: mfaCode || null // Envoi du code s'il est saisi
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Interception de l'exigence MFA
        if (response.status === 403 && data.detail === "MFA_REQUIRED") {
          setMfaRequired(true);
          return; 
        }
        throw new Error(data.detail || "Erreur lors de la réinitialisation.");
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

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex items-start gap-2 text-sm font-semibold">
             <AlertTriangle className="w-5 h-5 shrink-0" /> 
             <span>{error}</span>
          </div>
        )}

        {success ? (
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
            
            {/* On masque les champs de mot de passe si le MFA est requis pour alléger l'interface */}
            <div className={mfaRequired ? 'hidden' : 'block'}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Nouveau mot de passe
                </label>
                <input 
                  type="password" 
                  required={!mfaRequired}
                  disabled={!token}
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
                  disabled={!token}
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
                  Code de sécurité MFA
                </label>
                <p className="text-xs text-gray-500 mb-2">Saisissez votre code d'application.</p>
                <input 
                  type="text" 
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 focus:ring-2 focus:ring-blue-200 text-center tracking-widest font-mono"
                  placeholder="123456"
                  autoComplete="off"
                />
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading || !token}
              className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow transition-all ${
                isLoading || !token ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Vérification...' : (mfaRequired ? 'Valider le code MFA' : 'Valider le mot de passe')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}