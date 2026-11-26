import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FolderOpen,
  HardDriveDownload,
  Lock,
  MailPlus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  getCachedCalendarAccessToken,
  requestCalendarAccessToken,
} from '../firebase';
import { ControllerProfile } from '../types';
import {
  AutoBackupIntervalMinutes,
  BackupPermissionState,
  LocalBackupMetadata,
  LocalBackupSettings,
} from '../utils/localBackupFolder';

interface LocalBackupControlProps {
  supported: boolean;
  inEmbeddedFrame: boolean;
  metadata: LocalBackupMetadata | null;
  settings: LocalBackupSettings;
  permission: BackupPermissionState;
  saving: boolean;
  error: string | null;
  onChooseFolder: () => Promise<void>;
  onReactivateFolder: () => Promise<void>;
  onSaveNow: () => Promise<void>;
  onRemoveFolder: () => Promise<void>;
  onUpdateSettings: (next: LocalBackupSettings) => Promise<void>;
}

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
  localBackup: LocalBackupControlProps;
}

export const AppsConnectorView: React.FC<AppsConnectorViewProps> = ({
  controller,
  onLockLinks,
  onSaveCalendarInviteEmails,
  onExportBackup,
  onRestoreBackup,
  localBackup,
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
  const [mailAuthActive, setMailAuthActive] = useState(() =>
    Boolean(getCachedCalendarAccessToken())
  );
  const [authorizingMail, setAuthorizingMail] = useState(false);
  const [mailAuthError, setMailAuthError] = useState<string | null>(null);

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

        <div className="px-5 pt-4">
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-emerald-950">
                Expéditeur de vos invitations :{' '}
                <span className="font-mono">{controller.email}</span>
              </div>
              <p className="text-emerald-800">
                Chaque membre connecté envoie ses invitations uniquement depuis son propre compte Google (aucun transit par un autre membre).
              </p>
            </div>
            {mailAuthActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-semibold text-emerald-800 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Messagerie autorisée</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={authorizingMail}
                onClick={async () => {
                  setAuthorizingMail(true);
                  setMailAuthError(null);
                  try {
                    await requestCalendarAccessToken();
                    setMailAuthActive(true);
                  } catch (err) {
                    setMailAuthError(
                      err instanceof Error
                        ? err.message
                        : 'Impossible d’autoriser la messagerie.'
                    );
                  } finally {
                    setAuthorizingMail(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/60 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <span>
                  {authorizingMail
                    ? 'Ouverture du pop-up...'
                    : 'Autoriser mon mail'}
                </span>
              </button>
            )}
          </div>
          {mailAuthError && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {mailAuthError}
            </div>
          )}
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
              Sauvegarde locale (cet appareil) & Synchronisation multi-appareils
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Vos données sont <strong>synchronisées automatiquement en temps réel</strong> entre tous vos appareils connectés au même compte (<span className="font-mono">{controller.email}</span>). Le dossier de sauvegarde ci-dessous est configuré <strong>uniquement sur cet appareil</strong>.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <FolderOpen className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    Dossier de sauvegarde automatique (sur cet appareil uniquement)
                  </span>
                </div>
                {localBackup.metadata ? (
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>
                      Dossier sélectionné :{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {localBackup.metadata.folderName}
                      </span>{' '}
                      ·{' '}
                      {localBackup.permission === 'granted' ? (
                        <span className="font-semibold text-emerald-700">
                          Actif pour cette session
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700">
                          Réactivation requise (1 clic)
                        </span>
                      )}
                    </div>
                    {localBackup.metadata.lastSavedAt && (
                      <div className="text-[11px] text-slate-500">
                        Dernière sauvegarde :{' '}
                        <span className="font-mono">
                          {new Date(localBackup.metadata.lastSavedAt).toLocaleString('fr-BE')}
                        </span>
                        {localBackup.metadata.lastSavedFile
                          ? ` (${localBackup.metadata.lastSavedFile})`
                          : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Aucun dossier local sélectionné sur cet appareil. Choisissez un dossier pour enregistrer vos sauvegardes sans passer par le téléchargement manuel.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {localBackup.metadata && localBackup.permission !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => void localBackup.onReactivateFolder()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réactiver le dossier</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={!localBackup.supported}
                  onClick={() => void localBackup.onChooseFolder()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>
                    {localBackup.metadata
                      ? 'Changer de dossier'
                      : 'Choisir le dossier'}
                  </span>
                </button>

                {localBackup.metadata && (
                  <button
                    type="button"
                    onClick={() => void localBackup.onRemoveFolder()}
                    title="Retirer le dossier local de cet appareil"
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Retirer</span>
                  </button>
                )}
              </div>
            </div>

            {!localBackup.supported && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                Ce navigateur ne permet pas de lier un dossier local permanent (utilisez Chrome/Edge sur PC ou l’application installée pour la sauvegarde automatique dans un dossier ; le bouton de téléchargement `.JSON` ci-dessous fonctionne sur tous vos appareils).
              </div>
            )}

            {localBackup.supported && localBackup.inEmbeddedFrame && !localBackup.metadata && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[11px] text-blue-900">
                Astuce : si l’aperçu intégré bloque l’ouverture du sélecteur de dossier, ouvrez B.O.C dans un onglet dédié ou via l’icône d’application installée (PWA) sur votre PC.
              </div>
            )}

            <div className="pt-3 border-t border-slate-200/80 space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-800">
                  Enregistrement automatique périodique
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        value: 0,
                        label: 'Jamais (bouton Sauvegarder uniquement)',
                      },
                      { value: 5, label: '5 min' },
                      { value: 10, label: '10 min' },
                      { value: 15, label: '15 min' },
                      { value: 30, label: '30 min' },
                    ] as const
                  ).map((opt) => {
                    const active =
                      localBackup.settings.autoIntervalMinutes === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          void localBackup.onUpdateSettings({
                            ...localBackup.settings,
                            autoIntervalMinutes:
                              opt.value as AutoBackupIntervalMinutes,
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          active
                            ? 'bg-blue-700 border-blue-700 text-white shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      key: 'autoOnOpen',
                      label:
                        'Toujours sauvegarder à l’ouverture (écrase le précédent)',
                    },
                    {
                      key: 'autoOnHideOrClose',
                      label: 'Sauvegarder au changement d’onglet / fermeture',
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={localBackup.settings[item.key]}
                      onChange={(e) => {
                        void localBackup.onUpdateSettings({
                          ...localBackup.settings,
                          [item.key]: e.target.checked,
                        });
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {!localBackup.metadata && (
                <p className="text-[11px] text-slate-500">
                  Ces préférences seront appliquées dès qu’un dossier local est sélectionné ci-dessus sur cet appareil.
                </p>
              )}
            </div>

            {localBackup.error && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {localBackup.error}
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Le même fichier (<span className="font-mono">boc_sauvegarde.json</span>) est toujours écrasé et mis à jour dans ce dossier à chaque sauvegarde. Par sécurité navigateur, après redémarrage complet du PC ou du navigateur, 1 clic sur <strong>Réactiver</strong> ou <strong>Sauvegarder</strong> suffit pour relancer l’écriture automatique de la session.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={localBackup.saving}
              onClick={() => void localBackup.onSaveNow()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 shadow-xs transition-all whitespace-nowrap"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>
                {localBackup.saving
                  ? 'Sauvegarde...'
                  : localBackup.metadata
                  ? 'Sauvegarder maintenant dans le dossier'
                  : 'Sauvegarder maintenant (.JSON)'}
              </span>
            </button>

            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Télécharger copie (.JSON)</span>
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
