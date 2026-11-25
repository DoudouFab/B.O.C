import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackupPermissionState,
  clearStoredBackupFolder,
  DEFAULT_LOCAL_BACKUP_SETTINGS,
  getStoredBackupState,
  isDirectoryPickerSupported,
  isEmbeddedCrossOriginFrame,
  LocalBackupMetadata,
  LocalBackupSettings,
  pickAndStoreBackupFolder,
  requestStoredFolderPermission,
  updateLocalBackupSettings,
  writeBackupToStoredFolder,
} from '../utils/localBackupFolder';

interface UseLocalAutoBackupOptions {
  uid: string | null;
  isReady: boolean;
  buildBackupJson: () => string;
  getBackupFileName: (autoDaily: boolean) => string;
  dataSignature: string;
  onFallbackDownload: () => void;
  onNotify?: (msg: string) => void;
}

export function useLocalAutoBackup({
  uid,
  isReady,
  buildBackupJson,
  getBackupFileName,
  dataSignature,
  onFallbackDownload,
  onNotify,
}: UseLocalAutoBackupOptions) {
  const [supported] = useState(() => isDirectoryPickerSupported());
  const [inEmbeddedFrame] = useState(() => isEmbeddedCrossOriginFrame());
  const [metadata, setMetadata] = useState<LocalBackupMetadata | null>(null);
  const [permission, setPermission] = useState<BackupPermissionState>(() =>
    isDirectoryPickerSupported() ? 'prompt' : 'unsupported'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildJsonRef = useRef(buildBackupJson);
  buildJsonRef.current = buildBackupJson;

  const getFileNameRef = useRef(getBackupFileName);
  getFileNameRef.current = getBackupFileName;

  const dataSignatureRef = useRef(dataSignature);
  dataSignatureRef.current = dataSignature;

  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const openingBackupDoneForUidRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const isWritingRef = useRef(false);

  useEffect(() => {
    openingBackupDoneForUidRef.current = null;
    lastSavedSignatureRef.current = null;
    setError(null);

    if (!uid) {
      setMetadata(null);
      setPermission(supported ? 'prompt' : 'unsupported');
      return;
    }

    let cancelled = false;
    void getStoredBackupState(uid).then((res) => {
      if (cancelled) return;
      setMetadata(res.metadata);
      setPermission(res.permission);
    });

    return () => {
      cancelled = true;
    };
  }, [uid, supported]);

  const runFolderWrite = useCallback(
    async (opts: {
      allowPrompt: boolean;
      notifyOnSuccess: boolean;
      autoDailyName: boolean;
      onlyIfDirty?: boolean;
    }): Promise<boolean> => {
      if (!uid || isWritingRef.current) return false;
      if (
        opts.onlyIfDirty &&
        lastSavedSignatureRef.current === dataSignatureRef.current
      ) {
        return false;
      }

      isWritingRef.current = true;
      setSaving(true);
      setError(null);
      try {
        const json = buildJsonRef.current();
        const fileName = getFileNameRef.current(opts.autoDailyName);
        const res = await writeBackupToStoredFolder(
          uid,
          json,
          fileName,
          opts.allowPrompt
        );
        setPermission(res.permission);
        if (res.ok && res.savedAt && res.fileName) {
          lastSavedSignatureRef.current = dataSignatureRef.current;
          setMetadata((curr) =>
            curr
              ? {
                  ...curr,
                  lastSavedAt: res.savedAt ?? curr.lastSavedAt,
                  lastSavedFile: res.fileName ?? curr.lastSavedFile,
                }
              : curr
          );
          if (opts.notifyOnSuccess) {
            onNotifyRef.current?.(
              `Sauvegarde enregistrée dans le dossier (${res.fileName}).`
            );
          }
          return true;
        }
        if (!res.ok && opts.allowPrompt && res.reason) {
          setError(res.reason);
        }
        return false;
      } finally {
        isWritingRef.current = false;
        setSaving(false);
      }
    },
    [uid]
  );

  // 1. Sauvegarde automatique à l'ouverture (si le dossier est déjà autorisé)
  useEffect(() => {
    if (!uid || !isReady || !metadata) return;
    if (permission !== 'granted') return;
    if (!metadata.settings.autoOnOpen) return;
    if (openingBackupDoneForUidRef.current === uid) return;

    openingBackupDoneForUidRef.current = uid;
    void runFolderWrite({
      allowPrompt: false,
      notifyOnSuccess: false,
      autoDailyName: true,
    });
  }, [uid, isReady, metadata, permission, runFolderWrite]);

  // 2. Sauvegarde automatique périodique selon l'intervalle choisi (0 = Jamais)
  useEffect(() => {
    if (!uid || !isReady || !metadata) return;
    if (permission !== 'granted') return;
    const intervalMinutes = metadata.settings.autoIntervalMinutes;
    if (!intervalMinutes || intervalMinutes <= 0) return;

    const timer = window.setInterval(() => {
      void runFolderWrite({
        allowPrompt: false,
        notifyOnSuccess: false,
        autoDailyName: true,
      });
    }, intervalMinutes * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [
    uid,
    isReady,
    metadata?.settings.autoIntervalMinutes,
    metadata,
    permission,
    runFolderWrite,
  ]);

  // 3. Sauvegarde automatique lors du passage en arrière-plan / fermeture si modifié
  useEffect(() => {
    if (!uid || !isReady || !metadata) return;
    if (permission !== 'granted') return;
    if (!metadata.settings.autoOnHideOrClose) return;

    const handleHide = () => {
      if (document.visibilityState === 'hidden') {
        void runFolderWrite({
          allowPrompt: false,
          notifyOnSuccess: false,
          autoDailyName: true,
          onlyIfDirty: true,
        });
      }
    };

    const handlePageHide = () => {
      void runFolderWrite({
        allowPrompt: false,
        notifyOnSuccess: false,
        autoDailyName: true,
        onlyIfDirty: true,
      });
    };

    document.addEventListener('visibilitychange', handleHide);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleHide);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [
    uid,
    isReady,
    metadata?.settings.autoOnHideOrClose,
    metadata,
    permission,
    runFolderWrite,
  ]);

  const chooseFolder = useCallback(async () => {
    if (!uid) return;
    setError(null);
    try {
      const res = await pickAndStoreBackupFolder(
        uid,
        metadata?.settings ?? DEFAULT_LOCAL_BACKUP_SETTINGS
      );
      setMetadata(res.metadata);
      setPermission(res.permission);
      if (res.permission === 'granted') {
        openingBackupDoneForUidRef.current = uid;
        await runFolderWrite({
          allowPrompt: false,
          notifyOnSuccess: true,
          autoDailyName: true,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de sélectionner le dossier local.'
      );
    }
  }, [uid, metadata?.settings, runFolderWrite]);

  const reactivateFolder = useCallback(async () => {
    if (!uid) return;
    setError(null);
    const nextPerm = await requestStoredFolderPermission(uid);
    setPermission(nextPerm);
    if (nextPerm === 'granted') {
      openingBackupDoneForUidRef.current = uid;
      await runFolderWrite({
        allowPrompt: false,
        notifyOnSuccess: true,
        autoDailyName: true,
      });
    } else {
      setError(
        'Accès au dossier non accordé. Cliquez à nouveau sur « Réactiver » ou choisissez un autre dossier.'
      );
    }
  }, [uid, runFolderWrite]);

  const saveNow = useCallback(async () => {
    if (!uid || !metadata) {
      onFallbackDownload();
      return;
    }
    const ok = await runFolderWrite({
      allowPrompt: true,
      notifyOnSuccess: true,
      autoDailyName: true,
    });
    if (!ok && permission === 'unsupported') {
      onFallbackDownload();
    }
  }, [uid, metadata, permission, runFolderWrite, onFallbackDownload]);

  const removeFolder = useCallback(async () => {
    if (!uid) return;
    await clearStoredBackupFolder(uid);
    setMetadata(null);
    setPermission(supported ? 'prompt' : 'unsupported');
    setError(null);
    openingBackupDoneForUidRef.current = null;
    onNotifyRef.current?.('Dossier local retiré sur cet appareil.');
  }, [uid, supported]);

  const updateSettings = useCallback(
    async (next: LocalBackupSettings) => {
      if (!uid) return;
      const updated = await updateLocalBackupSettings(uid, next);
      if (updated) {
        setMetadata(updated);
      }
    },
    [uid]
  );

  return {
    supported,
    inEmbeddedFrame,
    metadata,
    permission,
    saving,
    error,
    chooseFolder,
    reactivateFolder,
    saveNow,
    removeFolder,
    updateSettings,
  };
}
