import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

export default function PublicRoute({ children }) {
  // null = en cours de vérification, true = déjà connecté, false = non connecté
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // On interroge FastAPI pour tester la validité du cookie
        const response = await fetch('http://localhost:8000/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // 🛡️ Envoie automatiquement le cookie HttpOnly
        });

        if (response.ok) {
          setIsAuthenticated(true); // Le backend valide la session
        } else {
          setIsAuthenticated(false); // Aucun cookie ou cookie expiré
        }
      } catch (error) {
        // En cas d'erreur de connexion au serveur, on laisse l'accès au login par défaut
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
          <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          Chargement de l'interface...
        </div>
      </div>
    );
  }

  // 2. Si l'utilisateur possède déjà une session valide, on le renvoie de force vers le Dashboard
  if (isAuthenticated) {
    // ⚠️ Modifie la route cible si l'accueil de ton dashboard n'est pas "/"
    return <Navigate to="/" replace />; 
  }

  // 3. S'il n'est pas connecté, on le laisse accéder au composant enfant (la page Login)
  return children;
}