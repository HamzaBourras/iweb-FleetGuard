import { Navigate } from 'react-router-dom';

export default function PublicRoute({ children }) {
  const token = localStorage.getItem('fleetguard_token');

  // Si l'utilisateur possède déjà un token, on le renvoie de force vers le Dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  // S'il n'a pas de token, on le laisse accéder au composant enfant (la page Login)
  return children;
}