import React from 'react';
import {
  LayoutGrid,
  GanttChartSquare,
  CheckSquare,
  Calendar,
  NotebookPen,
  Link2,
  Download,
  LogOut,
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
  onSignOut: () => void;
  controller: ControllerProfile;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: ModuleTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Accueil · 3 Applis', icon: LayoutGrid },
  { id: 'planning', label: 'Planning (Gantt)', icon: GanttChartSquare },
  { id: 'todo', label: 'To-Do Liste', icon: CheckSquare },
  { id: 'calendar', label: 'Calendrier', icon: Calendar },
  { id: 'notes', label: 'Prise de notes', icon: NotebookPen },
  { id: 'connector', label: 'Liens & Compte', icon: Link2 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  projects,
  selectedProjectId,
  onSelectProject,
  onExportBackup,
  onSignOut,
  controller,
  mobileOpen,
  onCloseMobile,
}) => {
  const content = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 w-64 shrink-0">
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="src/assets/images/boc_logo_emblem_1795171020204.jpg"
            alt="Logo B.O.C"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-md border border-slate-200 object-cover shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            B.O.C
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Fermer le menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-4 border-b border-slate-200">
        <label
          htmlFor="project-filter"
          className="block text-xs font-medium text-slate-500 mb-1.5"
        >
          Périmètre chantier
        </label>
        <select
          id="project-filter"
          value={selectedProjectId}
          onChange={(e) => onSelectProject(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
        >
          <option value="all">Tous les chantiers ({projects.length})</option>
          {projects.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.code} — {proj.commune}
            </option>
          ))}
        </select>
      </div>

      <nav
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        aria-label="Navigation principale"
      >
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-500'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-2.5">
        <div className="space-y-0.5 px-1">
          <div className="text-xs font-semibold text-slate-900 truncate">
            {controller.displayName}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {controller.email}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Quitter</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center pt-1">
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
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
