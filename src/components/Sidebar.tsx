import React from 'react';
import {
  LayoutGrid,
  GanttChartSquare,
  CheckSquare,
  Calendar,
  NotebookPen,
  Settings,
  LogOut,
  Save,
  X,
} from 'lucide-react';
import { ControllerProfile, ModuleTab, Project } from '../types';

interface SidebarProps {
  activeTab: ModuleTab;
  onSelectTab: (tab: ModuleTab) => void;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onExportBackup: () => void;
  localBackupFolderName?: string | null;
  localBackupNeedsReactivation?: boolean;
  onReactivateLocalBackup?: () => void;
  onSignOut: () => void;
  controller: ControllerProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: ModuleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
}[] = [
  {
    id: 'overview',
    label: 'Accueil · 3 Applis',
    icon: LayoutGrid,
    accentClass: 'text-sky-300',
  },
  {
    id: 'planning',
    label: 'Planning (Gantt)',
    icon: GanttChartSquare,
    accentClass: 'text-cyan-300',
  },
  {
    id: 'todo',
    label: 'To-Do Liste',
    icon: CheckSquare,
    accentClass: 'text-indigo-300',
  },
  {
    id: 'calendar',
    label: 'Calendrier',
    icon: Calendar,
    accentClass: 'text-emerald-300',
  },
  {
    id: 'notes',
    label: 'Prise de notes',
    icon: NotebookPen,
    accentClass: 'text-amber-300',
  },
];

const SETTINGS_NAV_ITEM: {
  id: ModuleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
} = {
  id: 'connector',
  label: 'Paramètres',
  icon: Settings,
  accentClass: 'text-slate-200',
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  projects,
  selectedProjectId,
  onSelectProject,
  onExportBackup,
  localBackupFolderName,
  localBackupNeedsReactivation,
  onReactivateLocalBackup,
  onSignOut,
  controller,
  mobileOpen,
  onCloseMobile,
}) => {
  const activeProject =
    selectedProjectId === 'all'
      ? null
      : projects.find((p) => p.id === selectedProjectId) ?? null;

  const SettingsIcon = SETTINGS_NAV_ITEM.icon;
  const isSettingsActive = activeTab === SETTINGS_NAV_ITEM.id;

  const content = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#071430] via-[#0B1F4D] to-[#08173A] text-slate-100 border-r border-blue-950/80 w-68 shrink-0 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            onSelectTab('overview');
            onCloseMobile();
          }}
          title="Retour à l'accueil B.O.C"
          className="group flex items-center gap-3 min-w-0 text-left rounded-xl p-1 -m-1 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl overflow-hidden ring-2 ring-cyan-400/45 group-hover:ring-cyan-300 shadow-lg shadow-blue-950/60 bg-[#052BB8] shrink-0 transition-all">
            <img
              src="src/assets/images/boc_logo_emblem_flashy.png"
              alt="Logo B.O.C"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <span className="font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap block leading-tight">
              B.O.C
            </span>
            <span className="text-[11px] font-medium text-sky-200/80 truncate block">
              Boîte à Outils · Contrôleur
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fermer le menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Perimeter Selector */}
      <div className="px-4 py-3.5 border-b border-white/10">
        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="project-filter"
              className="block text-[11px] font-semibold text-sky-200/90"
            >
              Périmètre chantier
            </label>
            {activeProject && (
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-white/40"
                style={{ backgroundColor: activeProject.color }}
                aria-hidden="true"
              />
            )}
          </div>
          <select
            id="project-filter"
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-[#0D2558] px-2.5 py-2 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-colors cursor-pointer"
          >
            <option value="all" className="bg-[#0B1F4D] text-white">
              Tous les chantiers ({projects.length})
            </option>
            {projects.map((proj) => (
              <option
                key={proj.id}
                value={proj.id}
                className="bg-[#0B1F4D] text-white"
              >
                {proj.code} — {proj.commune}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Navigation */}
      <nav
        className="flex-1 px-3 py-4 flex flex-col justify-between gap-4 overflow-y-auto"
        aria-label="Navigation principale"
      >
        <div className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-sky-500 text-white shadow-md shadow-blue-950/50 ring-1 ring-white/20'
                    : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span
                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : `bg-white/[0.06] ${item.accentClass} group-hover:bg-white/12 group-hover:text-white`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              onSelectTab(SETTINGS_NAV_ITEM.id);
              onCloseMobile();
            }}
            className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isSettingsActive
                ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-sky-500 text-white shadow-md shadow-blue-950/50 ring-1 ring-white/20'
                : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <span
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                isSettingsActive
                  ? 'bg-white/20 text-white'
                  : `bg-white/[0.06] ${SETTINGS_NAV_ITEM.accentClass} group-hover:bg-white/12 group-hover:text-white`
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
            </span>
            <span className="truncate">{SETTINGS_NAV_ITEM.label}</span>
          </button>
        </div>
      </nav>

      {/* Controller Footer Card */}
      <div className="p-3.5 border-t border-white/10 space-y-2.5">
        <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3 space-y-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(controller.displayName)}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-semibold text-white truncate">
                {controller.displayName}
              </div>
              <div className="text-[11px] text-sky-200/70 truncate">
                {controller.email}
              </div>
            </div>
          </div>

          {localBackupFolderName && localBackupNeedsReactivation && onReactivateLocalBackup && (
            <button
              type="button"
              onClick={onReactivateLocalBackup}
              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-400/40 bg-amber-400/15 text-[11px] font-medium text-amber-200 hover:bg-amber-400/25 transition-colors text-left truncate"
              title={`Réactiver la sauvegarde auto dans « ${localBackupFolderName} »`}
            >
              Réactiver dossier · {localBackupFolderName}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExportBackup}
              title={
                localBackupFolderName
                  ? `Sauvegarder dans « ${localBackupFolderName} »`
                  : 'Télécharger une sauvegarde B.O.C (.JSON)'
              }
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-white/15 bg-white/[0.07] text-xs font-medium text-slate-100 hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
              <span>Sauvegarder</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-white/15 bg-white/[0.07] text-xs font-medium text-slate-200 hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-200 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              <span>Quitter</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-sky-200/50 text-center">
          Fabien Pirquin · B.O.C
        </p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0">
        {content}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full shadow-2xl">{content}</div>
        </div>
      )}
    </>
  );
};
