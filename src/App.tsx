import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  GanttChartSquare,
  LayoutGrid,
  Menu,
  NotebookPen,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  INITIAL_CALENDAR_ENTRIES,
  INITIAL_NOTEBOOKS,
  INITIAL_PROJECTS,
  INITIAL_TODOS,
  POSTIT_COLOR_PALETTE,
  PROJECT_COLOR_PALETTE,
} from './data/initialData';
import {
  CalendarEntry,
  ControllerProfile,
  ModuleTab,
  NotebookItem,
  Project,
  TodoItem,
} from './types';
import { LoginGate } from './components/LoginGate';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { PlanningView } from './components/PlanningView';
import { TodoView } from './components/TodoView';
import { CalendarView } from './components/CalendarView';
import { NotesView } from './components/NotesView';
import { AppsConnectorView } from './components/AppsConnectorView';
import { LiveAppEmbedView } from './components/LiveAppEmbedView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const LEGACY_BROKEN_PROJECT_CONTROLER_URL =
  'https://doudoufab.github.io/Project-Controler-Fabien.PIRQUIN/';

const PERMANENT_URLS = {
  jtd: 'https://doudoufab.github.io/JTD/',
  inasep: 'https://doudoufab.github.io/Project-Controler-V2/',
  sitesnap: 'https://doudoufab.github.io/Appli-Photo/',
};

const TAB_LABELS: Record<ModuleTab, string> = {
  overview: 'Accueil · 3 Applis',
  planning: 'Planning (Gantt)',
  todo: 'To-Do Liste',
  calendar: 'Calendrier',
  notes: 'Prise de notes',
  connector: 'Liens & Compte',
};

const safeDateStr = (val: unknown, fallback: string): string => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  return fallback;
};

