import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export const LoginGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser la connexion.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-12">
      <div className="max-w-md w-full mx-auto bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-4">
          <img
            src="/src/assets/images/boc_logo_emblem_1795171020204.jpg"
            alt="Logo B.O.C"
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-lg border border-slate-200 object-cover shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              B.O.C
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Boîte à Outils du Contrôleur
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Connectez votre compte pour ouvrir votre espace regroupant JTD, Project-Controler, Appli-Photo, To-Do liste, Calendrier et Prise de notes.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-blue-700 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
        >
          <span>
            {loading
              ? 'Connexion en cours...'
              : 'Lier et ouvrir mon compte contrôleur'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-100">
          Fabien Pirquin · Boîte à Outils du Contrôleur
        </p>
      </div>
    </div>
  );
};
