import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, formatFirebaseAuthError, googleProvider } from '../firebase';
import { PWAInstallButton } from './PWAInstallButton';

export const LoginGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(formatFirebaseAuthError(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#071430] via-[#0E275E] to-[#081A42] flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-2xl border border-white/20 p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-blue-500/30 shadow-lg shadow-blue-900/20 bg-[#052BB8] shrink-0">
            <img
              src="src/assets/images/boc_logo_emblem_flashy.png"
              alt="Logo B.O.C"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              B.O.C
            </h1>
            <p className="text-xs font-semibold text-blue-700">
              Boîte à Outils du Contrôleur
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-600 leading-relaxed">
            Connectez votre compte pour ouvrir votre espace regroupant vos outils de chantier et de pilotage.
          </p>
          <p className="text-xs font-medium text-slate-500">
            JDT · Project-Controler · Appli-Photo · Planning · To-Do · Calendrier · Notes
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-sm font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-md shadow-blue-700/25 disabled:opacity-60 transition-all"
        >
          <span>
            {loading
              ? 'Connexion en cours...'
              : 'Lier et ouvrir mon compte contrôleur'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-3">
          <PWAInstallButton />
          <p className="text-[11px] text-slate-400 text-center">
            Fabien Pirquin · Boîte à Outils du Contrôleur
          </p>
        </div>
      </div>
    </div>
  );
};
