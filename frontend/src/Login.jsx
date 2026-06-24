import { useState } from 'react';
import logoImg from './assets/logo.png'; // Assurez-vous que le chemin est correct

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Tentative avec :", email, password);
    // TODO: Connecter à l'API FastAPI
  };

  return (
    // Le conteneur principal (fond gris très clair)
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      
      {/* La carte centrale (blanche avec une ombre douce) */}
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        
        {/* En-tête */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src={logoImg} 
            alt="Logo iweb FleetGuard" 
            className="w-64 h-auto mb-3 rounded-md" 
          />
          <p className="text-gray-500 font-medium">Accès sécurisé au tableau de bord</p>
        </div>

        {/* Le Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Champ Email */}
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

          {/* Champ Mot de passe */}
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

          {/* Bouton de soumission */}
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow hover:shadow-lg transition-all duration-200"
          >
            Se connecter
          </button>
          
        </form>
      </div>
    </div>
  );
}