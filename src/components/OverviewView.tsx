import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Plus,
  Upload,
  Calendar,
  NotebookPen,
  CheckSquare,
  GanttChartSquare,
  Trash2,
} from 'lucide-react';
import { PROJECT_COLOR_PALETTE } from '../data/initialData';
import {
  CalendarEntry,
  ControllerProfile,
  ModuleTab,
  NotebookItem,
  Project,
  TodoItem,
} from '../types';
import { deriveLightPostItColors } from '../utils/colorUtils';

interface OverviewViewProps {
  controller: ControllerProfile;
  projects: Project[];
  selectedProjectId: string;
  todos: TodoItem[];
  calendarEntries: CalendarEntry[];
  notebooks: NotebookItem[];
  onNavigate: (tab: ModuleTab) => void;
  onOpenLiveApp: (appId: 'jtd' | 'inasep' | 'sitesnap') => void;
  onChangeProjectColor: (projectId: string, color: string) => Promise<void>;
  onUpsertProject: (
    project: Omit<Project, 'id'> & { id?: string }
  ) => Promise<string | null | void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onImportProjectControlerFile: (files: File | FileList | File[]) => Promise<void>;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  controller,
  projects,
  selectedProjectId,
  todos,
  calendarEntries,
  notebooks,
  onNavigate,
  onOpenLiveApp,
  onChangeProjectColor,
  onUpsertProject,
  onDeleteProject,
  onImportProjectControlerFile,
}) => {
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingColorFor, setEditingColorFor] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [commune, setCommune] = useState('');
  const [color, setColor] = useState(PROJECT_COLOR_PALETTE[0].hex);
  const [marcheTotal, setMarcheTotal] = useState('450000');
  const [cumulValides, setCumulValides] = useState('0');
  const [eaEnCours, setEaEnCours] = useState('0');
  const [delaiRestant, setDelaiRestant] = useState('60');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [contractualEndDate, setContractualEndDate] = useState('2027-02-28');
  const [estimatedEndDate, setEstimatedEndDate] = useState('2027-02-28');

  const syncFileRef = useRef<HTMLInputElement | null>(null);
  const projectFormRef = useRef<HTMLFormElement | null>(null);

  const visibleProjects =
    selectedProjectId === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProjectId);

  const openTodos = todos.filter((t) => !t.done);

  // Uniquement les rendez-vous / annotations B.O.C sur l'accueil (pas les intempéries ni JC)
  const recapCalendarEntries = calendarEntries.filter(
    (ev) =>
      ev.source !== 'project-controler' &&
      ev.entryType !== 'Intempérie' &&
      ev.entryType !== 'JC'
  );

  const formatEur = (val: number) =>
    new Intl.NumberFormat('fr-BE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(val);

  const startNewProject = () => {
    setEditingProject(null);
    setConfirmDelete(false);
    setCode('');
    setName('');
    setCommune('');
    setColor(
      PROJECT_COLOR_PALETTE[projects.length % PROJECT_COLOR_PALETTE.length].hex
    );
    setMarcheTotal('450000');
    setCumulValides('0');
    setEaEnCours('0');
    setDelaiRestant('60');
    setStartDate(new Date().toISOString().slice(0, 10));
    setContractualEndDate('2027-03-31');
    setEstimatedEndDate('2027-03-31');
    setShowProjectForm(true);
    setTimeout(() => {
      projectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  };

  const startEditProject = (proj: Project) => {
    setEditingProject(proj);
    setConfirmDelete(false);
    setCode(proj.code);
    setName(proj.name);
    setCommune(proj.commune);
    setColor(proj.color);
    setMarcheTotal(String(proj.marcheTotalReviseEur));
    setCumulValides(String(proj.cumulEaValidesEur));
    setEaEnCours(String(proj.eaEnCoursEur));
    setDelaiRestant(String(proj.delaiRestantJours));
    setStartDate(proj.startDate || '2026-09-01');
    setContractualEndDate(
      proj.contractualEndDate || proj.estimatedEndDate || '2027-02-28'
    );
    setEstimatedEndDate(proj.estimatedEndDate || '2027-02-28');
    setShowProjectForm(true);
    setTimeout(() => {
      projectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !commune.trim()) return;
    await onUpsertProject({
      id: editingProject?.id,
      code: code.trim(),
      name: name.trim(),
      commune: commune.trim(),
      color,
      marcheTotalReviseEur: Math.max(0, Number(marcheTotal) || 0),
      cumulEaValidesEur: Math.max(0, Number(cumulValides) || 0),
      eaEnCoursEur: Math.max(0, Number(eaEnCours) || 0),
      eaEnCoursCoche: true,
      delaiRestantJours: Math.max(0, Number(delaiRestant) || 0),
      startDate,
      contractualEndDate: contractualEndDate || estimatedEndDate,
      estimatedEndDate,
    });
    setShowProjectForm(false);
    setEditingProject(null);
    setConfirmDelete(false);
  };

  const handleConfirmDeleteProject = async () => {
    if (!editingProject || deleting) return;
    setDeleting(true);
    try {
      await onDeleteProject(editingProject.id);
      setShowProjectForm(false);
      setEditingProject(null);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const quickApps: {
    id: 'jtd' | 'inasep' | 'sitesnap';
    title: string;
    subtitle: string;
    url: string;
    iconSrc: string;
    cardBgClass: string;
    topBarClass: string;
    btnClass: string;
  }[] = [
    {
      id: 'jtd',
      title: 'JDT',
      subtitle: 'Workflow & tâches terrain',
      url: controller.jtdUrl,
      iconSrc: 'app-icons/jdt-icon.svg',
      cardBgClass:
        'bg-gradient-to-br from-blue-50/90 via-white to-white border-blue-200/90 hover:border-blue-300',
      topBarClass: 'from-blue-600 to-indigo-500',
      btnClass:
        'bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 shadow-xs shadow-blue-700/20',
    },
    {
      id: 'inasep',
      title: 'Project-Controler',
      subtitle: 'Chantiers, EA, intempéries & JC',
      url: controller.inasepUrl,
      iconSrc: 'app-icons/project-controler-icon.png',
      cardBgClass:
        'bg-gradient-to-br from-sky-50/95 via-white to-white border-sky-200/90 hover:border-sky-300',
      topBarClass: 'from-sky-500 to-cyan-500',
      btnClass:
        'bg-gradient-to-r from-sky-700 to-cyan-600 hover:from-sky-800 hover:to-cyan-700 shadow-xs shadow-sky-700/20',
    },
    {
      id: 'sitesnap',
      title: 'Appli-Photo',
      subtitle: 'Photos chantier & dossiers OneDrive',
      url: controller.sitesnapUrl,
      iconSrc: 'app-icons/appli-photo-icon.png',
      cardBgClass:
        'bg-gradient-to-br from-amber-50/90 via-white to-white border-amber-200/90 hover:border-amber-300',
      topBarClass: 'from-amber-500 to-orange-500',
      btnClass:
        'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-xs shadow-amber-600/20',
    },
  ];

  const getProject = (id: string) => projects.find((p) => p.id === id);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Boîte à Outils du Contrôleur · {controller.displayName}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5 text-balance">
              Vos 3 applications en accès direct
            </h1>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('planning')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
          >
            <GanttChartSquare className="w-4 h-4" />
            <span>Voir le planning Gantt</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickApps.map((app) => (
            <div
              key={app.id}
              className={`border rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between ${app.cardBgClass}`}
            >
              <div className={`h-1.5 w-full bg-gradient-to-r ${app.topBarClass}`} />
              <div className="p-5 flex flex-col justify-between gap-5 flex-1">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200/80 bg-white shrink-0 shadow-xs p-1">
                    <img
                      src={app.iconSrc}
                      alt={`Icône ${app.title}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                      {app.title}
                    </h2>
                    <p className="text-xs text-slate-600">{app.subtitle}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => onOpenLiveApp(app.id)}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all whitespace-nowrap ${app.btnClass}`}
                  >
                    <span>Ouvrir dans B.O.C</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap"
                  >
                    <span>Nouvel onglet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-white">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                To-Do · À traiter ({openTodos.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('todo')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              Ouvrir
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {openTodos.slice(0, 4).map((t) => {
              const proj = getProject(t.projectId);
              return (
                <div key={t.id} className="px-5 py-3 space-y-1">
                  <p className="text-sm font-medium text-slate-900 leading-snug">
                    {t.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {proj && (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span>{proj.commune}</span>
                      </span>
                    )}
                    {proj && <span aria-hidden="true">·</span>}
                    <span
                      className={
                        t.priority === 'Haute'
                          ? 'text-red-700 font-medium'
                          : 'text-slate-600'
                      }
                    >
                      {t.priority}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{t.dueDate}</span>
                  </div>
                </div>
              );
            })}
            {openTodos.length === 0 && (
              <div className="p-6 text-sm text-slate-500">
                Aucune tâche en attente.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4 bg-gradient-to-r from-amber-50/90 via-yellow-50/50 to-white">
            <div className="flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Post-it & Notes ({notebooks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notes')}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap"
            >
              Ouvrir
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 flex-1">
            {notebooks.slice(0, 3).map((n) => {
              const proj = getProject(n.projectId);
              const tinted = proj
                ? deriveLightPostItColors(proj.color)
                : { bgHex: n.color || '#FEF9C3', borderHex: 'rgba(0,0,0,0.1)' };
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onNavigate('notes')}
                  className="w-full text-left p-3 rounded-xl border hover:shadow-xs transition-all space-y-1"
                  style={{
                    backgroundColor: tinted.bgHex,
                    borderColor: tinted.borderHex,
                  }}
                >
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {n.title}
                  </p>
                  <p className="text-[11px] text-slate-700 line-clamp-1">
                    {n.content || 'Note vide...'}
                  </p>
                </button>
              );
            })}
            {notebooks.length === 0 && (
              <div className="p-4 text-sm text-slate-500">
                Aucun post-it créé.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/85 via-teal-50/40 to-white">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Calendrier · Prochains rendez-vous
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Ouvrir
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {recapCalendarEntries.slice(0, 4).map((ev) => {
              const proj = getProject(ev.projectId);
              return (
                <div key={ev.id} className="px-5 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {ev.title}
                    </p>
                    <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                      {ev.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {proj && (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span>{proj.commune}</span>
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>
                      {ev.startTime ? `${ev.startTime} · ` : ''}
                      Rendez-vous
                    </span>
                  </div>
                </div>
              );
            })}
            {recapCalendarEntries.length === 0 && (
              <div className="p-6 text-sm text-slate-500">
                Aucun rendez-vous à venir (les intempéries et JC sont visibles dans le Calendrier).
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-blue-50/35 to-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Vos chantiers actifs · Vision globale Project-Controler
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Marché total révisé, cumul EA validés, EA en cours (reprise Project-Controler), avancement global et délais restants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => syncFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-sky-700" />
              <span>Importer / Sync (.JSON)</span>
            </button>
            <input
              ref={syncFileRef}
              type="file"
              multiple
              accept=".json,application/json"
              onChange={async (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  await onImportProjectControlerFile(files);
                  if (syncFileRef.current) syncFileRef.current.value = '';
                  if (showProjectForm && !editingProject) {
                    setShowProjectForm(false);
                  }
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={startNewProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-xs shadow-blue-700/20 transition-all whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter chantier</span>
            </button>
          </div>
        </div>

        {showProjectForm && (
          <form
            ref={projectFormRef}
            onSubmit={handleSaveProject}
            className="p-5 bg-slate-50 border-b border-slate-200 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingProject
                  ? `Mettre à jour ${editingProject.code}`
                  : 'Ajouter un chantier actif'}
              </h3>
              {!editingProject && (
                <button
                  type="button"
                  onClick={() => syncFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Créer depuis un fichier Project-Controler (.JSON)</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Code chantier
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex. INASEP-26-081"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Intitulé
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. Réfection voirie & égouttage..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Commune
                </label>
                <input
                  type="text"
                  required
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="Ex. Namur"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Délai restant (jours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={delaiRestant}
                  onChange={(e) => setDelaiRestant(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Marché total révisé (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={marcheTotal}
                  onChange={(e) => setMarcheTotal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cumul EA validés (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={cumulValides}
                  onChange={(e) => setCumulValides(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  EA en cours (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={eaEnCours}
                  onChange={(e) => setEaEnCours(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Début chantier
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Fin estimée
                </label>
                <input
                  type="date"
                  value={estimatedEndDate}
                  onChange={(e) => setEstimatedEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Couleur chantier :
                  </span>
                  {PROJECT_COLOR_PALETTE.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      onClick={() => setColor(sw.hex)}
                      title={sw.label}
                      className={`w-6 h-6 rounded border ${
                        color === sw.hex
                          ? 'border-slate-900 scale-110'
                          : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  ))}
                </div>

                {editingProject && (
                  <div className="flex items-center gap-2">
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer ce chantier</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
                        <span className="text-xs font-medium text-red-800 whitespace-nowrap">
                          Retirer du suivi ?
                        </span>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={handleConfirmDeleteProject}
                          className="px-2.5 py-1 rounded-md bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                        >
                          {deleting ? 'Suppression...' : 'Confirmer'}
                        </button>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => setConfirmDelete(false)}
                          className="px-2 py-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Non
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectForm(false);
                    setEditingProject(null);
                    setConfirmDelete(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-xs"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="md:hidden divide-y divide-slate-100">
          {visibleProjects.map((p) => {
            const effectiveCumul = p.cumulEaValidesEur + p.eaEnCoursEur;
            const pct =
              p.marcheTotalReviseEur > 0
                ? Math.min(
                    100,
                    Math.round((effectiveCumul / p.marcheTotalReviseEur) * 100)
                  )
                : 0;
            return (
              <div key={`mob-${p.id}`} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm mt-1 shrink-0"
                      style={{ backgroundColor: p.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 leading-snug">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{p.code}</span> · {p.commune}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditProject(p)}
                    className="px-2.5 py-1 rounded-md border border-slate-200 text-xs font-medium text-blue-700 hover:bg-blue-50 shrink-0"
                  >
                    Éditer
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 rounded-lg p-3">
                  <div>
                    <div className="text-slate-500">Marché total révisé</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatEur(p.marcheTotalReviseEur)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Cumul EA validés</div>
                    <div className="font-mono tabular-nums font-semibold text-emerald-700 mt-0.5">
                      {formatEur(p.cumulEaValidesEur)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">EA en cours</div>
                    <div className="font-mono tabular-nums font-semibold text-blue-700 mt-0.5">
                      {formatEur(p.eaEnCoursEur)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Délai restant</div>
                    <div
                      className={`font-mono tabular-nums font-semibold mt-0.5 ${
                        p.delaiRestantJours <= 15
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {p.delaiRestantJours} j
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: p.color }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}

          {visibleProjects.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              Aucun chantier actif enregistré.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3">Chantier</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  Marché total révisé
                </th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  Cumul EA validés
                </th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  EA en cours
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Avancement global</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">
                  Délai restant
                </th>
                <th className="py-3 pl-3 pr-5 text-right">Modifier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {visibleProjects.map((p) => {
                const effectiveCumul = p.cumulEaValidesEur + p.eaEnCoursEur;
                const pct =
                  p.marcheTotalReviseEur > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (effectiveCumul / p.marcheTotalReviseEur) * 100
                        )
                      )
                    : 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-start gap-2.5">
                        <div className="relative mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingColorFor((curr) =>
                                curr === p.id ? null : p.id
                              )
                            }
                            title="Changer la couleur du chantier"
                            className="w-3.5 h-3.5 rounded-sm border border-slate-300 shrink-0 block"
                            style={{ backgroundColor: p.color }}
                          />
                          {editingColorFor === p.id && (
                            <div className="absolute left-0 top-full mt-1.5 z-20 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm flex items-center gap-1">
                              {PROJECT_COLOR_PALETTE.map((sw) => (
                                <button
                                  key={sw.hex}
                                  type="button"
                                  onClick={async () => {
                                    await onChangeProjectColor(p.id, sw.hex);
                                    setEditingColorFor(null);
                                  }}
                                  className="w-5 h-5 rounded border border-slate-200"
                                  style={{ backgroundColor: sw.hex }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            <span className="font-mono">{p.code}</span> ·{' '}
                            {p.commune}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {formatEur(p.marcheTotalReviseEur)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium whitespace-nowrap">
                      {formatEur(p.cumulEaValidesEur)}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-blue-700 font-semibold whitespace-nowrap">
                      {formatEur(p.eaEnCoursEur)}
                    </td>

                    <td className="py-3.5 px-3 min-w-[140px]">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: p.color,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono tabular-nums font-semibold text-slate-900 w-9 text-right">
                          {pct}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          p.delaiRestantJours <= 15
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-700'
                        }
                      >
                        {p.delaiRestantJours} j
                      </span>
                    </td>

                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEditProject(p)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        Éditer
                      </button>
                    </td>
                  </tr>
                );
              })}

              {visibleProjects.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-500"
                  >
                    Aucun chantier actif enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
