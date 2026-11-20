import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  CheckSquare,
  HardHat,
  Camera,
  ExternalLink,
  Plus,
  Upload,
  Check,
  Calendar,
  NotebookPen,
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

interface OverviewViewProps {
  controller: ControllerProfile;
  projects: Project[];
  selectedProjectId: string;
  todos: TodoItem[];
  calendarEntries: CalendarEntry[];
  notebooks: NotebookItem[];
  onNavigate: (tab: ModuleTab) => void;
  onOpenLiveApp: (appId: 'jtd' | 'inasep' | 'sitesnap') => void;
  onToggleEaEnCours: (projectId: string, checked: boolean) => Promise<void>;
  onChangeProjectColor: (projectId: string, color: string) => Promise<void>;
  onUpsertProject: (project: Omit<Project, 'id'> & { id?: string }) => Promise<void>;
  onImportProjectControlerFile: (file: File) => Promise<void>;
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
  onToggleEaEnCours,
  onChangeProjectColor,
  onUpsertProject,
  onImportProjectControlerFile,
}) => {
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingColorFor, setEditingColorFor] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [commune, setCommune] = useState('');
  const [color, setColor] = useState(PROJECT_COLOR_PALETTE[0].hex);
  const [marcheTotal, setMarcheTotal] = useState('450000');
  const [cumulValides, setCumulValides] = useState('0');
  const [eaEnCours, setEaEnCours] = useState('0');
  const [delaiRestant, setDelaiRestant] = useState('60');

  const syncFileRef = useRef<HTMLInputElement | null>(null);

  const visibleProjects =
    selectedProjectId === 'all'
      ? projects
      : projects.filter((p) => p.id === selectedProjectId);

  const openTodos = todos.filter((t) => !t.done);

  const formatEur = (val: number) =>
    new Intl.NumberFormat('fr-BE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(val);

  const startNewProject = () => {
    setEditingProject(null);
    setCode('');
    setName('');
    setCommune('');
    setColor(PROJECT_COLOR_PALETTE[projects.length % PROJECT_COLOR_PALETTE.length].hex);
    setMarcheTotal('450000');
    setCumulValides('0');
    setEaEnCours('0');
    setDelaiRestant('60');
    setShowProjectForm(true);
  };

  const startEditProject = (proj: Project) => {
    setEditingProject(proj);
    setCode(proj.code);
    setName(proj.name);
    setCommune(proj.commune);
    setColor(proj.color);
    setMarcheTotal(String(proj.marcheTotalReviseEur));
    setCumulValides(String(proj.cumulEaValidesEur));
    setEaEnCours(String(proj.eaEnCoursEur));
    setDelaiRestant(String(proj.delaiRestantJours));
    setShowProjectForm(true);
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
      eaEnCoursCoche: editingProject?.eaEnCoursCoche ?? false,
      delaiRestantJours: Math.max(0, Number(delaiRestant) || 0),
    });
    setShowProjectForm(false);
    setEditingProject(null);
  };

  const quickApps: {
    id: 'jtd' | 'inasep' | 'sitesnap';
    title: string;
    subtitle: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
  }[] = [
    {
      id: 'jtd',
      title: 'JTD',
      subtitle: 'Workflow & tâches terrain',
      url: controller.jtdUrl,
      icon: CheckSquare,
      accentClass: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'inasep',
      title: 'Project-Controler',
      subtitle: 'Chantiers, EA, intempéries & JC',
      url: controller.inasepUrl,
      icon: HardHat,
      accentClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'sitesnap',
      title: 'Appli-Photo',
      subtitle: 'Photos chantier & dossiers OneDrive',
      url: controller.sitesnapUrl,
      icon: Camera,
      accentClass: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  ];

  const getProject = (id: string) => projects.find((p) => p.id === id);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Boîte à Outils du Contrôleur · {controller.displayName}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5 text-balance">
              Vos 3 applications en accès direct
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickApps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-5"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${app.accentClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                      {app.title}
                    </h2>
                    <p className="text-xs text-slate-600">{app.subtitle}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onOpenLiveApp(app.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
                  >
                    <span>Ouvrir dans B.O.C</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <span>Nouvel onglet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Vos chantiers actifs · Vision globale Project-Controler
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Marché total révisé, cumul des EA validés, EA en cours (coché), avancement global et délais restants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => syncFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Sync Project-Controler (.JSON)</span>
            </button>
            <input
              ref={syncFileRef}
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await onImportProjectControlerFile(file);
                  if (syncFileRef.current) syncFileRef.current.value = '';
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={startNewProject}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter chantier</span>
            </button>
          </div>
        </div>

        {showProjectForm && (
          <form
            onSubmit={handleSaveProject}
            className="p-5 bg-slate-50 border-b border-slate-200 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              {editingProject
                ? `Mettre à jour ${editingProject.code}`
                : 'Ajouter un chantier actif'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectForm(false);
                    setEditingProject(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
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
                  EA en cours (coché)
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
                const effectiveCumul =
                  p.cumulEaValidesEur + (p.eaEnCoursCoche ? p.eaEnCoursEur : 0);
                const pct =
                  p.marcheTotalReviseEur > 0
                    ? Math.min(
                        100,
                        Math.round((effectiveCumul / p.marcheTotalReviseEur) * 100)
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
                            <span className="font-mono">{p.code}</span> · {p.commune}
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

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleEaEnCours(p.id, !p.eaEnCoursCoche)}
                          title={
                            p.eaEnCoursCoche
                              ? 'EA en cours inclus dans le calcul'
                              : 'EA en cours non coché'
                          }
                          aria-label={`Inclure EA en cours de ${p.code}`}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            p.eaEnCoursCoche
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <span
                          className={`font-mono tabular-nums ${
                            p.eaEnCoursCoche
                              ? 'text-slate-900 font-medium'
                              : 'text-slate-400 line-through'
                          }`}
                        >
                          {formatEur(p.eaEnCoursEur)}
                        </span>
                      </div>
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
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                    Aucun chantier actif enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-slate-500" />
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

        <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Calendrier · Annotations & Intempéries
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              Ouvrir
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {calendarEntries.slice(0, 4).map((ev) => {
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
                      {ev.source === 'project-controler'
                        ? `${ev.entryType} (Project-Controler)`
                        : 'Annotation'}
                    </span>
                  </div>
                </div>
              );
            })}
            {calendarEntries.length === 0 && (
              <div className="p-6 text-sm text-slate-500">
                Aucun événement au calendrier.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Blocs-notes récents ({notebooks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notes')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              Ouvrir
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {notebooks.slice(0, 4).map((n) => {
              const proj = getProject(n.projectId);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onNavigate('notes')}
                  className="w-full text-left px-5 py-3 hover:bg-slate-50 space-y-1 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {n.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {proj ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span>{proj.commune}</span>
                      </span>
                    ) : (
                      <span>Général</span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{n.updatedAt}</span>
                  </div>
                </button>
              );
            })}
            {notebooks.length === 0 && (
              <div className="p-6 text-sm text-slate-500">
                Aucun bloc-notes créé.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
