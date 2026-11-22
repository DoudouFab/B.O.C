import React, { useState } from 'react';
import { ExternalLink, Lock, Layers, ShieldCheck } from 'lucide-react';
import { ControllerProfile } from '../types';

interface AppsConnectorViewProps {
  controller: ControllerProfile;
  onLockLinks: (urls: {
    jtdUrl: string;
    inasepUrl: string;
    sitesnapUrl: string;
  }) => Promise<void>;
}

export const AppsConnectorView: React.FC<AppsConnectorViewProps> = ({
  controller,
  onLockLinks,
}) => {
  const [jtdUrl, setJtdUrl] = useState(controller.jtdUrl);
  const [inasepUrl, setInasepUrl] = useState(controller.inasepUrl);
  const [sitesnapUrl, setSitesnapUrl] = useState(controller.sitesnapUrl);
  const [confirmLock, setConfirmLock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<{
    name: string;
    url: string;
  } | null>(null);

  const isValidUrlOrEmpty = (val: string) =>
    val.trim() === '' || /^https?:\/\/.+/i.test(val.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (controller.linksLocked) return;

    if (
      !isValidUrlOrEmpty(jtdUrl) ||
      !isValidUrlOrEmpty(inasepUrl) ||
      !isValidUrlOrEmpty(sitesnapUrl)
    ) {
      setErrorMsg(
        'Chaque lien renseigné doit commencer par http:// ou https://.'
      );
      return;
    }

    if (!confirmLock) {
      setErrorMsg(
        'Veuillez cocher la case de confirmation avant de verrouiller définitivement vos liens.'
      );
      return;
    }

    setSaving(true);
    try {
      await onLockLinks({
        jtdUrl: jtdUrl.trim(),
        inasepUrl: inasepUrl.trim(),
        sitesnapUrl: sitesnapUrl.trim(),
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer la configuration.'
      );
    } finally {
      setSaving(false);
    }
  };

  const appsList = [
    {
      id: 'jtd',
      name: 'JDT',
      desc: 'Gestion intelligente des tâches et suivi des processus terrain.',
      iconSrc: '/app-icons/jdt-icon.svg',
      value: controller.linksLocked ? controller.jtdUrl : jtdUrl,
      setter: setJtdUrl,
    },
    {
      id: 'inasep',
      name: 'Project-Controler — INASEP',
      desc: 'Gestion de chantier d’égouttage et voirie — bordereau 3P, tronçons, carnet de mesurage.',
      iconSrc: '/app-icons/project-controler-icon.png',
      value: controller.linksLocked ? controller.inasepUrl : inasepUrl,
      setter: setInasepUrl,
    },
    {
      id: 'sitesnap',
      name: 'Appli-Photo (SiteSnap)',
      desc: 'Organisation et classement automatique des photos de chantier vers OneDrive.',
      iconSrc: '/app-icons/appli-photo-icon.png',
      value: controller.linksLocked ? controller.sitesnapUrl : sitesnapUrl,
      setter: setSitesnapUrl,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Configuration des liens & Compte lié
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 max-w-3xl">
          Enregistrez une seule fois les URLs de vos 3 applications pour votre compte contrôleur. Une fois verrouillée, la configuration reste définitive et strictement isolée.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Compte contrôleur lié (liaison unique)
            </h2>
            <p className="text-xs text-slate-600">
              {controller.displayName} · <span className="font-mono">{controller.email}</span>
            </p>
            <p className="text-xs text-slate-500">
              Identifiant isolé : <span className="font-mono">{controller.uid}</span> · Aucun autre contrôleur ne peut accéder à cet espace.
            </p>
          </div>
        </div>
        <div className="text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
          Compte vérifié et isolé
        </div>
      </section>

      {controller.linksLocked ? (
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Configuration des liens verrouillée
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vos liens applicatifs ont déjà été enregistrés une fois pour ce compte et sont désormais verrouillés en lecture seule. Vous pouvez lancer chaque application directement depuis l’accueil ou ci-dessous.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {appsList.map((app) => {
              const hasUrl = /^https?:\/\//i.test(app.value.trim());
              return (
                <div
                  key={app.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={app.iconSrc}
                        alt={`Icône ${app.name}`}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg border border-slate-200 bg-white object-contain shrink-0"
                      />
                      <h3 className="text-base font-semibold text-slate-900">
                        {app.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600">{app.desc}</p>
                    <p className="text-xs font-mono text-slate-700 break-all pt-1">
                      {hasUrl ? app.value : 'Aucun lien configuré'}
                    </p>
                  </div>

                  {hasUrl && (
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                      <a
                        href={app.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ouvrir</span>
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewUrl((curr) =>
                            curr?.url === app.value
                              ? null
                              : { name: app.name, url: app.value }
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {previewUrl?.url === app.value
                            ? 'Fermer aperçu'
                            : 'Aperçu intégré'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Saisie unique des 3 liens d’applications
              </h2>
              <p className="text-xs text-slate-600">
                Collez les URLs partagées (https://...) de vos 3 applications. Après validation, cette configuration sera verrouillée définitivement.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {appsList.map((app) => (
                <div
                  key={app.id}
                  className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {app.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{app.desc}</p>
                  </div>
                  <div>
                    <label
                      htmlFor={`input-${app.id}`}
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      URL de l’application
                    </label>
                    <input
                      id={`input-${app.id}`}
                      type="url"
                      value={app.value}
                      onChange={(e) => app.setter(e.target.value)}
                      placeholder="https://ais-pre-....run.app"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {errorMsg}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmLock}
                  onChange={(e) => setConfirmLock(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>
                  Je confirme que ces liens sont définitifs pour mon compte (configuration unique).
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {saving
                    ? 'Verrouillage...'
                    : 'Enregistrer et verrouiller définitivement'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {previewUrl && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-900 truncate">
              Aperçu intégré : {previewUrl.name}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={previewUrl.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Ouvrir en plein écran
              </a>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
              >
                Fermer
              </button>
            </div>
          </div>
          <iframe
            src={previewUrl.url}
            title={previewUrl.name}
            className="w-full h-[640px] border-0 bg-slate-50"
          />
        </div>
      )}
    </div>
  );
};
