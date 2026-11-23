import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  GanttChartSquare,
  LayoutGrid,
  Menu,
  NotebookPen,
  Settings,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
  connector: 'Paramètres',
};

const safeDateStr = (val: unknown, fallback: string): string => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }
  return fallback;
};

const toLocalIso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDaysFromToday = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  return toLocalIso(d);
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
  const syncLockRef = useRef<Promise<void>>(Promise.resolve());
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
            calendarInviteEmails: [],
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
                contractualEndDate: p.contractualEndDate,
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
              startTime: ev.allDay ? '' : ev.startTime,
              durationMinutes: ev.durationMinutes,
              allDay: Boolean(ev.allDay),
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

          const inviteEmails = Array.isArray(d.calendarInviteEmails)
            ? d.calendarInviteEmails
                .filter((em): em is string => typeof em === 'string' && em.trim().length >= 3)
                .slice(0, 3)
            : [];

          setController({
            uid: d.uid,
            email: d.email,
            displayName: d.displayName,
            jtdUrl: d.jtdUrl || PERMANENT_URLS.jtd,
            inasepUrl: resolvedInasepUrl,
            sitesnapUrl: d.sitesnapUrl || PERMANENT_URLS.sitesnap,
            linksLocked: Boolean(d.linksLocked),
            calendarInviteEmails: inviteEmails,
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
          snap.docs.map((d) => {
            const delaiRestant = Number(d.data().delaiRestantJours) || 0;
            const estEnd = safeDateStr(d.data().estimatedEndDate, '2027-02-28');
            const fallbackContractual =
              delaiRestant > 0 ? addDaysFromToday(delaiRestant) : estEnd;
            return {
              id: d.id,
              code: d.data().code,
              name: d.data().name,
              commune: d.data().commune,
              color: safeHexColor(d.data().color, PROJECT_COLOR_PALETTE[0].hex),
              marcheTotalReviseEur: Number(d.data().marcheTotalReviseEur) || 0,
              cumulEaValidesEur: Number(d.data().cumulEaValidesEur) || 0,
              eaEnCoursEur: Number(d.data().eaEnCoursEur) || 0,
              eaEnCoursCoche: Boolean(d.data().eaEnCoursCoche),
              delaiRestantJours: delaiRestant,
              startDate: safeDateStr(d.data().startDate, '2026-09-01'),
              contractualEndDate: safeDateStr(
                d.data().contractualEndDate,
                fallbackContractual
              ),
              estimatedEndDate: estEnd,
            };
          })
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
            .map((d) => {
              const entryType = d.data().entryType;
              const source = d.data().source;
              const isAllDay =
                Boolean(d.data().allDay) ||
                source === 'project-controler' ||
                entryType === 'Intempérie' ||
                entryType === 'JC';
              return {
                id: d.id,
                projectId: d.data().projectId,
                date: d.data().date,
                title: d.data().title,
                details: d.data().details || '',
                startTime: isAllDay ? '' : d.data().startTime || '09:00',
                durationMinutes: isAllDay
                  ? 480
                  : typeof d.data().durationMinutes === 'number'
                  ? d.data().durationMinutes
                  : 60,
                allDay: isAllDay,
                location: d.data().location || '',
                entryType,
                source,
              };
            })
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
    const contractualEnd = safeDateStr(
      proj.contractualEndDate,
      proj.delaiRestantJours > 0 ? addDaysFromToday(proj.delaiRestantJours) : end
    );
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
          contractualEndDate: contractualEnd,
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
          contractualEndDate: contractualEnd,
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
        jcRestants?: number;
        joursRestants?: number;
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

    // Lecture fraîche Firestore pour éviter tout doublon lors d'imports successifs rapides
    const existingCalSnap = await getDocs(
      query(
        collection(db, 'controllers', uid, 'calendarEntries'),
        where('ownerUid', '==', uid)
      )
    );
    type ExistingPcCalDoc = {
      id: string;
      projectId: string;
      date: string;
      title: string;
      details: string;
      startTime: string;
      durationMinutes: number;
      allDay: boolean;
      location: string;
      entryType: string;
      source: string;
    };
    const pcCalendarDocs: ExistingPcCalDoc[] = existingCalSnap.docs
      .map((d) => ({
        id: d.id,
        projectId: String(d.data().projectId || ''),
        date: String(d.data().date || ''),
        title: String(d.data().title || ''),
        details: String(d.data().details || ''),
        startTime: String(d.data().startTime || ''),
        durationMinutes: Number(d.data().durationMinutes ?? 480),
        allDay: Boolean(d.data().allDay),
        location: String(d.data().location || ''),
        entryType: String(d.data().entryType || ''),
        source: String(d.data().source || ''),
      }))
      .filter((d) => d.source === 'project-controler');

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

      const explicitFinCalendrier = normalizeDateStr(
        d.delais?.finCalendrier,
        ''
      );
      const jcFromPc =
        typeof d.delais?.jcRestants === 'number'
          ? d.delais.jcRestants
          : typeof d.delais?.joursRestants === 'number'
          ? d.delais.joursRestants
          : typeof d.delais?.base === 'number'
          ? d.delais.base
          : null;

      const contractualEndDate =
        explicitFinCalendrier ||
        (jcFromPc !== null && jcFromPc > 0
          ? addDaysFromToday(jcFromPc)
          : existingMatch?.contractualEndDate ??
            existingMatch?.estimatedEndDate ??
            '2027-02-28');

      const delaiRestantJours =
        jcFromPc !== null && jcFromPc >= 0
          ? Math.round(jcFromPc)
          : /^\d{4}-\d{2}-\d{2}$/.test(contractualEndDate)
          ? Math.max(
              0,
              Math.ceil(
                (new Date(contractualEndDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : existingMatch?.delaiRestantJours ?? 0;

      // Préserver la fin estimée personnalisée du contrôleur si le chantier existe déjà
      const estimatedEndDate = existingMatch?.estimatedEndDate
        ? existingMatch.estimatedEndDate
        : contractualEndDate;

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
        contractualEndDate,
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
        existingMatch.contractualEndDate !== nextProjectData.contractualEndDate ||
        existingMatch.estimatedEndDate !== nextProjectData.estimatedEndDate;

      if (!existingMatch) {
        await handleUpsertProject(nextProjectData);
        createdProjectsCount += 1;
        knownProjects.push(nextProjectData);
      } else if (projectChanged) {
        await handleUpsertProject(nextProjectData);
        updatedProjectsCount += 1;
      }

      if (d.delais) {
        const joursMarques = d.delais.joursMarques ?? {};
        const overrides = d.delais.observationsOverrides ?? {};

        // Construire la table dédupliquée des jours marqués du dossier Project-Controler le plus récent
        const desiredByDate = new Map<
          string,
          { entryType: 'Intempérie' | 'JC'; title: string; details: string; location: string }
        >();

        for (const [rawDateKey, rawKind] of Object.entries(joursMarques)) {
          const dateStr = normalizeDateStr(rawDateKey, '');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
          const kind = String(rawKind || '').trim().toLowerCase();
          const isIntemperie = kind === 'intemperie' || kind === 'intempérie';
          const isJcKind =
            kind === 'ferie' ||
            kind === 'férié' ||
            kind === 'conge' ||
            kind === 'congé' ||
            kind === 'jc' ||
            kind === 'jour_chome' ||
            kind === 'repos';
          if (!isIntemperie && !isJcKind) continue;

          const entryType: 'Intempérie' | 'JC' = isIntemperie ? 'Intempérie' : 'JC';
          const defaultLabel = isIntemperie
            ? `Intempérie · ${commune}`
            : kind === 'conge' || kind === 'congé'
            ? `Jour de congé · ${commune}`
            : kind === 'ferie' || kind === 'férié'
            ? `Jour férié · ${commune}`
            : `Jour chômé (JC) · ${commune}`;

          const title = (
            overrides[rawDateKey] ||
            overrides[dateStr] ||
            defaultLabel
          ).slice(0, 200);

          desiredByDate.set(dateStr, {
            entryType,
            title,
            details: 'Info journée entière · Synchronisé depuis Project-Controler.',
            location: commune.slice(0, 160),
          });
        }

        // Récupérer toutes les entrées Project-Controler existantes pour ce chantier et remplacer sans doublon
        const currentForProject = pcCalendarDocs.filter(
          (e) => e.projectId === targetProjId
        );

        const toDeleteIds = new Set<string>();
        for (const oldDoc of currentForProject) {
          const canonicalId = `pc-${targetProjId}-${oldDoc.date}`.slice(0, 128);
          const desired = desiredByDate.get(oldDoc.date);
          if (!desired || oldDoc.id !== canonicalId || oldDoc.entryType !== desired.entryType) {
            toDeleteIds.add(oldDoc.id);
          }
        }

        for (const delId of toDeleteIds) {
          await deleteDoc(doc(db, 'controllers', uid, 'calendarEntries', delId));
          const idx = pcCalendarDocs.findIndex((x) => x.id === delId);
          if (idx !== -1) pcCalendarDocs.splice(idx, 1);
        }

        for (const [dateStr, desired] of desiredByDate.entries()) {
          const canonicalId = `pc-${targetProjId}-${dateStr}`.slice(0, 128);
          const existingCanonical = pcCalendarDocs.find(
            (e) => e.id === canonicalId && e.projectId === targetProjId
          );

          if (existingCanonical) {
            if (
              existingCanonical.title !== desired.title ||
              existingCanonical.details !== desired.details ||
              existingCanonical.location !== desired.location ||
              !existingCanonical.allDay ||
              existingCanonical.startTime !== ''
            ) {
              await updateDoc(
                doc(db, 'controllers', uid, 'calendarEntries', canonicalId),
                {
                  title: desired.title,
                  details: desired.details,
                  startTime: '',
                  durationMinutes: 480,
                  allDay: true,
                  location: desired.location,
                  updatedAt: serverTimestamp(),
                }
              );
              existingCanonical.title = desired.title;
              existingCanonical.details = desired.details;
              existingCanonical.location = desired.location;
              existingCanonical.allDay = true;
              existingCanonical.startTime = '';
              importedEventsCount += 1;
            }
          } else {
            await setDoc(doc(db, 'controllers', uid, 'calendarEntries', canonicalId), {
              ownerUid: uid,
              projectId: targetProjId,
              date: dateStr,
              title: desired.title,
              details: desired.details,
              startTime: '',
              durationMinutes: 480,
              allDay: true,
              location: desired.location,
              entryType: desired.entryType,
              source: 'project-controler',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            pcCalendarDocs.push({
              id: canonicalId,
              projectId: targetProjId,
              date: dateStr,
              title: desired.title,
              details: desired.details,
              startTime: '',
              durationMinutes: 480,
              allDay: true,
              location: desired.location,
              entryType: desired.entryType,
              source: 'project-controler',
            });
            importedEventsCount += 1;
          }
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
          contractualEndDate: normalizeDateStr(
            item.contractualEndDate,
            existingMatch?.contractualEndDate ??
              normalizeDateStr(
                item.estimatedEndDate,
                existingMatch?.estimatedEndDate ?? '2027-02-28'
              )
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
        const normDate = normalizeDateStr(ev.date, '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normDate)) continue;
        const matchedProj = knownProjects.find(
          (p) => p.id === ev.projectId || p.code === ev.code
        );
        const targetProjId = matchedProj?.id ?? 'general';
        const entryType: 'Intempérie' | 'JC' = ev.type === 'JC' ? 'JC' : 'Intempérie';
        const title = (
          ev.title ||
          ev.motif ||
          'Intempérie Project-Controler'
        ).slice(0, 200);
        const canonicalId = `pc-${targetProjId}-${normDate}`.slice(0, 128);

        const duplicates = pcCalendarDocs.filter(
          (e) =>
            e.projectId === targetProjId &&
            e.date === normDate &&
            (e.id !== canonicalId || e.entryType !== entryType)
        );
        for (const dup of duplicates) {
          await deleteDoc(doc(db, 'controllers', uid, 'calendarEntries', dup.id));
          const idx = pcCalendarDocs.findIndex((x) => x.id === dup.id);
          if (idx !== -1) pcCalendarDocs.splice(idx, 1);
        }

        const existingCanonical = pcCalendarDocs.find(
          (e) => e.id === canonicalId && e.projectId === targetProjId
        );

        if (existingCanonical) {
          await updateDoc(
            doc(db, 'controllers', uid, 'calendarEntries', canonicalId),
            {
              title,
              startTime: '',
              durationMinutes: 480,
              allDay: true,
              location: (matchedProj?.commune ?? '').slice(0, 160),
              updatedAt: serverTimestamp(),
            }
          );
          existingCanonical.title = title;
        } else {
          await setDoc(doc(db, 'controllers', uid, 'calendarEntries', canonicalId), {
            ownerUid: uid,
            projectId: targetProjId,
            date: normDate,
            title,
            details: 'Info journée entière · Synchronisé depuis Project-Controler.',
            startTime: '',
            durationMinutes: 480,
            allDay: true,
            location: (matchedProj?.commune ?? '').slice(0, 160),
            entryType,
            source: 'project-controler',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          pcCalendarDocs.push({
            id: canonicalId,
            projectId: targetProjId,
            date: normDate,
            title,
            details: 'Info journée entière · Synchronisé depuis Project-Controler.',
            startTime: '',
            durationMinutes: 480,
            allDay: true,
            location: (matchedProj?.commune ?? '').slice(0, 160),
            entryType,
            source: 'project-controler',
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

  const enqueueSync = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = syncLockRef.current.then(task, task);
    syncLockRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  syncPayloadRef.current = async (raw: unknown) => {
    await enqueueSync(() => syncProjectControlerPayload(raw));
  };

  const handleImportProjectControlerFile = async (
    fileOrFiles: File | FileList | File[]
  ) => {
    const files: File[] =
      fileOrFiles instanceof File ? [fileOrFiles] : Array.from(fileOrFiles);
    if (files.length === 0) return;

    await enqueueSync(async () => {
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
    });
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

  const handleSaveCalendarInviteEmails = async (emails: string[]) => {
    const path = `controllers/${uid}`;
    const cleaned = emails
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .slice(0, 3);
    try {
      await updateDoc(doc(db, 'controllers', uid), {
        calendarInviteEmails: cleaned,
        updatedAt: serverTimestamp(),
      });
      showNotice('Adresses e-mail d’invitation enregistrées.');
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

  const handleRestoreBackup = async (
    file: File
  ): Promise<{ ok: boolean; message: string }> => {
    return enqueueSync(async () => {
      let parsed: unknown;
      try {
        const text = (await file.text()).replace(/^\uFEFF/, '');
        parsed = JSON.parse(text);
      } catch {
        return {
          ok: false,
          message: 'Fichier JSON invalide ou illisible.',
        };
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          ok: false,
          message: 'Format de fichier non reconnu pour une sauvegarde B.O.C.',
        };
      }

      const data = parsed as Record<string, unknown>;
      const looksLikeProjectControler =
        'nomProjet' in data ||
        'infosAdministratives' in data ||
        'marche3P' in data ||
        'delais' in data;

      const hasBocCollections =
        Array.isArray(data.projects) ||
        Array.isArray(data.todos) ||
        Array.isArray(data.calendarEntries) ||
        Array.isArray(data.notebooks);

      if (!hasBocCollections) {
        return {
          ok: false,
          message: looksLikeProjectControler
            ? 'Ce fichier provient de Project-Controler : utilisez « Importer / Sync (.JSON) » sur l’Accueil ou le Calendrier.'
            : 'Sauvegarde B.O.C non reconnue : utilisez un fichier boc_*.json exporté depuis B.O.C.',
        };
      }

      const sanitizeId = (rawId: unknown, prefix: string, idx: number): string => {
        if (typeof rawId === 'string') {
          const cleaned = rawId
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .slice(0, 128);
          if (cleaned.length >= 1) return cleaned;
        }
        return `${prefix}-${Date.now()}-${idx}`.slice(0, 128);
      };

      const rawProjects = Array.isArray(data.projects) ? data.projects : [];
      const rawTodos = Array.isArray(data.todos) ? data.todos : [];
      const rawCal = Array.isArray(data.calendarEntries)
        ? data.calendarEntries
        : [];
      const rawNotes = Array.isArray(data.notebooks) ? data.notebooks : [];

      const [projSnap, todoSnap, calSnap, noteSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'controllers', uid, 'projects'),
            where('ownerUid', '==', uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'controllers', uid, 'todos'),
            where('ownerUid', '==', uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'controllers', uid, 'calendarEntries'),
            where('ownerUid', '==', uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'controllers', uid, 'notebooks'),
            where('ownerUid', '==', uid)
          )
        ),
      ]);

      const existingProjectIds = new Set(projSnap.docs.map((d) => d.id));
      const existingTodoIds = new Set(todoSnap.docs.map((d) => d.id));
      const existingCalMeta = new Map(
        calSnap.docs.map((d) => [
          d.id,
          {
            entryType: String(d.data().entryType || ''),
            source: String(d.data().source || ''),
          },
        ])
      );
      const existingNoteIds = new Set(noteSnap.docs.map((d) => d.id));

      const projectIdMap = new Map<string, string>();
      const validProjectIds = new Set<string>(existingProjectIds);

      type BatchAction = (batch: ReturnType<typeof writeBatch>) => void;
      const runBatched = async (actions: BatchAction[]) => {
        for (let i = 0; i < actions.length; i += 400) {
          const batch = writeBatch(db);
          actions.slice(i, i + 400).forEach((fn) => fn(batch));
          await batch.commit();
        }
      };

      let restoredProjects = 0;
      const projectActions: BatchAction[] = [];

      rawProjects.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const p = item as Record<string, unknown>;
        const origId = typeof p.id === 'string' ? p.id : '';
        const id = sanitizeId(origId, 'proj', idx);
        if (origId) projectIdMap.set(origId, id);
        validProjectIds.add(id);

        const code = (
          typeof p.code === 'string' && p.code.trim() ? p.code.trim() : 'CHANTIER'
        ).slice(0, 64);
        const name = (
          typeof p.name === 'string' && p.name.trim() ? p.name.trim() : code
        ).slice(0, 180);
        const commune = (
          typeof p.commune === 'string' && p.commune.trim()
            ? p.commune.trim()
            : 'Chantier'
        ).slice(0, 100);
        const color = safeHexColor(p.color, PROJECT_COLOR_PALETTE[0].hex);
        const marcheTotalReviseEur = Math.max(
          0,
          Number(p.marcheTotalReviseEur) || 0
        );
        const cumulEaValidesEur = Math.max(
          0,
          Number(p.cumulEaValidesEur) || 0
        );
        const eaEnCoursEur = Math.max(0, Number(p.eaEnCoursEur) || 0);
        const eaEnCoursCoche =
          typeof p.eaEnCoursCoche === 'boolean' ? p.eaEnCoursCoche : true;
        const delaiRestantJours = Math.max(
          0,
          Math.round(Number(p.delaiRestantJours) || 0)
        );
        const startDate = safeDateStr(p.startDate, '2026-09-01');
        const estimatedEndDate = safeDateStr(p.estimatedEndDate, '2027-02-28');
        const contractualEndDate = safeDateStr(
          p.contractualEndDate,
          delaiRestantJours > 0
            ? addDaysFromToday(delaiRestantJours)
            : estimatedEndDate
        );

        const ref = doc(db, 'controllers', uid, 'projects', id);
        if (existingProjectIds.has(id)) {
          projectActions.push((batch) =>
            batch.update(ref, {
              code,
              name,
              commune,
              color,
              marcheTotalReviseEur,
              cumulEaValidesEur,
              eaEnCoursEur,
              eaEnCoursCoche,
              delaiRestantJours,
              startDate,
              contractualEndDate,
              estimatedEndDate,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          projectActions.push((batch) =>
            batch.set(ref, {
              ownerUid: uid,
              code,
              name,
              commune,
              color,
              marcheTotalReviseEur,
              cumulEaValidesEur,
              eaEnCoursEur,
              eaEnCoursCoche,
              delaiRestantJours,
              startDate,
              contractualEndDate,
              estimatedEndDate,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
        restoredProjects += 1;
      });

      try {
        await runBatched(projectActions);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `controllers/${uid}/projects`
        );
      }

      const resolveProjectRef = (rawProjId: unknown): string => {
        if (typeof rawProjId === 'string') {
          const mapped = projectIdMap.get(rawProjId) ?? rawProjId.trim();
          if (mapped === 'general' || validProjectIds.has(mapped)) {
            return mapped;
          }
        }
        return 'general';
      };

      let restoredTodos = 0;
      const todoActions: BatchAction[] = [];
      rawTodos.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const t = item as Record<string, unknown>;
        const id = sanitizeId(t.id, 'todo', idx);
        const title = (
          typeof t.title === 'string' && t.title.trim() ? t.title.trim() : ''
        ).slice(0, 240);
        if (!title) return;
        const details = (typeof t.details === 'string' ? t.details : '').slice(
          0,
          1000
        );
        const priority =
          t.priority === 'Haute' ||
          t.priority === 'Normale' ||
          t.priority === 'Basse'
            ? t.priority
            : 'Normale';
        const done = Boolean(t.done);
        const dueDate = (typeof t.dueDate === 'string' ? t.dueDate : '').slice(
          0,
          20
        );
        const projectId = resolveProjectRef(t.projectId);
        const ref = doc(db, 'controllers', uid, 'todos', id);
        if (existingTodoIds.has(id)) {
          todoActions.push((batch) =>
            batch.update(ref, {
              projectId,
              title,
              details,
              priority,
              done,
              dueDate,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          todoActions.push((batch) =>
            batch.set(ref, {
              ownerUid: uid,
              projectId,
              title,
              details,
              priority,
              done,
              dueDate,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
        restoredTodos += 1;
      });

      let restoredEvents = 0;
      const calDeleteActions: BatchAction[] = [];
      const calWriteActions: BatchAction[] = [];
      rawCal.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const ev = item as Record<string, unknown>;
        const id = sanitizeId(ev.id, 'cal', idx);
        const title = (
          typeof ev.title === 'string' && ev.title.trim() ? ev.title.trim() : ''
        ).slice(0, 200);
        if (!title) return;
        const date = safeDateStr(ev.date, toLocalIso(new Date()));
        const details = (typeof ev.details === 'string' ? ev.details : '').slice(
          0,
          600
        );
        const entryType =
          ev.entryType === 'Intempérie' ||
          ev.entryType === 'JC' ||
          ev.entryType === 'Annotation'
            ? ev.entryType
            : 'Annotation';
        const source =
          ev.source === 'project-controler' ? 'project-controler' : 'boc';
        const allDay =
          Boolean(ev.allDay) ||
          source === 'project-controler' ||
          entryType === 'Intempérie' ||
          entryType === 'JC';
        const startTime = allDay
          ? ''
          : (typeof ev.startTime === 'string' ? ev.startTime : '09:00').slice(
              0,
              5
            );
        const durationMinutes = allDay
          ? 480
          : Math.max(0, Math.min(1440, Number(ev.durationMinutes ?? 60)));
        const location = (
          typeof ev.location === 'string' ? ev.location : ''
        ).slice(0, 160);
        const projectId = resolveProjectRef(ev.projectId);

        const ref = doc(db, 'controllers', uid, 'calendarEntries', id);
        const prev = existingCalMeta.get(id);
        if (prev && prev.entryType === entryType && prev.source === source) {
          calWriteActions.push((batch) =>
            batch.update(ref, {
              projectId,
              date,
              title,
              details,
              startTime,
              durationMinutes,
              allDay,
              location,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          if (prev) {
            calDeleteActions.push((batch) => batch.delete(ref));
          }
          calWriteActions.push((batch) =>
            batch.set(ref, {
              ownerUid: uid,
              projectId,
              date,
              title,
              details,
              startTime,
              durationMinutes,
              allDay,
              location,
              entryType,
              source,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
        restoredEvents += 1;
      });

      let restoredNotes = 0;
      const noteActions: BatchAction[] = [];
      rawNotes.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const n = item as Record<string, unknown>;
        const id = sanitizeId(n.id, 'note', idx);
        const title = (
          typeof n.title === 'string' && n.title.trim()
            ? n.title.trim()
            : 'Note restaurée'
        ).slice(0, 180);
        const content = (typeof n.content === 'string' ? n.content : '').slice(
          0,
          25000
        );
        const color = safeHexColor(n.color, POSTIT_COLOR_PALETTE[0].hex);
        const pinned = Boolean(n.pinned);
        const projectId = resolveProjectRef(n.projectId);
        const ref = doc(db, 'controllers', uid, 'notebooks', id);
        if (existingNoteIds.has(id)) {
          noteActions.push((batch) =>
            batch.update(ref, {
              projectId,
              title,
              content,
              color,
              pinned,
              updatedAt: serverTimestamp(),
            })
          );
        } else {
          noteActions.push((batch) =>
            batch.set(ref, {
              ownerUid: uid,
              projectId,
              title,
              content,
              color,
              pinned,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }
        restoredNotes += 1;
      });

      try {
        if (calDeleteActions.length > 0) {
          await runBatched(calDeleteActions);
        }
        await runBatched([...todoActions, ...calWriteActions, ...noteActions]);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `controllers/${uid}/restore`
        );
      }

      const rawController =
        data.controller && typeof data.controller === 'object'
          ? (data.controller as Record<string, unknown>)
          : null;
      if (rawController && Array.isArray(rawController.calendarInviteEmails)) {
        const cleanedEmails = rawController.calendarInviteEmails
          .filter((em): em is string => typeof em === 'string')
          .map((em) => em.trim())
          .filter((em) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
          .slice(0, 3);
        try {
          await updateDoc(doc(db, 'controllers', uid), {
            calendarInviteEmails: cleanedEmails,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `controllers/${uid}`
          );
        }
      }

      const summary = `Sauvegarde restaurée : ${restoredProjects} chantier(s), ${restoredTodos} tâche(s), ${restoredEvents} événement(s), ${restoredNotes} note(s).`;
      showNotice('Sauvegarde B.O.C restaurée.');
      return { ok: true, message: summary };
    });
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
              <button
                type="button"
                onClick={() => {
                  setLiveAppId(null);
                  setActiveTab('overview');
                }}
                title="Retour à l'accueil B.O.C"
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-blue-700 transition-colors whitespace-nowrap cursor-pointer rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-slate-100"
              >
                <img
                  src="src/assets/images/boc_logo_emblem_flashy.png"
                  alt="Logo B.O.C"
                  referrerPolicy="no-referrer"
                  className="lg:hidden w-5 h-5 rounded-md object-cover shrink-0"
                />
                {activeProject && (
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: activeProject.color }}
                    aria-hidden="true"
                  />
                )}
                <span>{activeProject ? activeProject.code : 'B.O.C'}</span>
              </button>
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
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="hidden sm:inline">
                {activeTab === 'connector' ? 'Retour Accueil' : 'Paramètres'}
              </span>
              <span className="sm:hidden">
                {activeTab === 'connector' ? 'Accueil' : 'Paramètres'}
              </span>
            </button>
          </div>
        </header>

        <main
          className={
            liveAppId
              ? 'flex-1 min-w-0'
              : 'flex-1 px-3.5 sm:px-6 lg:px-8 pt-5 sm:py-6 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto'
          }
        >
          {notice && !liveAppId && (
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
                  calendarInviteEmails={controller.calendarInviteEmails}
                  controllerName={controller.displayName}
                  controllerEmail={controller.email}
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
                  onSaveCalendarInviteEmails={handleSaveCalendarInviteEmails}
                  onExportBackup={handleExportBackup}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </>
          )}
        </main>

        {!liveAppId && (
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
              const isActive = activeTab === item.id;
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
        )}

        <OfflineIndicator />
      </div>
    </div>
  );
}
