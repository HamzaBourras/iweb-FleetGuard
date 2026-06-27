import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('fleetguard_token');

  // Si le token n'existe pas, on redirige de force vers la page de login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si le token existe, on affiche le composant enfant (le Dashboard)
  return children;
}