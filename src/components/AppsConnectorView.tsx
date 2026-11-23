import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  HardDriveDownload,
  Lock,
  MailPlus,
  Settings,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { ControllerProfile } from '../types';

interface AppsConnectorViewProps {
  controller: ControllerProfile;
  onLockLinks: (urls: {
    jtdUrl: string;
    inasepUrl: string;
    sitesnapUrl: string;
  }) => Promise<void>;
  onSaveCalendarInviteEmails: (emails: string[]) => Promise<void>;
  onExportBackup: () => void;
  onRestoreBackup: (
    file: File
  ) => Promise<{ ok: boolean; message: string }>;
}

export const AppsConnectorView: React.FC<AppsConnectorViewProps> = ({
  controller,
  onLockLinks,
  onSaveCalendarInviteEmails,
  onExportBackup,
  onRestoreBackup,
}) => {
  const [jtdUrl, setJtdUrl] = useState(controller.jtdUrl);
  const [inasepUrl, setInasepUrl] = useState(controller.inasepUrl);
  const [sitesnapUrl, setSitesnapUrl] = useState(controller.sitesnapUrl);
  const [confirmLock, setConfirmLock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [inviteSlot1, setInviteSlot1] = useState(
    controller.calendarInviteEmails[0] ?? ''
  );
  const [inviteSlot2, setInviteSlot2] = useState(
    controller.calendarInviteEmails[1] ?? ''
  );
  const [inviteSlot3, setInviteSlot3] = useState(
    controller.calendarInviteEmails[2] ?? ''
  );
  const [savingEmails, setSavingEmails] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSavedMsg, setEmailSavedMsg] = useState(false);

  useEffect(() => {
    setInviteSlot1(controller.calendarInviteEmails[0] ?? '');
    setInviteSlot2(controller.calendarInviteEmails[1] ?? '');
    setInviteSlot3(controller.calendarInviteEmails[2] ?? '');
  }, [controller.calendarInviteEmails]);

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

  const handleSaveInviteEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSavedMsg(false);

    const rawSlots = [inviteSlot1, inviteSlot2, inviteSlot3]
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = rawSlots.find((em) => !emailRegex.test(em));
    if (invalid) {
      setEmailError(`Adresse e-mail invalide : ${invalid}`);
      return;
    }

    const unique = Array.from(new Set(rawSlots)).slice(0, 3);
    setSavingEmails(true);
    try {
      await onSaveCalendarInviteEmails(unique);
      setEmailSavedMsg(true);
    } catch (err) {
      setEmailError(
        err instanceof Error
          ? err.message
          : 'Impossible d’enregistrer les adresses e-mail.'
      );
    } finally {
      setSavingEmails(false);
    }
  };

  const appsList = [
    {
      id: 'jtd',
      name: 'JDT',
      desc: 'Gestion intelligente des tâches et suivi des processus terrain.',
      iconSrc: 'app-icons/jdt-icon.svg',
      value: controller.linksLocked ? controller.jtdUrl : jtdUrl,
      setter: setJtdUrl,
    },
    {
      id: 'inasep',
      name: 'Project-Controler — INASEP',
      desc: 'Gestion de chantier d’égouttage et voirie — bordereau 3P, tronçons, carnet de mesurage.',
      iconSrc: 'app-icons/project-controler-icon.png',
      value: controller.linksLocked ? controller.inasepUrl : inasepUrl,
      setter: setInasepUrl,
    },
    {
      id: 'sitesnap',
      name: 'Appli-Photo (SiteSnap)',
      desc: 'Organisation et classement automatique des photos de chantier vers OneDrive.',
      iconSrc: 'app-icons/appli-photo-icon.png',
      value: controller.linksLocked ? controller.sitesnapUrl : sitesnapUrl,
      setter: setSitesnapUrl,
    },
  ];

  const handleRestoreFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreFeedback(null);
    try {
      const result = await onRestoreBackup(file);
      setRestoreFeedback(result);
    } catch (err) {
      setRestoreFeedback({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Erreur lors de la restauration de la sauvegarde.',
      });
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#0B1F4D] to-blue-700 text-white shadow-xs shrink-0">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Paramètres</h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-3xl">
            Compte contrôleur lié, configuration des 3 applications, adresses d’invitation calendrier et sauvegarde/restauration B.O.C (.JSON).
          </p>
        </div>
      </div>

      <section className="bg-gradient-to-r from-emerald-50/80 via-white to-white border border-emerald-200/80 rounded-2xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <div className="text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0">
          Compte vérifié et isolé
        </div>
      </section>

      {controller.linksLocked ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Applications liées et verrouillées (liens masqués)
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vos 3 applications sont enregistrées, verrouillées et protégées : leurs liens restent masqués ici. Lancez-les directement depuis l’accueil B.O.C.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
            {appsList.map((app) => {
              const hasUrl = /^https?:\/\//i.test(app.value.trim());
              return (
                <div
                  key={app.id}
                  className="border border-slate-200/80 bg-slate-50/70 rounded-xl p-4 flex items-center gap-3"
                >
                  <img
                    src={app.iconSrc}
                    alt={`Icône ${app.name}`}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-lg border border-slate-200 bg-white object-contain shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {app.name}
                    </h3>
                    <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
                      {hasUrl ? 'Liaison active · URL masquée' : 'Non configurée'}
                    </p>
                  </div>
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

      <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r from-sky-50/75 via-blue-50/35 to-white flex items-start gap-3">
          <MailPlus className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Invitations calendrier · Adresses Gmail / Outlook (0 à 3)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Paramétrez jusqu’à 3 adresses e-mail (personnelles, Gmail ou Outlook) auxquelles envoyer des demandes de rendez-vous directement depuis le Calendrier B.O.C. Modifiable à tout moment.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveInviteEmails} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'invite-email-1',
                label: 'Adresse 1 (optionnelle)',
                val: inviteSlot1,
                setter: setInviteSlot1,
                placeholder: 'Ex. nom@gmail.com',
              },
              {
                id: 'invite-email-2',
                label: 'Adresse 2 (optionnelle)',
                val: inviteSlot2,
                setter: setInviteSlot2,
                placeholder: 'Ex. nom@outlook.com',
              },
              {
                id: 'invite-email-3',
                label: 'Adresse 3 (optionnelle)',
                val: inviteSlot3,
                setter: setInviteSlot3,
                placeholder: 'Ex. collegue@inasep.be',
              },
            ].map((slot) => (
              <div key={slot.id}>
                <label
                  htmlFor={slot.id}
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  {slot.label}
                </label>
                <input
                  id={slot.id}
                  type="email"
                  value={slot.val}
                  onChange={(e) => {
                    slot.setter(e.target.value);
                    setEmailSavedMsg(false);
                  }}
                  placeholder={slot.placeholder}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            ))}
          </div>

          {emailError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {emailError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Laissez vide pour 0 adresse · Actuellement{' '}
              <span className="font-mono font-semibold text-slate-800">
                {controller.calendarInviteEmails.length}/3
              </span>{' '}
              configurée(s).
            </span>

            <div className="flex items-center gap-3">
              {emailSavedMsg && (
                <span className="text-xs font-semibold text-emerald-700">
                  Enregistré
                </span>
              )}
              <button
                type="submit"
                disabled={savingEmails}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 disabled:opacity-60 shadow-xs transition-all whitespace-nowrap"
              >
                <span>
                  {savingEmails ? 'Enregistrement...' : 'Enregistrer les adresses'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r from-indigo-50/75 via-sky-50/40 to-white flex items-start gap-3">
          <HardDriveDownload className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Sauvegarde & Restauration B.O.C (.JSON)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Vos données sont enregistrées en temps réel sur votre compte Google (Firestore). Exportez une archive locale par sécurité ou restaurez une sauvegarde B.O.C précédente sans modifier le fonctionnement PWA.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Exporter sauvegarde B.O.C (.JSON)</span>
            </button>

            <button
              type="button"
              disabled={restoring}
              onClick={() => restoreInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 disabled:opacity-60 shadow-xs transition-all whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>
                {restoring
                  ? 'Restauration en cours...'
                  : 'Restaurer sauvegarde B.O.C (.JSON)'}
              </span>
            </button>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreFileChange}
              className="hidden"
            />
          </div>

          {restoreFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                restoreFeedback.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {restoreFeedback.message}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
