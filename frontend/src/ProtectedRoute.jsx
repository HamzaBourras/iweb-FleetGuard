import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  // null = en cours de vérification, true = connecté, false = rejeté
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // On demande à FastAPI si notre cookie est valide
        const response = await fetch('http://localhost:8000/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // 🛡️ CRUCIAL : Indique au navigateur d'envoyer le cookie
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        // En cas d'erreur réseau ou si le backend est injoignable
        setIsAuthenticated(false); 
      }
    };

    verifySession();
  }, []);

  // 1. Pendant l'interrogation du serveur, on affiche un écran de chargement
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-pulse text-slate-500 font-bold flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Vérification de la session sécurisée...
        </div>
      </div>
    );
  }

  // 2. Si le cookie est absent ou invalide, on redirige de force vers le login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si FastAPI valide le cookie, on affiche le composant enfant (Dashboard)
  return children;
}