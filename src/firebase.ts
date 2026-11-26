import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const CALENDAR_EVENTS_SCOPE =
  'https://www.googleapis.com/auth/calendar.events';

const app =
  getApps().find((a) => a.name === 'boc-app') ??
  initializeApp(firebaseConfig, 'boc-app');

const configuredDbId = (firebaseConfig as { firestoreDatabaseId?: string })
  .firestoreDatabaseId;
const firestoreDatabaseId: string =
  typeof configuredDbId === 'string' && configuredDbId.length > 0
    ? configuredDbId
    : 'ai-studio-boiteaoutilcontr-9a0d972a-3329-4bce-bb4b-0883f8f3d1f8';

export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Jeton OAuth conservé uniquement en mémoire (jamais dans localStorage/sessionStorage)
let cachedCalendarAccessToken: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedCalendarAccessToken = null;
  }
});

export function captureGoogleCredentialToken(
  result: UserCredential
): string | null {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedCalendarAccessToken = credential.accessToken;
    return credential.accessToken;
  }
  return null;
}

export function getCachedCalendarAccessToken(): string | null {
  return cachedCalendarAccessToken;
}

export function clearCachedCalendarAccessToken(): void {
  cachedCalendarAccessToken = null;
}

export function formatFirebaseAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  const msg = err instanceof Error ? err.message : '';

  if (
    code === 'auth/unauthorized-domain' ||
    msg.includes('auth/unauthorized-domain')
  ) {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'domaine inconnu';
    return `Domaine non autorisé pour la connexion Google (« ${host} »). Si vous avez installé l’appli depuis une ancienne adresse ou un autre hébergeur (ex. GitHub Pages), désinstallez l’icône puis réinstallez-la depuis le lien partagé B.O.C, ou ajoutez « ${host} » dans Firebase Console → Authentication → Paramètres → Domaines autorisés.`;
  }

  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return 'Connexion annulée avant validation.';
  }

  if (code === 'auth/popup-blocked') {
    return 'La fenêtre de connexion Google a été bloquée par le navigateur. Autorisez les pop-ups pour ce site puis réessayez.';
  }

  return msg || 'Impossible de finaliser la connexion.';
}

export async function requestCalendarAccessToken(): Promise<string> {
  const calendarProvider = new GoogleAuthProvider();
  calendarProvider.addScope(CALENDAR_EVENTS_SCOPE);
  if (auth.currentUser?.email) {
    calendarProvider.setCustomParameters({
      login_hint: auth.currentUser.email,
      prompt: 'consent',
    });
  } else {
    calendarProvider.setCustomParameters({
      prompt: 'select_account consent',
    });
  }

  try {
    const result = auth.currentUser
      ? await reauthenticateWithPopup(auth.currentUser, calendarProvider)
      : await signInWithPopup(auth, calendarProvider);

    const token = captureGoogleCredentialToken(result);
    if (!token) {
      throw new Error(
        'Autorisation Google Calendar incomplète : aucun accès accordé pour votre messagerie.'
      );
    }
    return token;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      throw new Error(
        'Accord annulé : aucune invitation n’a été envoyée depuis votre messagerie.'
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'La fenêtre d’accord Google a été bloquée par le navigateur. Autorisez les pop-ups pour ce site puis réessayez.'
      );
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(formatFirebaseAuthError(err));
    }
    throw err;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Veuillez vérifier votre configuration Firebase.');
    }
  }
}

void testConnection();