const safeHexColor = (val: unknown, fallback: string): string => {
  if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val)) {
    return val;
  }
  return fallback;
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [controller, setController] = useState<ControllerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);

  const [activeTab, setActiveTab] = useState<ModuleTab>('overview');
  const [liveAppId, setLiveAppId] = useState<'jtd' | 'inasep' | 'sitesnap' | null>(
    null
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const syncPayloadRef = useRef<(raw: unknown) => Promise<void>>(async () => {});
  const liveIframeRef = useRef<HTMLIFrameElement | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setController(null);
        setProjects([]);
        setTodos([]);
        setCalendarEntries([]);
        setNotebooks([]);
        setLiveAppId(null);
        setActiveTab('overview');
        return;
      }

      setLoadingProfile(true);
      const uid = nextUser.uid;
      const controllerRef = doc(db, 'controllers', uid);

      try {
        const snap = await getDoc(controllerRef);
        if (!snap.exists()) {
          const email = nextUser.email ?? 'controleur@inasep.local';
          const displayName = (
            nextUser.displayName ??
            email.split('@')[0] ??
            'Contrôleur'
          ).slice(0, 120);

          await setDoc(controllerRef, {
            uid,
            email,
            displayName,
            jtdUrl: PERMANENT_URLS.jtd,
            inasepUrl: PERMANENT_URLS.inasep,
            sitesnapUrl: PERMANENT_URLS.sitesnap,
            linksLocked: true,
            boundAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await Promise.all(
            INITIAL_PROJECTS.map((p) =>
              setDoc(doc(db, 'controllers', uid, 'projects', p.id), {
                ownerUid: uid,
                code: p.code,
                name: p.name,
                commune: p.commune,
                color: p.color,
                marcheTotalReviseEur: p.marcheTotalReviseEur,
                cumulEaValidesEur: p.cumulEaValidesEur,
                eaEnCoursEur: p.eaEnCoursEur,
                eaEnCoursCoche: p.eaEnCoursCoche,
                delaiRestantJours: p.delaiRestantJours,
                startDate: p.startDate,
                estimatedEndDate: p.estimatedEndDate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            )
          );

          const batch = writeBatch(db);
          INITIAL_TODOS.forEach((t) => {
            batch.set(doc(db, 'controllers', uid, 'todos', t.id), {
              ownerUid: uid,
              projectId: t.projectId,
              title: t.title,
              details: t.details || '',
              priority: t.priority,
              done: t.done,
              dueDate: t.dueDate,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          INITIAL_CALENDAR_ENTRIES.forEach((ev) => {
            batch.set(doc(db, 'controllers', uid, 'calendarEntries', ev.id), {
              ownerUid: uid,
              projectId: ev.projectId,
              date: ev.date,
              title: ev.title,
              details: ev.details,
              startTime: ev.startTime,
              durationMinutes: ev.durationMinutes,
              location: ev.location,
              entryType: ev.entryType,
              source: ev.source,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          INITIAL_NOTEBOOKS.forEach((n) => {
            batch.set(doc(db, 'controllers', uid, 'notebooks', n.id), {
              ownerUid: uid,
              projectId: n.projectId,
              title: n.title,
              content: n.content,
              color: n.color,
              pinned: n.pinned,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });

          await batch.commit();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `controllers/${uid}`);
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'controllers', uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const rawInasepUrl = d.inasepUrl || '';
          const needsMigration =
            rawInasepUrl === LEGACY_BROKEN_PROJECT_CONTROLER_URL;
          const resolvedInasepUrl = needsMigration
            ? PERMANENT_URLS.inasep
            : rawInasepUrl || PERMANENT_URLS.inasep;

          if (needsMigration) {
            updateDoc(doc(db, 'controllers', uid), {
              inasepUrl: PERMANENT_URLS.inasep,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }

          setController({
            uid: d.uid,
            email: d.email,
            displayName: d.displayName,
            jtdUrl: d.jtdUrl || PERMANENT_URLS.jtd,
            inasepUrl: resolvedInasepUrl,
            sitesnapUrl: d.sitesnapUrl || PERMANENT_URLS.sitesnap,
            linksLocked: Boolean(d.linksLocked),
          });
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `controllers/${uid}`)
    );

    const unsubProjects = onSnapshot(
      query(
        collection(db, 'controllers', uid, 'projects'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        setProjects(
          snap.docs.map((d) => ({
            id: d.id,
            code: d.data().code,
            name: d.data().name,
            commune: d.data().commune,
            color: safeHexColor(d.data().color, PROJECT_COLOR_PALETTE[0].hex),
            marcheTotalReviseEur: Number(d.data().marcheTotalReviseEur) || 0,
            cumulEaValidesEur: Number(d.data().cumulEaValidesEur) || 0,
            eaEnCoursEur: Number(d.data().eaEnCoursEur) || 0,
            eaEnCoursCoche: Boolean(d.data().eaEnCoursCoche),
            delaiRestantJours: Number(d.data().delaiRestantJours) || 0,
            startDate: safeDateStr(d.data().startDate, '2026-09-01'),
            estimatedEndDate: safeDateStr(
              d.data().estimatedEndDate,
              '2027-02-28'
            ),
          }))
        );
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `controllers/${uid}/projects`
        )
    );

    const unsubTodos = onSnapshot(
      query(
        collection(db, 'controllers', uid, 'todos'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        setTodos(
          snap.docs.map((d) => ({
            id: d.id,
            projectId: d.data().projectId,
            title: d.data().title,
            details: d.data().details || '',
            priority: d.data().priority,
            done: Boolean(d.data().done),
            dueDate: d.data().dueDate || '',
          }))
        );
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `controllers/${uid}/todos`)
    );

    const unsubCalendar = onSnapshot(
      query(
        collection(db, 'controllers', uid, 'calendarEntries'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        setCalendarEntries(
          snap.docs
            .map((d) => ({
              id: d.id,
              projectId: d.data().projectId,
              date: d.data().date,
              title: d.data().title,
              details: d.data().details || '',
              startTime: d.data().startTime || '09:00',
              durationMinutes:
                typeof d.data().durationMinutes === 'number'
                  ? d.data().durationMinutes
                  : 60,
              location: d.data().location || '',
              entryType: d.data().entryType,
              source: d.data().source,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `controllers/${uid}/calendarEntries`
        )
    );

    const unsubNotebooks = onSnapshot(
      query(
        collection(db, 'controllers', uid, 'notebooks'),
        where('ownerUid', '==', uid)
      ),
      (snap) => {
        setNotebooks(
          snap.docs.map((d) => ({
            id: d.id,
            projectId: d.data().projectId,
            title: d.data().title,
            content: d.data().content || '',
            color: safeHexColor(d.data().color, POSTIT_COLOR_PALETTE[0].hex),
            pinned: Boolean(d.data().pinned),
            updatedAt: d.data().updatedAt?.toDate
              ? d.data().updatedAt.toDate().toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10),
          }))
        );
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `controllers/${uid}/notebooks`
        )
    );

    return () => {
      unsubProfile();
      unsubProjects();
      unsubTodos();
      unsubCalendar();
      unsubNotebooks();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://doudoufab.github.io') return;
      const expectedSource = liveIframeRef.current?.contentWindow;
      if (!expectedSource || event.source !== expectedSource) return;

      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object') return;
      if (
        typeof data.userEmail === 'string' &&
        user.email &&
        data.userEmail.toLowerCase() !== user.email.toLowerCase()
      ) {
        return;
      }

      if (data.type === 'PC_SYNC_DOSSIER' && data.payload) {
        void syncPayloadRef.current(data.payload);
      } else if (
        'nomProjet' in data ||
        'infosAdministratives' in data ||
        'delais' in data
      ) {
        void syncPayloadRef.current(data);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [authReady, user]);

  if (!authReady || (user && (loadingProfile || !controller))) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#071430] via-[#0B1F4D] to-[#08173A] flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-cyan-400/45 shadow-xl">
          <img
            src="src/assets/images/boc_logo_emblem_flashy.png"
            alt="Logo B.O.C"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-sm font-medium text-sky-100">
          Chargement de B.O.C...
        </div>
      </div>
    );
  }

  if (!user || !controller) {
    return <LoginGate />;
  }

  const uid = user.uid;

  const filterByProject = <T extends { projectId: string }>(items: T[]): T[] =>
    selectedProjectId === 'all'
      ? items
      : items.filter(
          (item) =>
            item.projectId === selectedProjectId || item.projectId === 'general'
        );

  const handleAddTodo = async (todo: Omit<TodoItem, 'id'>) => {
    const id = `todo-${Date.now()}`;
    const path = `controllers/${uid}/todos/${id}`;
    try {
      await setDoc(doc(db, 'controllers', uid, 'todos', id), {
        ownerUid: uid,
        projectId: todo.projectId || 'general',
        title: todo.title.slice(0, 240),
        details: (todo.details || '').slice(0, 1000),
        priority: todo.priority,
        done: todo.done,
        dueDate: todo.dueDate.slice(0, 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showNotice('Tâche ajoutée.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdateTodo = async (
    id: string,
    patch: Partial<
      Pick<
        TodoItem,
        'projectId' | 'title' | 'details' | 'priority' | 'done' | 'dueDate'
      >
    >
  ) => {
    const path = `controllers/${uid}/todos/${id}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'todos', id), {
        ...(patch.projectId !== undefined
          ? { projectId: patch.projectId || 'general' }
          : {}),
        ...(patch.title !== undefined
          ? { title: patch.title.slice(0, 240) }
          : {}),
        ...(patch.details !== undefined
          ? { details: patch.details.slice(0, 1000) }
          : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.done !== undefined ? { done: patch.done } : {}),
        ...(patch.dueDate !== undefined
          ? { dueDate: patch.dueDate.slice(0, 20) }
          : {}),
        updatedAt: serverTimestamp(),
      });
      showNotice('Tâche mise à jour.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleToggleTodoDone = async (id: string, done: boolean) => {
    const path = `controllers/${uid}/todos/${id}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'todos', id), {
        done,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    const path = `controllers/${uid}/todos/${id}`;
    try {
      await deleteDoc(doc(db, 'controllers', uid, 'todos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleChangeProjectColor = async (projectId: string, color: string) => {
    const path = `controllers/${uid}/projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'projects', projectId), {
        color: safeHexColor(color, PROJECT_COLOR_PALETTE[0].hex),
        updatedAt: serverTimestamp(),
      });
      showNotice('Couleur du chantier mise à jour.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpdateProjectDates = async (
    projectId: string,
    startDate: string,
    estimatedEndDate: string
  ) => {
    const path = `controllers/${uid}/projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'projects', projectId), {
        startDate: safeDateStr(startDate, '2026-09-01'),
        estimatedEndDate: safeDateStr(estimatedEndDate, '2027-02-28'),
        updatedAt: serverTimestamp(),
      });
      showNotice('Dates du planning mises à jour.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpsertProject = async (
    proj: Omit<Project, 'id'> & { id?: string }
  ) => {
    const id = proj.id || `proj-${Date.now()}`;
    const isExisting = Boolean(proj.id && projects.some((p) => p.id === proj.id));
    const path = `controllers/${uid}/projects/${id}`;
    const start = safeDateStr(proj.startDate, '2026-09-01');
    const end = safeDateStr(proj.estimatedEndDate, '2027-02-28');
    try {
      if (isExisting) {
        await updateDoc(doc(db, 'controllers', uid, 'projects', id), {
          code: proj.code.slice(0, 64),
          name: proj.name.slice(0, 180),
          commune: proj.commune.slice(0, 100),
          color: safeHexColor(proj.color, PROJECT_COLOR_PALETTE[0].hex),
          marcheTotalReviseEur: proj.marcheTotalReviseEur,
          cumulEaValidesEur: proj.cumulEaValidesEur,
          eaEnCoursEur: proj.eaEnCoursEur,
          eaEnCoursCoche: proj.eaEnCoursCoche,
          delaiRestantJours: proj.delaiRestantJours,
          startDate: start,
          estimatedEndDate: end,
          updatedAt: serverTimestamp(),
        });
        showNotice(`Chantier ${proj.code} mis à jour.`);
      } else {
        await setDoc(doc(db, 'controllers', uid, 'projects', id), {
          ownerUid: uid,
          code: proj.code.slice(0, 64),
          name: proj.name.slice(0, 180),
          commune: proj.commune.slice(0, 100),
          color: safeHexColor(proj.color, PROJECT_COLOR_PALETTE[0].hex),
          marcheTotalReviseEur: proj.marcheTotalReviseEur,
          cumulEaValidesEur: proj.cumulEaValidesEur,
          eaEnCoursEur: proj.eaEnCoursEur,
          eaEnCoursCoche: proj.eaEnCoursCoche,
          delaiRestantJours: proj.delaiRestantJours,
          startDate: start,
          estimatedEndDate: end,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showNotice(`Chantier ${proj.code} ajouté.`);
      }
    } catch (error) {
      handleFirestoreError(
        error,
        isExisting ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const path = `controllers/${uid}/projects/${projectId}`;
    try {
      await deleteDoc(doc(db, 'controllers', uid, 'projects', projectId));
      if (selectedProjectId === projectId) {
        setSelectedProjectId('all');
      }
      showNotice('Chantier retiré du suivi.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleAddAnnotation = async (entry: {
    projectId: string;
    date: string;
    title: string;
    details: string;
    startTime?: string;
    durationMinutes?: number;
    location?: string;
  }) => {
    const id = `cal-${Date.now()}`;
    const path = `controllers/${uid}/calendarEntries/${id}`;
    try {
      await setDoc(doc(db, 'controllers', uid, 'calendarEntries', id), {
        ownerUid: uid,
        projectId: entry.projectId || 'general',
        date: safeDateStr(entry.date, new Date().toISOString().slice(0, 10)),
        title: entry.title.slice(0, 200),
        details: (entry.details || '').slice(0, 600),
        startTime: (entry.startTime || '09:00').slice(0, 5),
        durationMinutes: Math.max(
          0,
          Math.min(1440, Number(entry.durationMinutes ?? 60))
        ),
        location: (entry.location || '').slice(0, 160),
        entryType: 'Annotation',
        source: 'boc',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showNotice('Événement ajouté au calendrier.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdateCalendarEntry = async (
    id: string,
    patch: Partial<
      Pick<
        CalendarEntry,
        | 'projectId'
        | 'date'
        | 'title'
        | 'details'
        | 'startTime'
        | 'durationMinutes'
        | 'location'
      >
    >
  ) => {
    const path = `controllers/${uid}/calendarEntries/${id}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'calendarEntries', id), {
        ...(patch.projectId !== undefined
          ? { projectId: patch.projectId || 'general' }
          : {}),
        ...(patch.date !== undefined
          ? {
              date: safeDateStr(
                patch.date,
                new Date().toISOString().slice(0, 10)
              ),
            }
          : {}),
        ...(patch.title !== undefined
          ? { title: patch.title.slice(0, 200) }
          : {}),
        ...(patch.details !== undefined
          ? { details: patch.details.slice(0, 600) }
          : {}),
        ...(patch.startTime !== undefined
          ? { startTime: patch.startTime.slice(0, 5) }
          : {}),
        ...(patch.durationMinutes !== undefined
          ? {
              durationMinutes: Math.max(
                0,
                Math.min(1440, Number(patch.durationMinutes))
              ),
            }
          : {}),
        ...(patch.location !== undefined
          ? { location: patch.location.slice(0, 160) }
          : {}),
        updatedAt: serverTimestamp(),
      });
      showNotice('Paramètres du rendez-vous enregistrés.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteCalendarEntry = async (id: string) => {
    const path = `controllers/${uid}/calendarEntries/${id}`;
    try {
      await deleteDoc(doc(db, 'controllers', uid, 'calendarEntries', id));
      showNotice('Événement supprimé.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const syncProjectControlerPayload = async (
    raw: unknown,
    opts?: { manual?: boolean; fallbackName?: string }
  ): Promise<{
    created: number;
    updated: number;
    events: number;
    recognized: boolean;
  }> => {
    type PcLineItem = {
      qte?: number;
      quantite?: number;
      pu?: number;
      prixUnitaire?: number;
      total?: number;
      montant?: number;
    };
    type PcEaItem = { montant?: number; enCours?: boolean; statut?: string };
    type PcProjectData = {
      nomProjet?: string;
      infosAdministratives?: {
        intitule?: string;
        marche?: string;
        lieu?: string;
      };
      marche3P?: PcLineItem[];
      avenants?: PcLineItem[];
      historiqueEA?: PcEaItem[];
      delais?: {
        os?: string;
        base?: number;
        finCalendrier?: string;
        joursMarques?: Record<string, string>;
        observationsOverrides?: Record<string, string>;
      };
    };

    const normalizeDateStr = (val: unknown, fallback: string): string => {
      if (typeof val !== 'string') return fallback;
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
      }
      const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
      if (frMatch) {
        return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
      }
      return fallback;
    };

    const isNativePcDossier = (obj: unknown): obj is PcProjectData =>
      Boolean(
        obj &&
          typeof obj === 'object' &&
          ('nomProjet' in obj ||
            'infosAdministratives' in obj ||
            'delais' in obj ||
            'marche3P' in obj ||
            'historiqueEA' in obj)
      );

    let createdProjectsCount = 0;
    let updatedProjectsCount = 0;
    let importedEventsCount = 0;
    let recognized = false;
    const knownProjects: Project[] = [...projects];

    const upsertPcDossier = async (d: PcProjectData) => {
      recognized = true;
      const fallbackBaseName = opts?.fallbackName
        ? opts.fallbackName.replace(/\.json$/i, '').trim()
        : '';

      const rawNomProjet =
        d.nomProjet && d.nomProjet !== 'Nouveau_Chantier_Vierge'
          ? d.nomProjet.trim()
          : '';
      const rawCode = d.infosAdministratives?.marche?.trim() || '';
      const rawName = d.infosAdministratives?.intitule?.trim() || '';

      const hasContent =
        Boolean(rawCode) ||
        Boolean(rawName) ||
        Boolean(rawNomProjet) ||
        (Array.isArray(d.marche3P) && d.marche3P.length > 0) ||
        (Array.isArray(d.historiqueEA) && d.historiqueEA.length > 0) ||
        Boolean(d.delais?.os) ||
        Object.keys(d.delais?.joursMarques ?? {}).length > 0;

      if (!opts?.manual && !hasContent) {
        return;
      }

      const code = (
        rawCode ||
        rawNomProjet ||
        fallbackBaseName ||
        'PC-DOSSIER'
      ).slice(0, 64);
      const name = (
        rawName ||
        rawNomProjet ||
        fallbackBaseName ||
        code
      ).slice(0, 180);
      const commune = (
        d.infosAdministratives?.lieu?.trim() || 'Chantier'
      ).slice(0, 100);

      const sumLines = (rows?: PcLineItem[]) =>
        (Array.isArray(rows) ? rows : []).reduce((acc, r) => {
          const qte = Number(r.qte ?? r.quantite ?? 0) || 0;
          const pu = Number(r.pu ?? r.prixUnitaire ?? 0) || 0;
          const direct = Number(r.total ?? r.montant ?? 0) || 0;
          const lineVal = qte * pu > 0 ? qte * pu : direct;
          return acc + Math.max(0, lineVal);
        }, 0);

      const marcheTotalReviseEur = Math.max(
        0,
        Math.round((sumLines(d.marche3P) + sumLines(d.avenants)) * 100) / 100
      );

      let cumulEaValidesEur = 0;
      let eaEnCoursEur = 0;
      for (const ea of Array.isArray(d.historiqueEA) ? d.historiqueEA : []) {
        const amt = Math.max(0, Number(ea.montant) || 0);
        if (ea.enCours || ea.statut === 'en_cours') {
          eaEnCoursEur += amt;
        } else {
          cumulEaValidesEur += amt;
        }
      }
      cumulEaValidesEur = Math.round(cumulEaValidesEur * 100) / 100;
      eaEnCoursEur = Math.round(eaEnCoursEur * 100) / 100;

      const existingMatch = knownProjects.find((p) => {
        if (rawCode && p.code.toLowerCase() === rawCode.toLowerCase()) return true;
        if (rawName && p.name.toLowerCase() === rawName.toLowerCase()) return true;
        if (rawNomProjet && p.name.toLowerCase() === rawNomProjet.toLowerCase()) {
          return true;
        }
        if (
          !rawCode &&
          !rawName &&
          !rawNomProjet &&
          fallbackBaseName &&
          p.name.toLowerCase() === fallbackBaseName.toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      const opIndex = createdProjectsCount + updatedProjectsCount;
      const targetProjId =
        existingMatch?.id || `proj-${Date.now()}-${opIndex}`;

      const startDate = normalizeDateStr(
        d.delais?.os,
        existingMatch?.startDate ?? '2026-09-01'
      );
      const estimatedEndDate = normalizeDateStr(
        d.delais?.finCalendrier,
        existingMatch?.estimatedEndDate ?? '2027-02-28'
      );

      const delaiRestantJours =
        /^\d{4}-\d{2}-\d{2}$/.test(estimatedEndDate) && d.delais?.finCalendrier
          ? Math.max(
              0,
              Math.ceil(
                (new Date(estimatedEndDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : Math.max(
              0,
              Number(d.delais?.base ?? existingMatch?.delaiRestantJours ?? 0)
            );

      const nextProjectData: Project = {
        id: targetProjId,
        code,
        name,
        commune,
        color:
          existingMatch?.color ??
          PROJECT_COLOR_PALETTE[
            knownProjects.length % PROJECT_COLOR_PALETTE.length
          ].hex,
        marcheTotalReviseEur:
          marcheTotalReviseEur > 0
            ? marcheTotalReviseEur
            : existingMatch?.marcheTotalReviseEur ?? 0,
        cumulEaValidesEur:
          Array.isArray(d.historiqueEA) && d.historiqueEA.length > 0
            ? cumulEaValidesEur
            : existingMatch?.cumulEaValidesEur ?? 0,
        eaEnCoursEur:
          eaEnCoursEur > 0 ? eaEnCoursEur : existingMatch?.eaEnCoursEur ?? 0,
        eaEnCoursCoche:
          eaEnCoursEur > 0 || (existingMatch?.eaEnCoursCoche ?? true),
        delaiRestantJours,
        startDate,
        estimatedEndDate,
      };

      const projectChanged =
        !existingMatch ||
        existingMatch.code !== nextProjectData.code ||
        existingMatch.name !== nextProjectData.name ||
        existingMatch.commune !== nextProjectData.commune ||
        existingMatch.marcheTotalReviseEur !== nextProjectData.marcheTotalReviseEur ||
        existingMatch.cumulEaValidesEur !== nextProjectData.cumulEaValidesEur ||
        existingMatch.eaEnCoursEur !== nextProjectData.eaEnCoursEur ||
        existingMatch.delaiRestantJours !== nextProjectData.delaiRestantJours ||
        existingMatch.startDate !== nextProjectData.startDate ||
        existingMatch.estimatedEndDate !== nextProjectData.estimatedEndDate;

      if (!existingMatch) {
        await handleUpsertProject(nextProjectData);
        createdProjectsCount += 1;
        knownProjects.push(nextProjectData);
      } else if (projectChanged) {
        await handleUpsertProject(nextProjectData);
        updatedProjectsCount += 1;
      }

      const joursMarques = d.delais?.joursMarques ?? {};
      const overrides = d.delais?.observationsOverrides ?? {};
      for (const [dateStr, kind] of Object.entries(joursMarques)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        if (kind !== 'intemperie' && kind !== 'ferie' && kind !== 'conge') continue;

        const entryType = kind === 'intemperie' ? 'Intempérie' : 'JC';
        const title = (
          overrides[dateStr] ||
          (entryType === 'Intempérie'
            ? `Intempérie · ${commune}`
            : `Jour chômé (JC) · ${commune}`)
        ).slice(0, 200);

        const existingEv = calendarEntries.find(
          (e) =>
            e.date === dateStr &&
            e.source === 'project-controler' &&
            e.projectId === targetProjId
        );

        if (existingEv) {
          if (
            existingEv.title !== title ||
            existingEv.location !== commune.slice(0, 160)
          ) {
            await updateDoc(
              doc(db, 'controllers', uid, 'calendarEntries', existingEv.id),
              {
                title,
                location: commune.slice(0, 160),
                updatedAt: serverTimestamp(),
              }
            );
            importedEventsCount += 1;
          }
        } else {
          const evId = `pc-${dateStr}-${importedEventsCount}-${Date.now()}`;
          await setDoc(doc(db, 'controllers', uid, 'calendarEntries', evId), {
            ownerUid: uid,
            projectId: targetProjId,
            date: dateStr,
            title,
            details: 'Synchronisé depuis Project-Controler V2.',
            startTime: '08:00',
            durationMinutes: 240,
            location: commune.slice(0, 160),
            entryType,
            source: 'project-controler',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          importedEventsCount += 1;
        }
      }
    };

    const rawObj =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;

    const unwrappedSingle =
      rawObj &&
      !isNativePcDossier(rawObj) &&
      (isNativePcDossier(rawObj.dossier)
        ? rawObj.dossier
        : isNativePcDossier(rawObj.project)
        ? rawObj.project
        : isNativePcDossier(rawObj.projectData)
        ? rawObj.projectData
        : isNativePcDossier(rawObj.data)
        ? rawObj.data
        : null);

    const unwrappedList =
      rawObj &&
      (Array.isArray(rawObj.dossiers)
        ? rawObj.dossiers
        : Array.isArray(rawObj.projets)
        ? rawObj.projets
        : null);

    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (isNativePcDossier(item)) {
          await upsertPcDossier(item);
        }
      }
    } else if (unwrappedList) {
      for (const item of unwrappedList) {
        if (isNativePcDossier(item)) {
          await upsertPcDossier(item);
        }
      }
    } else if (isNativePcDossier(raw)) {
      await upsertPcDossier(raw);
    } else if (unwrappedSingle) {
      await upsertPcDossier(unwrappedSingle);
    } else {
      const parsed = raw as {
        projects?: Array<Partial<Project>>;
        chantiers?: Array<Partial<Project>>;
        intemperies?: Array<{
          date?: string;
          projectId?: string;
          code?: string;
          title?: string;
          motif?: string;
          type?: 'Intempérie' | 'JC';
        }>;
      };

      const incomingProjects = parsed?.projects ?? parsed?.chantiers ?? [];
      if (incomingProjects.length > 0 || (parsed?.intemperies?.length ?? 0) > 0) {
        recognized = true;
      }

      for (const item of incomingProjects) {
        if (!item.code && !item.name) continue;
        const code = (item.code || item.name || 'PC-DOSSIER').slice(0, 64);
        const name = (item.name || item.code || 'Chantier').slice(0, 180);
        const existingMatch = knownProjects.find(
          (p) =>
            p.code.toLowerCase() === code.toLowerCase() ||
            p.name.toLowerCase() === name.toLowerCase()
        );
        const opIndex = createdProjectsCount + updatedProjectsCount;
        const targetId = existingMatch?.id || `proj-${Date.now()}-${opIndex}`;
        const nextProj: Project = {
          id: targetId,
          code,
          name,
          commune: item.commune ?? existingMatch?.commune ?? 'Chantier',
          color:
            existingMatch?.color ??
            PROJECT_COLOR_PALETTE[
              knownProjects.length % PROJECT_COLOR_PALETTE.length
            ].hex,
          marcheTotalReviseEur: Number(
            item.marcheTotalReviseEur ?? existingMatch?.marcheTotalReviseEur ?? 0
          ),
          cumulEaValidesEur: Number(
            item.cumulEaValidesEur ?? existingMatch?.cumulEaValidesEur ?? 0
          ),
          eaEnCoursEur: Number(
            item.eaEnCoursEur ?? existingMatch?.eaEnCoursEur ?? 0
          ),
          eaEnCoursCoche: Boolean(
            item.eaEnCoursCoche ?? existingMatch?.eaEnCoursCoche ?? true
          ),
          delaiRestantJours: Number(
            item.delaiRestantJours ?? existingMatch?.delaiRestantJours ?? 0
          ),
          startDate: normalizeDateStr(
            item.startDate,
            existingMatch?.startDate ?? '2026-09-01'
          ),
          estimatedEndDate: normalizeDateStr(
            item.estimatedEndDate,
            existingMatch?.estimatedEndDate ?? '2027-02-28'
          ),
        };
        await handleUpsertProject(nextProj);
        if (!existingMatch) {
          createdProjectsCount += 1;
          knownProjects.push(nextProj);
        } else {
          updatedProjectsCount += 1;
        }
      }

      const incomingEvents = parsed?.intemperies ?? [];
      for (const ev of incomingEvents) {
        if (!ev.date || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) continue;
        const matchedProj = knownProjects.find(
          (p) => p.id === ev.projectId || p.code === ev.code
        );
        const targetProjId = matchedProj?.id ?? 'general';
        const existingEv = calendarEntries.find(
          (e) =>
            e.date === ev.date &&
            e.source === 'project-controler' &&
            e.projectId === targetProjId
        );
        const title = (
          ev.title ||
          ev.motif ||
          'Intempérie Project-Controler'
        ).slice(0, 200);

        if (existingEv) {
          await updateDoc(
            doc(db, 'controllers', uid, 'calendarEntries', existingEv.id),
            {
              title,
              updatedAt: serverTimestamp(),
            }
          );
        } else {
          const id = `pc-${ev.date}-${importedEventsCount}-${Date.now()}`;
          await setDoc(doc(db, 'controllers', uid, 'calendarEntries', id), {
            ownerUid: uid,
            projectId: targetProjId,
            date: ev.date,
            title,
            details: 'Synchronisé depuis Project-Controler.',
            startTime: '08:00',
            durationMinutes: 240,
            location: matchedProj?.commune ?? '',
            entryType: ev.type === 'JC' ? 'JC' : 'Intempérie',
            source: 'project-controler',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        importedEventsCount += 1;
      }
    }

    if (
      !opts?.manual &&
      (createdProjectsCount > 0 || updatedProjectsCount > 0 || importedEventsCount > 0)
    ) {
      showNotice(
        `Sync Project-Controler : ${createdProjectsCount} créé(s), ${updatedProjectsCount} mis à jour, ${importedEventsCount} intempérie(s)/JC.`
      );
    }

    return {
      created: createdProjectsCount,
      updated: updatedProjectsCount,
      events: importedEventsCount,
      recognized,
    };
  };

  syncPayloadRef.current = async (raw: unknown) => {
    await syncProjectControlerPayload(raw);
  };

  const handleImportProjectControlerFile = async (
    fileOrFiles: File | FileList | File[]
  ) => {
    const files: File[] =
      fileOrFiles instanceof File ? [fileOrFiles] : Array.from(fileOrFiles);
    if (files.length === 0) return;

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalEvents = 0;
    let anyRecognized = false;
    let parseErrors = 0;

    for (const file of files) {
      try {
        const text = (await file.text()).replace(/^\uFEFF/, '');
        const parsed: unknown = JSON.parse(text);
        const res = await syncProjectControlerPayload(parsed, {
          manual: true,
          fallbackName: file.name,
        });
        totalCreated += res.created;
        totalUpdated += res.updated;
        totalEvents += res.events;
        if (res.recognized) anyRecognized = true;
      } catch {
        parseErrors += 1;
      }
    }

    if (parseErrors === files.length) {
      showNotice('Fichier JSON Project-Controler invalide ou illisible.');
    } else if (!anyRecognized) {
      showNotice(
        'Format JSON non reconnu : utilisez un fichier exporté depuis Project-Controler.'
      );
    } else if (totalCreated === 0 && totalUpdated === 0 && totalEvents === 0) {
      showNotice('Chantier déjà présent et à jour dans B.O.C.');
    } else {
      showNotice(
        `Import Project-Controler : ${totalCreated} chantier(s) créé(s), ${totalUpdated} mis à jour, ${totalEvents} intempérie(s)/JC.`
      );
    }
  };

  const handleCreateNotebook = async (
    note: Omit<NotebookItem, 'id' | 'updatedAt'>
  ): Promise<string> => {
    const id = `note-${Date.now()}`;
    const path = `controllers/${uid}/notebooks/${id}`;
    try {
      await setDoc(doc(db, 'controllers', uid, 'notebooks', id), {
        ownerUid: uid,
        projectId: note.projectId || 'general',
        title: note.title.slice(0, 180),
        content: note.content.slice(0, 25000),
        color: safeHexColor(note.color, POSTIT_COLOR_PALETTE[0].hex),
        pinned: note.pinned,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showNotice('Post-it créé.');
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdateNotebook = async (
    id: string,
    patch: Partial<
      Pick<NotebookItem, 'title' | 'content' | 'projectId' | 'color' | 'pinned'>
    >
  ) => {
    const path = `controllers/${uid}/notebooks/${id}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'notebooks', id), {
        ...(patch.title !== undefined
          ? { title: patch.title.slice(0, 180) }
          : {}),
        ...(patch.content !== undefined
          ? { content: patch.content.slice(0, 25000) }
          : {}),
        ...(patch.projectId !== undefined
          ? { projectId: patch.projectId || 'general' }
          : {}),
        ...(patch.color !== undefined
          ? { color: safeHexColor(patch.color, POSTIT_COLOR_PALETTE[0].hex) }
          : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    const path = `controllers/${uid}/notebooks/${id}`;
    try {
      await deleteDoc(doc(db, 'controllers', uid, 'notebooks', id));
      showNotice('Post-it supprimé.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleLockLinks = async (urls: {
    jtdUrl: string;
    inasepUrl: string;
    sitesnapUrl: string;
  }) => {
    const path = `controllers/${uid}`;
    try {
      await updateDoc(doc(db, 'controllers', uid), {
        jtdUrl: urls.jtdUrl.slice(0, 500),
        inasepUrl: urls.inasepUrl.slice(0, 500),
        sitesnapUrl: urls.sitesnapUrl.slice(0, 500),
        linksLocked: true,
        updatedAt: serverTimestamp(),
      });
      showNotice('Liens enregistrés et verrouillés.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      controller,
      projects,
      todos,
      calendarEntries,
      notebooks,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `boc_fabien_pirquin_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Sauvegarde JSON téléchargée.');
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const activeProject =
    selectedProjectId === 'all'
      ? null
      : projects.find((p) => p.id === selectedProjectId) ?? null;

  const getLiveAppInfo = (id: 'jtd' | 'inasep' | 'sitesnap') => {
    if (id === 'jtd') {
      return { title: 'JDT', url: controller.jtdUrl || PERMANENT_URLS.jtd };
    }
    if (id === 'inasep') {
      return {
        title: 'Project-Controler — INASEP',
        url: controller.inasepUrl || PERMANENT_URLS.inasep,
      };
    }
    return {
      title: 'Appli-Photo',
      url: controller.sitesnapUrl || PERMANENT_URLS.sitesnap,
    };
  };

  return (
    <div className="min-h-screen flex bg-[#f1f5fb] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setLiveAppId(null);
          setActiveTab(tab);
        }}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onExportBackup={handleExportBackup}
        onSignOut={handleSignOut}
        controller={controller}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir la navigation"
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              {activeProject && (
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                  aria-hidden="true"
                />
              )}
              <span className="font-medium text-slate-500 whitespace-nowrap">
                {activeProject ? activeProject.code : 'B.O.C'}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {liveAppId
                  ? getLiveAppInfo(liveAppId).title
                  : TAB_LABELS[activeTab]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {notice && (
              <span className="hidden md:inline text-xs font-semibold text-emerald-700 whitespace-nowrap">
                {notice}
              </span>
            )}
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => {
                setLiveAppId(null);
                setActiveTab(
                  activeTab === 'connector' ? 'overview' : 'connector'
                );
              }}
              className="px-3 sm:px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <span className="hidden sm:inline">
                {activeTab === 'connector' ? 'Retour Accueil' : 'Liens & Compte'}
              </span>
              <span className="sm:hidden">
                {activeTab === 'connector' ? 'Accueil' : 'Compte'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-3.5 sm:px-6 lg:px-8 pt-5 sm:py-6 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {notice && (
            <div className="md:hidden mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
              {notice}
            </div>
          )}
          {liveAppId ? (
            <LiveAppEmbedView
              appId={liveAppId}
              title={getLiveAppInfo(liveAppId).title}
              url={getLiveAppInfo(liveAppId).url}
              iframeRef={liveAppId === 'inasep' ? liveIframeRef : undefined}
              onBackHome={() => {
                setLiveAppId(null);
                setActiveTab('overview');
              }}
              onSwitchApp={(nextId) => setLiveAppId(nextId)}
            />
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  controller={controller}
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  todos={filterByProject(todos)}
                  calendarEntries={filterByProject(calendarEntries)}
                  notebooks={filterByProject(notebooks)}
                  onNavigate={(tab) => {
                    setLiveAppId(null);
                    setActiveTab(tab);
                  }}
                  onOpenLiveApp={(appId) => setLiveAppId(appId)}
                  onChangeProjectColor={handleChangeProjectColor}
                  onUpsertProject={handleUpsertProject}
                  onDeleteProject={handleDeleteProject}
                  onImportProjectControlerFile={handleImportProjectControlerFile}
                />
              )}

              {activeTab === 'planning' && (
                <PlanningView
                  projects={
                    selectedProjectId === 'all'
                      ? projects
                      : projects.filter((p) => p.id === selectedProjectId)
                  }
                  onUpdateProjectDates={handleUpdateProjectDates}
                  onChangeProjectColor={handleChangeProjectColor}
                />
              )}

              {activeTab === 'todo' && (
                <TodoView
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  todos={filterByProject(todos)}
                  onAddTodo={handleAddTodo}
                  onUpdateTodo={handleUpdateTodo}
                  onToggleDone={handleToggleTodoDone}
                  onDeleteTodo={handleDeleteTodo}
                />
              )}

              {activeTab === 'calendar' && (
                <CalendarView
                  projects={projects}
                  entries={filterByProject(calendarEntries)}
                  projectControlerUrl={
                    controller.inasepUrl || PERMANENT_URLS.inasep
                  }
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateEntry={handleUpdateCalendarEntry}
                  onDeleteEntry={handleDeleteCalendarEntry}
                  onChangeProjectColor={handleChangeProjectColor}
                  onImportProjectControlerFile={handleImportProjectControlerFile}
                />
              )}

              {activeTab === 'notes' && (
                <NotesView
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  notebooks={filterByProject(notebooks)}
                  onCreateNotebook={handleCreateNotebook}
                  onUpdateNotebook={handleUpdateNotebook}
                  onDeleteNotebook={handleDeleteNotebook}
                />
              )}

              {activeTab === 'connector' && (
                <AppsConnectorView
                  controller={controller}
                  onLockLinks={handleLockLinks}
                />
              )}
            </>
          )}
        </main>

        <nav
          aria-label="Navigation mobile"
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        >
          {(
            [
              { id: 'overview', label: 'Accueil', icon: LayoutGrid },
              { id: 'planning', label: 'Planning', icon: GanttChartSquare },
              { id: 'todo', label: 'To-Do', icon: CheckSquare },
              { id: 'calendar', label: 'Calendrier', icon: Calendar },
              { id: 'notes', label: 'Notes', icon: NotebookPen },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = !liveAppId && activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setLiveAppId(null);
                  setActiveTab(item.id);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                  isActive
                    ? 'text-blue-700 bg-blue-50/90 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <OfflineIndicator />
      </div>
    </div>
  );
}
