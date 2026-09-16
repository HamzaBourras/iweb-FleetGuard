import { Terminal, X, RefreshCw, ShieldCheck, FileWarning } from 'lucide-react';

export default function FileInspectionModal({
  fileToInspect,
  fileContent,
  isFetchingFile,
  onClose,
  onWhitelist,
  onDelete
}) {
  // Si aucun fichier n'est sélectionné, on n'affiche rien
  if (!fileToInspect) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* En-tête de la modale */}
        <div className="p-4 md:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <Terminal className="w-6 h-6 text-blue-400 shrink-0" />
            <div className="truncate">
              <h3 className="text-lg font-black text-white truncate">Inspection Forensique</h3>
              <p className="text-slate-400 text-xs mt-1 font-mono truncate">{fileToInspect}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Corps de la modale : Affichage du code ou du chargement */}
        <div className="flex-1 overflow-auto bg-[#0d1117] p-4 md:p-6">
          {isFetchingFile ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="font-mono text-sm">Extraction du payload depuis le serveur distant...</p>
            </div>
          ) : (
            <pre className="text-sm font-mono text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
              <code>{fileContent || "Fichier vide ou illisible."}</code>
            </pre>
          )}
        </div>

        {/* Pied de la modale : Boutons d'action */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => { onClose(); onWhitelist(fileToInspect); }}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" /> Marquer Sain
            </button>
            <button
              onClick={() => { onClose(); onDelete(fileToInspect); }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <FileWarning className="w-4 h-4" /> Détruire le fichier
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}