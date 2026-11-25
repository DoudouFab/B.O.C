export type BackupPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export type AutoBackupIntervalMinutes = 0 | 5 | 10 | 15 | 30;

export interface LocalBackupSettings {
  autoOnOpen: boolean;
  autoIntervalMinutes: AutoBackupIntervalMinutes;
  autoOnHideOrClose: boolean;
}

export interface LocalBackupMetadata {
  folderName: string;
  lastSavedAt: string | null;
  lastSavedFile: string | null;
  settings: LocalBackupSettings;
}

export interface FileSystemDirectoryHandleLike {
  name: string;
  queryPermission?: (descriptor: {
    mode: 'read' | 'readwrite';
  }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (descriptor: {
    mode: 'read' | 'readwrite';
  }) => Promise<'granted' | 'denied' | 'prompt'>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

interface StoredFolderRecord {
  handle: FileSystemDirectoryHandleLike;
  folderName: string;
  lastSavedAt: string | null;
  lastSavedFile: string | null;
  settings: LocalBackupSettings;
}

export const DEFAULT_LOCAL_BACKUP_SETTINGS: LocalBackupSettings = {
  autoOnOpen: true,
  autoIntervalMinutes: 0,
  autoOnHideOrClose: false,
};

function normalizeSettings(raw: unknown): LocalBackupSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const intervalRaw = Number(obj.autoIntervalMinutes);
  const autoIntervalMinutes: AutoBackupIntervalMinutes =
    intervalRaw === 5 ||
    intervalRaw === 10 ||
    intervalRaw === 15 ||
    intervalRaw === 30
      ? intervalRaw
      : 0;
  return {
    autoOnOpen: typeof obj.autoOnOpen === 'boolean' ? obj.autoOnOpen : true,
    autoIntervalMinutes,
    autoOnHideOrClose:
      typeof obj.autoOnHideOrClose === 'boolean' ? obj.autoOnHideOrClose : false,
  };
}

const DB_NAME = 'boc_local_backup_v1';
const STORE_NAME = 'folder_handles';

const recordKeyForUid = (uid: string) => `backup-folder-${uid}`;

function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible sur cet appareil.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Impossible d’ouvrir le stockage local.'));
  });
}

async function readRecord(uid: string): Promise<StoredFolderRecord | null> {
  try {
    const db = await openBackupDb();
    return await new Promise<StoredFolderRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(recordKeyForUid(uid));
      req.onsuccess = () => {
        const val = req.result as StoredFolderRecord | undefined;
        resolve(val ?? null);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function writeRecord(
  uid: string,
  record: StoredFolderRecord
): Promise<void> {
  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record, recordKeyForUid(uid));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Erreur d’enregistrement IndexedDB.'));
    };
  });
}

export async function clearStoredBackupFolder(uid: string): Promise<void> {
  try {
    const db = await openBackupDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(recordKeyForUid(uid));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // ignore cleanup failures
  }
}

export function isDirectoryPickerSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    showDirectoryPicker?: unknown;
  };
  return typeof w.showDirectoryPicker === 'function';
}

export function isEmbeddedCrossOriginFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function getStoredBackupState(uid: string): Promise<{
  metadata: LocalBackupMetadata | null;
  permission: BackupPermissionState;
}> {
  if (!isDirectoryPickerSupported()) {
    return { metadata: null, permission: 'unsupported' };
  }
  const record = await readRecord(uid);
  if (!record || !record.handle) {
    return { metadata: null, permission: 'prompt' };
  }

  let permission: BackupPermissionState = 'prompt';
  try {
    if (typeof record.handle.queryPermission === 'function') {
      permission = await record.handle.queryPermission({ mode: 'readwrite' });
    }
  } catch {
    permission = 'prompt';
  }

  return {
    metadata: {
      folderName: record.folderName || record.handle.name,
      lastSavedAt: record.lastSavedAt ?? null,
      lastSavedFile: record.lastSavedFile ?? null,
      settings: normalizeSettings(record.settings),
    },
    permission,
  };
}

