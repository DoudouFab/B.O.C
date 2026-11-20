import React, { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
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
import { TodoView } from './components/TodoView';
import { CalendarView } from './components/CalendarView';
import { NotesView } from './components/NotesView';
import { AppsConnectorView } from './components/AppsConnectorView';
import { LiveAppEmbedView } from './components/LiveAppEmbedView';

const PERMANENT_URLS = {
  jtd: 'https://doudoufab.github.io/JTD/',
  inasep: 'https://doudoufab.github.io/Project-Controler-Fabien.PIRQUIN/',
  sitesnap: 'https://doudoufab.github.io/Appli-Photo/',
};

const TAB_LABELS: Record<ModuleTab, string> = {
  overview: 'Accueil · 3 Applis',
  todo: 'To-Do Liste',
  calendar: 'Calendrier',
  notes: 'Prise de notes',
  connector: 'Liens & Compte',
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
          setController({
            uid: d.uid,
            email: d.email,
            displayName: d.displayName,
            jtdUrl: d.jtdUrl || PERMANENT_URLS.jtd,
            inasepUrl: d.inasepUrl || PERMANENT_URLS.inasep,
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
            color: d.data().color || PROJECT_COLOR_PALETTE[0].hex,
            marcheTotalReviseEur: Number(d.data().marcheTotalReviseEur) || 0,
            cumulEaValidesEur: Number(d.data().cumulEaValidesEur) || 0,
            eaEnCoursEur: Number(d.data().eaEnCoursEur) || 0,
            eaEnCoursCoche: Boolean(d.data().eaEnCoursCoche),
            delaiRestantJours: Number(d.data().delaiRestantJours) || 0,
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

  if (!authReady || (user && (loadingProfile || !controller))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
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

  const handleToggleEaEnCours = async (projectId: string, checked: boolean) => {
    const path = `controllers/${uid}/projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'projects', projectId), {
        eaEnCoursCoche: checked,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleChangeProjectColor = async (projectId: string, color: string) => {
    const path = `controllers/${uid}/projects/${projectId}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'projects', projectId), {
        color,
        updatedAt: serverTimestamp(),
      });
      showNotice('Couleur du chantier mise à jour.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUpsertProject = async (
    proj: Omit<Project, 'id'> & { id?: string }
  ) => {
    const id = proj.id || `proj-${Date.now()}`;
    const path = `controllers/${uid}/projects/${id}`;
    try {
      if (proj.id) {
        await updateDoc(doc(db, 'controllers', uid, 'projects', id), {
          code: proj.code.slice(0, 64),
          name: proj.name.slice(0, 180),
          commune: proj.commune.slice(0, 100),
          color: proj.color,
          marcheTotalReviseEur: proj.marcheTotalReviseEur,
          cumulEaValidesEur: proj.cumulEaValidesEur,
          eaEnCoursEur: proj.eaEnCoursEur,
          eaEnCoursCoche: proj.eaEnCoursCoche,
          delaiRestantJours: proj.delaiRestantJours,
          updatedAt: serverTimestamp(),
        });
        showNotice(`Chantier ${proj.code} mis à jour.`);
      } else {
        await setDoc(doc(db, 'controllers', uid, 'projects', id), {
          ownerUid: uid,
          code: proj.code.slice(0, 64),
          name: proj.name.slice(0, 180),
          commune: proj.commune.slice(0, 100),
          color: proj.color,
          marcheTotalReviseEur: proj.marcheTotalReviseEur,
          cumulEaValidesEur: proj.cumulEaValidesEur,
          eaEnCoursEur: proj.eaEnCoursEur,
          eaEnCoursCoche: proj.eaEnCoursCoche,
          delaiRestantJours: proj.delaiRestantJours,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showNotice(`Chantier ${proj.code} ajouté.`);
      }
    } catch (error) {
      handleFirestoreError(
        error,
        proj.id ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  };

  const handleAddAnnotation = async (entry: {
    projectId: string;
    date: string;
    title: string;
    details: string;
  }) => {
    const id = `cal-${Date.now()}`;
    const path = `controllers/${uid}/calendarEntries/${id}`;
    try {
      await setDoc(doc(db, 'controllers', uid, 'calendarEntries', id), {
        ownerUid: uid,
        projectId: entry.projectId || 'general',
        date: entry.date,
        title: entry.title.slice(0, 200),
        details: entry.details.slice(0, 600),
        entryType: 'Annotation',
        source: 'boc',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showNotice('Annotation ajoutée au calendrier.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteCalendarEntry = async (id: string) => {
    const path = `controllers/${uid}/calendarEntries/${id}`;
    try {
      await deleteDoc(doc(db, 'controllers', uid, 'calendarEntries', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleImportProjectControlerFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
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

      const incomingProjects = parsed.projects ?? parsed.chantiers ?? [];
      let updatedProjectsCount = 0;

      for (const item of incomingProjects) {
        if (!item.code || !item.name) continue;
        const existingMatch = projects.find((p) => p.code === item.code);
        await handleUpsertProject({
          id: existingMatch?.id,
          code: item.code,
          name: item.name,
          commune: item.commune ?? existingMatch?.commune ?? 'Chantier',
          color:
            existingMatch?.color ??
            PROJECT_COLOR_PALETTE[updatedProjectsCount % PROJECT_COLOR_PALETTE.length].hex,
          marcheTotalReviseEur: Number(item.marcheTotalReviseEur ?? existingMatch?.marcheTotalReviseEur ?? 0),
          cumulEaValidesEur: Number(item.cumulEaValidesEur ?? existingMatch?.cumulEaValidesEur ?? 0),
          eaEnCoursEur: Number(item.eaEnCoursEur ?? existingMatch?.eaEnCoursEur ?? 0),
          eaEnCoursCoche: Boolean(item.eaEnCoursCoche ?? existingMatch?.eaEnCoursCoche ?? false),
          delaiRestantJours: Number(item.delaiRestantJours ?? existingMatch?.delaiRestantJours ?? 0),
        });
        updatedProjectsCount += 1;
      }

      const incomingEvents = parsed.intemperies ?? [];
      let importedEventsCount = 0;
      for (const ev of incomingEvents) {
        if (!ev.date || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) continue;
        const matchedProj = projects.find(
          (p) => p.id === ev.projectId || p.code === ev.code
        );
        const id = `pc-${ev.date}-${importedEventsCount}-${Date.now()}`;
        await setDoc(doc(db, 'controllers', uid, 'calendarEntries', id), {
          ownerUid: uid,
          projectId: matchedProj?.id ?? 'general',
          date: ev.date,
          title: (ev.title || ev.motif || 'Intempérie Project-Controler').slice(0, 200),
          details: 'Synchronisé depuis Project-Controler.',
          entryType: ev.type === 'JC' ? 'JC' : 'Intempérie',
          source: 'project-controler',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        importedEventsCount += 1;
      }

      showNotice(
        `Sync Project-Controler : ${updatedProjectsCount} chantier(s), ${importedEventsCount} intempérie(s)/JC.`
      );
    } catch {
      showNotice('Fichier JSON Project-Controler invalide ou illisible.');
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
        pinned: note.pinned,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showNotice('Bloc-notes créé.');
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleUpdateNotebook = async (
    id: string,
    patch: Partial<Pick<NotebookItem, 'title' | 'content' | 'projectId' | 'pinned'>>
  ) => {
    const path = `controllers/${uid}/notebooks/${id}`;
    try {
      await updateDoc(doc(db, 'controllers', uid, 'notebooks', id), {
        ...(patch.title !== undefined ? { title: patch.title.slice(0, 180) } : {}),
        ...(patch.content !== undefined
          ? { content: patch.content.slice(0, 25000) }
          : {}),
        ...(patch.projectId !== undefined
          ? { projectId: patch.projectId || 'general' }
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
      showNotice('Bloc-notes supprimé.');
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
      return { title: 'JTD', url: controller.jtdUrl || PERMANENT_URLS.jtd };
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
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
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
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir la navigation"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-500 whitespace-nowrap">
                {activeProject ? activeProject.code : 'B.O.C'}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">
                {liveAppId
                  ? getLiveAppInfo(liveAppId).title
                  : TAB_LABELS[activeTab]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {notice && (
              <span className="hidden md:inline text-xs font-medium text-emerald-700 whitespace-nowrap">
                {notice}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setLiveAppId(null);
                setActiveTab(
                  activeTab === 'connector' ? 'overview' : 'connector'
                );
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {activeTab === 'connector' ? 'Retour Accueil' : 'Liens & Compte'}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {liveAppId ? (
            <LiveAppEmbedView
              appId={liveAppId}
              title={getLiveAppInfo(liveAppId).title}
              url={getLiveAppInfo(liveAppId).url}
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
                  onToggleEaEnCours={handleToggleEaEnCours}
                  onChangeProjectColor={handleChangeProjectColor}
                  onUpsertProject={handleUpsertProject}
                  onImportProjectControlerFile={handleImportProjectControlerFile}
                />
              )}

              {activeTab === 'todo' && (
                <TodoView
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  todos={filterByProject(todos)}
                  onAddTodo={handleAddTodo}
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
      </div>
    </div>
  );
}
