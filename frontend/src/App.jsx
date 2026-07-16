import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute'; // <-- 1. Nouvelle importation
import Guide from './Guide';
import SiteDetail from './SiteDetail';

// Importation de nos nouvelles vues
import Overview from './Overview';
import SitesList from './SitesList';
import SecurityAlerts from './SecurityAlerts';

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
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
          {/* L'attribut "index" signifie que c'est la vue par défaut si on va sur /dashboard */}
          <Route index element={<Overview />} />
          
          {/* Les sous-routes (ex: /dashboard/sites) */}
          <Route path="sites" element={<SitesList />} />
          <Route path="sites/:id" element={<SiteDetail />} /> {/* ✨ NOUVELLE ROUTE */}
          <Route path="alerts" element={<SecurityAlerts />} />
          {/* ✨ 2. On ajoute la route pour le guide */}
          <Route path="guide" element={<Guide />} />
        </Route>

        {/* Redirection automatique par défaut */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}