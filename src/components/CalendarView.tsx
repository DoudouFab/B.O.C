import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CloudRain,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { PROJECT_COLOR_PALETTE } from '../data/initialData';
import { CalendarEntry, Project } from '../types';

interface CalendarViewProps {
  projects: Project[];
  entries: CalendarEntry[];
  projectControlerUrl: string;
  onAddAnnotation: (entry: {
    projectId: string;
    date: string;
    title: string;
    details: string;
  }) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onChangeProjectColor: (projectId: string, color: string) => Promise<void>;
  onImportProjectControlerFile: (file: File) => Promise<void>;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  projects,
  entries,
  projectControlerUrl,
  onAddAnnotation,
  onDeleteEntry,
  onChangeProjectColor,
  onImportProjectControlerFile,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(10); // 0-indexed: 10 = Novembre 2026
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [editingColorFor, setEditingColorFor] = useState<string | null>(null);

  const [formProjectId, setFormProjectId] = useState<string>(
    projects[0]?.id ?? 'general'
  );
  const [formTitle, setFormTitle] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const mondayOffset = (firstDayOfMonth.getDay() + 6) % 7;

  const calendarCells: (string | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    calendarCells.push(`${viewYear}-${mm}-${dd}`);
  }
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(now.toISOString().slice(0, 10));
  };

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const selectedDayEntries = entries.filter((e) => e.date === selectedDate);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      await onAddAnnotation({
        projectId: formProjectId || 'general',
        date: selectedDate,
        title: formTitle.trim(),
        details: formDetails.trim(),
      });
      setFormTitle('');
      setFormDetails('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onImportProjectControlerFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Calendrier chantier
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Annotez vos réunions et mémos par couleur de chantier. Les intempéries et JC proviennent uniquement de Project-Controler.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Sync Project-Controler (.JSON)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <a
            href={projectControlerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap"
          >
            <span>Encoder intempérie / JC dans Project-Controler</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium text-slate-500">
          Couleurs par chantier (cliquer pour changer) :
        </span>
        {projects.map((proj) => (
          <div key={proj.id} className="relative">
            <button
              type="button"
              onClick={() =>
                setEditingColorFor((curr) =>
                  curr === proj.id ? null : proj.id
                )
              }
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 transition-colors"
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: proj.color }}
                aria-hidden="true"
              />
              <span>
                {proj.code} · {proj.commune}
              </span>
            </button>

            {editingColorFor === proj.id && (
              <div className="absolute left-0 top-full mt-1.5 z-20 bg-white border border-slate-200 rounded-lg p-2 shadow-sm flex items-center gap-1.5">
                {PROJECT_COLOR_PALETTE.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.label}
                    aria-label={`Choisir ${swatch.label} pour ${proj.commune}`}
                    onClick={async () => {
                      await onChangeProjectColor(proj.id, swatch.hex);
                      setEditingColorFor(null);
                    }}
                    className={`w-6 h-6 rounded border ${
                      proj.color === swatch.hex
                        ? 'border-slate-900 scale-110'
                        : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={goPrevMonth}
                aria-label="Mois précédent"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Aujourd’hui
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                aria-label="Mois suivant"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2.5 text-center text-xs font-medium text-slate-500"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {calendarCells.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} className="min-h-24 bg-slate-50/40" />;
              }

              const dayNum = Number(dateStr.slice(8, 10));
              const dayEntries = entries.filter((e) => e.date === dateStr);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-24 p-2 text-left flex flex-col gap-1 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`text-xs font-mono tabular-nums w-6 h-6 flex items-center justify-center rounded ${
                      isToday
                        ? 'bg-blue-700 text-white font-semibold'
                        : isSelected
                        ? 'text-blue-800 font-bold'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  <div className="space-y-1 w-full">
                    {dayEntries.slice(0, 3).map((ev) => {
                      const proj = getProject(ev.projectId);
                      const color = proj?.color ?? '#475569';
                      const isSync = ev.source === 'project-controler';
                      return (
                        <div
                          key={ev.id}
                          className="flex items-center gap-1.5 text-[11px] leading-tight truncate text-slate-800"
                        >
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          <span className="truncate font-medium">
                            {isSync ? `[${ev.entryType}] ` : ''}
                            {ev.title}
                          </span>
                        </div>
                      );
                    })}
                    {dayEntries.length > 3 && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        +{dayEntries.length - 3} autre(s)
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Journée du <span className="font-mono">{selectedDate}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDayEntries.length} élément(s) enregistré(s)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {selectedDayEntries.map((ev) => {
                const proj = getProject(ev.projectId);
                const isFromPc = ev.source === 'project-controler';
                return (
                  <div
                    key={ev.id}
                    className="border border-slate-200 rounded-lg p-3 space-y-1.5 bg-slate-50/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: proj?.color ?? '#475569' }}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {ev.title}
                        </span>
                      </div>
                      {!isFromPc && (
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(ev.id)}
                          aria-label={`Supprimer ${ev.title}`}
                          className="text-slate-400 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {ev.details && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {ev.details}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{proj ? `${proj.code} · ${proj.commune}` : 'Général'}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isFromPc
                            ? 'text-blue-700 font-medium inline-flex items-center gap-1'
                            : 'text-slate-600'
                        }
                      >
                        {isFromPc && <CloudRain className="w-3 h-3" />}
                        {isFromPc
                          ? `${ev.entryType} (Sync Project-Controler · Lecture seule)`
                          : 'Annotation B.O.C'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {selectedDayEntries.length === 0 && (
                <p className="text-xs text-slate-500 py-2">
                  Aucune annotation ou intempérie ce jour.
                </p>
              )}
            </div>
          </div>

          <form
            onSubmit={handleAddSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Ajouter une annotation B.O.C
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Réservez cet espace aux mémos, visites et rendez-vous. Les intempéries et JC restent saisis uniquement dans Project-Controler pour éviter tout oubli.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chantier
              </label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="general">Général</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.commune}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Titre / Objet
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex. Réunion de chantier 09h00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Précisions (optionnel)
              </label>
              <textarea
                rows={2}
                value={formDetails}
                onChange={(e) => setFormDetails(e.target.value)}
                placeholder="Participants, points à contrôler..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter au {selectedDate}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
