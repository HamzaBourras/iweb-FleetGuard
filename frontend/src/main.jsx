/**
 * ============================================================================
 * Fichier     : main.jsx (ou index.jsx)
 * Rôle        : Point de montage de l'application React (Entry point)
 * Description :
 *    Fichier racine qui amorce l'exécution du framework React. Il 
 *    sélectionne l'élément HTML "#root", active le mode strict (StrictMode) 
 *    pour la détection d'erreurs au développement, et injecte le composant 
 *    principal App ainsi que la feuille de style globale dans le DOM du navigateur.
 * ============================================================================
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
