import React, { useState } from 'react';
import { Download, ExternalLink, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-xs shadow-blue-700/20 transition-all whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5'
        }`}
        title="Installer B.O.C sur votre téléphone ou PC"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          Installer l’appli
        </span>
        {compact && <span className="sm:hidden">Installer</span>}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowGuide(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Installer B.O.C sur votre appareil"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <img
                  src="pwa-192x192.png"
                  alt="Icône B.O.C"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-lg border border-slate-200"
                />
                <h3 className="text-sm font-bold text-slate-900">
                  Installer B.O.C sur votre appareil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed">
              {isInIframe && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <p className="font-semibold text-blue-950">
                    Ouvrir en page complète pour l’installation directe :
                  </p>
                  <p className="text-blue-900">
                    Dans cet aperçu intégré, les navigateurs bloquent la fenêtre d’installation automatique. Ouvrez B.O.C dans un onglet dédié puis cliquez sur <strong>Installer l’appli</strong>.
                  </p>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800 transition-colors"
                  >
                    <span>Ouvrir B.O.C hors aperçu</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {isIOS ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Share className="w-4 h-4 text-blue-700" />
                    <span>Sur iPhone / iPad (Safari) :</span>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>
                      Appuyez sur le bouton <strong>Partager</strong> dans la barre Safari.
                    </li>
                    <li>
                      Faites défiler vers le bas et touchez{' '}
                      <strong>Sur l’écran d’accueil</strong>.
                    </li>
                    <li>
                      Confirmez en appuyant sur <strong>Ajouter</strong>.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Smartphone className="w-4 h-4 text-blue-700" />
                    <span>Sur Android / PC (Chrome, Edge) :</span>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>
                      Ouvrez le menu du navigateur (<strong>⋮</strong> sur Android ou icône d’installation dans la barre d’adresse sur PC).
                    </li>
                    <li>
                      Sélectionnez <strong>Installer l’application</strong> ou{' '}
                      <strong>Ajouter à l’écran d’accueil</strong>.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
