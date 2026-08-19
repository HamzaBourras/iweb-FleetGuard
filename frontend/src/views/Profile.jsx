/**
 * ============================================================================
 * Composant : Profile.jsx
 * Rôle      : Gestion du profil et des paramètres de sécurité de l'administrateur
 * Description :
 *    Espace personnel permettant à l'opérateur SOC de gérer ses propres accès. 
 *    Il centralise les actions de changement de mot de passe, l'activation 
 *    ou la reconfiguration du MFA (QR Code), ainsi que la génération et la
 *    visualisation de ses codes de secours d'urgence à usage unique.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { User, ShieldAlert, ShieldCheck, Mail, Lock, Key, Info } from 'lucide-react';
import MfaSetupModal from '../components/MfaSetupModal'; 
import ChangePasswordModal from '../components/ChangePasswordModal';
import RecoveryCodesModal from '../components/RecoveryCodesModal';

export default function Profile() {
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false); // À terme, ceci viendra d'un fetch() au chargement
  const [notification, setNotification] = useState(null);

  // État pour la modale de changement de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // État pour la modale de codes de secours
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Récupération de l'état réel du MFA au chargement de la page
  useEffect(() => {
    const fetchSecurityStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // Indispensable pour envoyer le cookie HttpOnly
        });
        
        if (response.ok) {
          const data = await response.json();
          setMfaEnabled(data.mfa_enabled); // Met à jour l'interface avec la vraie donnée de la BDD
        }
      } catch (error) {
        console.error("Erreur lors de la vérification du statut de sécurité :", error);
      }
    };

    fetchSecurityStatus();
  }, []);

  // Fonction dynamique pour afficher les toasts selon le type (success, info, warning, error)
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
    
    // Si l'activation réussit depuis la modale, on met à jour l'UI
    if (type === 'success') setMfaEnabled(true);
  };

  // --- GESTIONNAIRES D'ÉVÉNEMENTS DES BOUTONS ---

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handleReconfigureMfa = () => {
    // Ouvre simplement la modale existante, ce qui va regénérer un nouveau secret
    setShowMfaModal(true);
  };

  const handleViewRecoveryCodes = () => {
    setShowRecoveryModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* EN-TÊTE DE LA PAGE */}
      <div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Paramètres du profil</h2>
        <p className="text-slate-500 mt-1">Gérez vos informations de connexion et la sécurité de votre compte SOC.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ========================================================= */}
        {/* CARTE 1 : INFORMATIONS DE CONNEXION                        */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Informations personnelles</h3>
          </div>
          
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> Adresse Email
              </label>
              <input 
                type="email" 
                defaultValue="admin@iweb.com" 
                disabled
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" /> Mot de passe
              </label>
              <button 
                onClick={handleChangePassword}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors w-full sm:w-auto"
              >
                Modifier le mot de passe
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARTE 2 : SÉCURITÉ AVANCÉE (MFA)                           */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mfaEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <Key className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Authentification Multifacteur</h3>
          </div>
          
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* BANNIÈRE DYNAMIQUE */}
              {!mfaEnabled ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Sécurité vulnérable</h4>
                    <p className="text-xs text-amber-800 mt-1">
                      L'authentification à deux facteurs (MFA) n'est pas activée. Votre compte SOC est exposé en cas de vol de mot de passe.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex gap-3 items-start">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">Sécurité maximale active</h4>
                    <p className="text-xs text-emerald-800 mt-1">
                      Votre compte est protégé par l'authentification multifacteur (TOTP).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              {!mfaEnabled ? (
                <button 
                  onClick={() => setShowMfaModal(true)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" /> Configurer le MFA
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={handleReconfigureMfa}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all"
                  >
                    Reconfigurer le MFA
                  </button>
                  <button 
                    onClick={handleViewRecoveryCodes}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all"
                  >
                    Codes de secours
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MODALE MFA EXISTANTE */}
      {showMfaModal && (
        <MfaSetupModal 
          onClose={() => setShowMfaModal(false)} 
          showNotification={showNotification}
        />
      )}

      {/* MODALE CHANGEMENT MOT DE PASSE */}
      {showPasswordModal && (
        <ChangePasswordModal 
          onClose={() => setShowPasswordModal(false)} 
          showNotification={showNotification}
        />
      )}

      {/* MODALE CODES DE SECOURS */}
      {showRecoveryModal && (
        <RecoveryCodesModal 
          onClose={() => setShowRecoveryModal(false)} 
          showNotification={showNotification}
        />
      )}

      {/* SYSTÈME DE NOTIFICATIONS DYNAMIQUE */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl font-semibold border-l-4 ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
              : notification.type === 'info'
              ? 'bg-blue-50 border-blue-500 text-blue-800'
              : 'bg-red-50 border-red-500 text-red-800'
          }`}>
            {notification.type === 'success' && <ShieldCheck className="w-5 h-5 text-emerald-800" />}
            {notification.type === 'info' && <Info className="w-5 h-5 text-blue-800" />}
            {notification.type === 'error' && <ShieldAlert className="w-5 h-5 text-red-800" />}
            {notification.message}
          </div>
        </div>
      )}
    </div>
  );
}