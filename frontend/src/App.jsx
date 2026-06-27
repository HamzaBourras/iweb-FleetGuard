import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute'; // <-- 1. Nouvelle importation

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* Route Publique : Protégée contre les utilisateurs DÉJÀ connectés */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />

        {/* Route Protégée : Protégée contre les utilisateurs NON connectés */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Redirection automatique par défaut */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}