export async function pickAndStoreBackupFolder(
  uid: string,
  settings?: LocalBackupSettings
): Promise<{
  metadata: LocalBackupMetadata;
  permission: BackupPermissionState;
}> {
  if (!isDirectoryPickerSupported()) {
    throw new Error(
      'La sélection d’un dossier local n’est pas prise en charge par ce navigateur (utilisez Chrome ou Edge sur ordinateur, ou l’application installée).'
    );
  }

  const w = window as unknown as {
    showDirectoryPicker: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandleLike>;
  };

  let handle: FileSystemDirectoryHandleLike;
  try {
    handle = await w.showDirectoryPicker({
      id: 'boc-backup-folder',
      mode: 'readwrite',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Sélection du dossier annulée.');
    }
    if (err instanceof DOMException && err.name === 'SecurityError') {
      throw new Error(
        'Le choix direct d’un dossier local est bloqué dans cet aperçu intégré : ouvrez B.O.C dans un onglet dédié ou en application installée (PWA).'
      );
    }
    throw err;
  }

  let permission: BackupPermissionState = 'granted';
  if (typeof handle.queryPermission === 'function') {
    permission = await handle.queryPermission({ mode: 'readwrite' });
  }
  if (permission !== 'granted' && typeof handle.requestPermission === 'function') {
    permission = await handle.requestPermission({ mode: 'readwrite' });
  }

  const existing = await readRecord(uid);
  const resolvedSettings: LocalBackupSettings = settings
    ? normalizeSettings(settings)
    : existing?.settings
    ? normalizeSettings(existing.settings)
    : { ...DEFAULT_LOCAL_BACKUP_SETTINGS };

  const nextRecord: StoredFolderRecord = {
    handle,
    folderName: handle.name,
    lastSavedAt: existing?.lastSavedAt ?? null,
    lastSavedFile: existing?.lastSavedFile ?? null,
    settings: resolvedSettings,
  };
  await writeRecord(uid, nextRecord);

  return {
    metadata: {
      folderName: nextRecord.folderName,
      lastSavedAt: nextRecord.lastSavedAt,
      lastSavedFile: nextRecord.lastSavedFile,
      settings: nextRecord.settings,
    },
    permission,
  };
}

export async function updateLocalBackupSettings(
  uid: string,
  settings: LocalBackupSettings
): Promise<LocalBackupMetadata | null> {
  const existing = await readRecord(uid);
  if (!existing) return null;
  const updated: StoredFolderRecord = {
    ...existing,
    settings: normalizeSettings(settings),
  };
  await writeRecord(uid, updated);
  return {
    folderName: updated.folderName,
    lastSavedAt: updated.lastSavedAt,
    lastSavedFile: updated.lastSavedFile,
    settings: updated.settings,
  };
}

export async function requestStoredFolderPermission(
  uid: string
): Promise<BackupPermissionState> {
  const record = await readRecord(uid);
  if (!record?.handle) return 'prompt';
  try {
    if (typeof record.handle.queryPermission === 'function') {
      const current = await record.handle.queryPermission({ mode: 'readwrite' });
      if (current === 'granted') return 'granted';
    }
    if (typeof record.handle.requestPermission === 'function') {
      return await record.handle.requestPermission({ mode: 'readwrite' });
    }
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function writeBackupToStoredFolder(
  uid: string,
  jsonContent: string,
  fileName: string,
  allowPermissionPrompt: boolean
): Promise<{
  ok: boolean;
  permission: BackupPermissionState;
  savedAt?: string;
  fileName?: string;
  reason?: string;
}> {
  if (!isDirectoryPickerSupported()) {
    return {
      ok: false,
      permission: 'unsupported',
      reason: 'Navigateur non compatible avec les dossiers locaux.',
    };
  }

  const record = await readRecord(uid);
  if (!record?.handle) {
    return {
      ok: false,
      permission: 'prompt',
      reason: 'Aucun dossier de sauvegarde sélectionné sur cet appareil.',
    };
  }

  let perm: BackupPermissionState = 'granted';
  try {
    if (typeof record.handle.queryPermission === 'function') {
      perm = await record.handle.queryPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') {
      if (!allowPermissionPrompt) {
        return {
          ok: false,
          permission: perm,
          reason:
            'Autorisation du dossier requise pour cette session (1 clic sur « Réactiver »).',
        };
      }
      if (typeof record.handle.requestPermission === 'function') {
        perm = await record.handle.requestPermission({ mode: 'readwrite' });
      }
    }
  } catch {
    return {
      ok: false,
      permission: 'denied',
      reason: 'Impossible d’accéder au dossier local.',
    };
  }

  if (perm !== 'granted') {
    return {
      ok: false,
      permission: perm,
      reason: 'Accès au dossier non accordé.',
    };
  }

  try {
    const fileHandle = await record.handle.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonContent);
    await writable.close();

    const savedAt = new Date().toISOString();
    await writeRecord(uid, {
      ...record,
      lastSavedAt: savedAt,
      lastSavedFile: fileName,
    });

    return {
      ok: true,
      permission: 'granted',
      savedAt,
      fileName,
    };
  } catch (err) {
    return {
      ok: false,
      permission: perm,
      reason:
        err instanceof Error
          ? err.message
          : 'Erreur lors de l’écriture dans le dossier.',
    };
  }
}
