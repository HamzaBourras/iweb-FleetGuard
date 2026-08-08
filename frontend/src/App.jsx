import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Guide from './views/Guide';
import SiteInvestigation from './views/SiteInvestigation';
import Profile from './views/Profile';
import Overview from './views/Overview';
import SitesList from './views/SitesList';
import SecurityAlerts from './views/SecurityAlerts';

import PublicRoute from './router/PublicRoute'; 
import ProtectedRoute from './router/ProtectedRoute';

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
          <Route path="sites/:id" element={<SiteInvestigation />} /> {/* ✨ NOUVELLE ROUTE */}
          <Route path="alerts" element={<SecurityAlerts />} />
          {/* ✨ 2. On ajoute la route pour le guide */}
          <Route path="guide" element={<Guide />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Redirection automatique par défaut */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}