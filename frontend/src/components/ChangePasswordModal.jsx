/**
 * ============================================================================
 * Composant : ChangePasswordModal.jsx
 * Rôle      : Interface de modification du mot de passe administrateur
 * Description :
 *    Modale sécurisée permettant à un opérateur SOC de mettre à jour son mot de
 *    passe. Elle vérifie l'ancien mot de passe avant d'appliquer le nouveau via 
 *    l'API FastAPI. Inclut des validations côté client (longueur, correspondance).
 * ============================================================================
 */

import { useState } from 'react';
import { Lock, X, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ChangePasswordModal({ onClose, showNotification }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erreur lors du changement de mot de passe.");
      }

      showNotification('success', data.message);
      onClose(); // Ferme la modale en cas de succès
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        
        {/* --- EN-TÊTE --- */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Changer le mot de passe</h3>
              <p className="text-slate-400 text-sm mt-0.5">Assurez-vous de choisir un mot de passe robuste.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Mot de passe actuel</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <hr className="border-slate-100 my-4" />

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Nouveau mot de passe</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
              className="w-full mt-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
            >
              {isSubmitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Mise à jour...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Enregistrer le mot de passe</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}