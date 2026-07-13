import { useState } from 'react';
import logoImg from './assets/logo.png';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // Pour stocker les messages d'erreur de l'API
  const [isLoading, setIsLoading] = useState(false); // Pour faire patienter l'utilisateur

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. On envoie la requête POST à FastAPI
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // 2. Si le serveur refuse l'accès (erreur 401 ou 403)
      if (!response.ok) {
        throw new Error(data.detail || 'Erreur de connexion');
      }

      // 3. Si c'est un succès, on sauvegarde le Token VIP dans le navigateur
      localStorage.setItem('fleetguard_token', data.access_token);
      
      // Redirection fluide vers le Dashboard
      navigate('/dashboard', { replace: true });

      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        
        <div className="text-center mb-4 flex flex-col items-center border-b border-gray-200 pb-4">
          <img 
            src={logoImg} 
            alt="Logo iweb FleetGuard" 
            className="w-64 h-auto mb-3 rounded-md" 
          />
          <p className="text-gray-500 font-medium">Accès sécurisé au tableau de bord</p>
        </div>

        {/* Affichage du message d'erreur s'il y en a un */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-center text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
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

          <div>
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

          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-3 px-4 rounded-lg shadow transition-all duration-200 ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}
          >
            {isLoading ? 'Vérification...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}