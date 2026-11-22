import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, GanttChartSquare, SlidersHorizontal } from 'lucide-react';
import { PROJECT_COLOR_PALETTE } from '../data/initialData';
import { Project } from '../types';

interface PlanningViewProps {
  projects: Project[];
  onUpdateProjectDates: (
    projectId: string,
    startDate: string,
    estimatedEndDate: string
  ) => Promise<void>;
  onChangeProjectColor?: (projectId: string, color: string) => Promise<void>;
}

type HorizonMode = '60d' | '6m' | '9m' | '12m';

const MONTH_SHORT = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const DAY_MS = 1000 * 60 * 60 * 24;

const parseLocalDate = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatFrShort = (str: string): string => {
  const d = parseLocalDate(str);
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1
  ).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

const addDaysIso = (startStr: string, days: number): string => {
  const d = parseLocalDate(startStr);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};

const diffCalendarDays = (startStr: string, endStr: string): number => {
  const s = parseLocalDate(startStr);
  const e = parseLocalDate(endStr);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / DAY_MS));
};

export const PlanningView: React.FC<PlanningViewProps> = ({
  projects,
  onUpdateProjectDates,
  onChangeProjectColor,
}) => {
  const [horizon, setHorizon] = useState<HorizonMode>('6m');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const paramsSectionRef = useRef<HTMLElement | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toIsoDate(today);

  const { timelineStart, timelineEnd, months, dayColumns } = useMemo(() => {
    if (horizon === '60d') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 59);

      const cols: {
        iso: string;
        dayNum: number;
        weekday: string;
        isWeekend: boolean;
        isToday: boolean;
        monthLabel?: string;
      }[] = [];

      const monthGroups: { key: string; label: string; span: number }[] = [];

      for (let i = 0; i < 60; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const iso = toIsoDate(d);
        const dow = d.getDay();
        const mKey = `${d.getFullYear()}-${d.getMonth()}`;
        const mLabel = `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;

        const lastGroup = monthGroups[monthGroups.length - 1];
        if (!lastGroup || lastGroup.key !== mKey) {
          monthGroups.push({ key: mKey, label: mLabel, span: 1 });
        } else {
          lastGroup.span += 1;
        }

        cols.push({
          iso,
          dayNum: d.getDate(),
          weekday: WEEKDAY_INITIALS[dow],
          isWeekend: dow === 0 || dow === 6,
          isToday: iso === todayStr,
        });
      }

      return {
        timelineStart: start,
        timelineEnd: end,
        months: monthGroups,
        dayColumns: cols,
      };
    }

    const horizonMonths = horizon === '6m' ? 6 : horizon === '9m' ? 9 : 12;
    const validStarts = projects
      .map((p) => (p.startDate ? parseLocalDate(p.startDate) : null))
      .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

    const earliest =
      validStarts.length > 0
        ? new Date(Math.min(...validStarts.map((d) => d.getTime())))
        : new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + horizonMonths, 0);

    const monthGroups: { key: string; label: string; span: number; daysInMonth: number }[] = [];
    for (let i = 0; i < horizonMonths; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      monthGroups.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        span: 1,
        daysInMonth,
      });
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      months: monthGroups,
      dayColumns: [] as {
        iso: string;
        dayNum: number;
        weekday: string;
        isWeekend: boolean;
        isToday: boolean;
      }[],
    };
  }, [projects, horizon, todayStr]);

  const totalSpanMs = Math.max(
    DAY_MS,
    timelineEnd.getTime() - timelineStart.getTime() + DAY_MS
  );

  const getPctPosition = (dateStr: string, inclusiveEnd = false) => {
    const d = parseLocalDate(dateStr);
    if (Number.isNaN(d.getTime())) return 0;
    const offset = d.getTime() - timelineStart.getTime() + (inclusiveEnd ? DAY_MS : 0);
    const raw = (offset / totalSpanMs) * 100;
    return Math.max(0, Math.min(100, raw));
  };

  const todayPct = getPctPosition(todayStr, false);

  const getDaysRemaining = (endStr: string) => {
    const end = parseLocalDate(endStr);
    if (Number.isNaN(end.getTime())) return 0;
    return Math.ceil((end.getTime() - today.getTime()) / DAY_MS);
  };

  const handleSelectFromGantt = (projectId: string) => {
    setSelectedProjectId(projectId);
    paramsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Planning estimé · Chantiers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Vue Gantt simplifiée de tous vos chantiers en jours calendrier, avec paramétrage des dates ci-dessous.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit shrink-0 overflow-x-auto max-w-full">
          {(
            [
              { id: '60d', label: '60 jours (Jours)' },
              { id: '6m', label: '6 mois' },
              { id: '9m', label: '9 mois' },
              { id: '12m', label: '12 mois' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setHorizon(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                horizon === opt.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION HAUT : BARRES GANTT SIMPLES + JOURS CALENDRIER */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className={horizon === '60d' ? 'min-w-[1280px]' : 'min-w-[880px]'}>
            {/* En-tête Mois */}
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <div className="col-span-4 lg:col-span-3 px-4 py-2.5 border-r border-slate-200 flex items-center justify-between">
                <span>Chantier</span>
                <span className="text-[11px] font-medium text-slate-500">
                  Jours cal.
                </span>
              </div>

              {horizon === '60d' ? (
                <div
                  className="col-span-8 lg:col-span-9 grid divide-x divide-slate-200"
                  style={{
                    gridTemplateColumns: 'repeat(60, minmax(0, 1fr))',
                  }}
                >
                  {months.map((m) => (
                    <div
                      key={m.key}
                      style={{ gridColumn: `span ${m.span} / span ${m.span}` }}
                      className="py-2 px-2 text-left font-mono text-[11px] text-slate-700 truncate"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="col-span-8 lg:col-span-9 grid divide-x divide-slate-200"
                  style={{
                    gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                  }}
                >
                  {months.map((m) => (
                    <div
                      key={m.key}
                      className="py-2 text-center font-mono text-[11px] text-slate-700"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sous-en-tête Jours calendrier */}
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50/70 text-[10px] font-mono text-slate-500">
              <div className="col-span-4 lg:col-span-3 px-4 py-1.5 border-r border-slate-200 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <span>Échelle en jours calendrier</span>
              </div>

              {horizon === '60d' ? (
                <div
                  className="col-span-8 lg:col-span-9 grid divide-x divide-slate-100"
                  style={{
                    gridTemplateColumns: 'repeat(60, minmax(0, 1fr))',
                  }}
                >
                  {dayColumns.map((col) => (
                    <div
                      key={col.iso}
                      className={`py-1 text-center leading-tight ${
                        col.isToday
                          ? 'bg-red-600 text-white font-bold'
                          : col.isWeekend
                          ? 'bg-slate-100 text-slate-400'
                          : 'text-slate-600'
                      }`}
                      title={col.iso}
                    >
                      <div>{col.weekday}</div>
                      <div>{col.dayNum}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="col-span-8 lg:col-span-9 grid divide-x divide-slate-200"
                  style={{
                    gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                  }}
                >
                  {months.map((m) => (
                    <div
                      key={`days-${m.key}`}
                      className="py-1 px-1.5 flex items-center justify-between text-[10px] text-slate-400"
                    >
                      <span>1</span>
                      <span>10</span>
                      <span>20</span>
                      <span>{ 'daysInMonth' in m ? m.daysInMonth : 30 }</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lignes Chantiers */}
            <div className="divide-y divide-slate-100">
              {projects.map((p) => {
                const startStr = p.startDate || '2026-09-01';
                const endStr = p.estimatedEndDate || '2027-02-28';
                const leftPct = getPctPosition(startStr, false);
                const rightPct = getPctPosition(endStr, true);
                const isOutsideWindow = rightPct <= 0 || leftPct >= 100;
                const widthPct = Math.max(2.5, rightPct - leftPct);

                const totalCalDays = diffCalendarDays(startStr, endStr);
                const daysToEnd = getDaysRemaining(endStr);
                const isSelected = selectedProjectId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectFromGantt(p.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectFromGantt(p.id);
                      }
                    }}
                    className={`grid grid-cols-12 items-center cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="col-span-4 lg:col-span-3 px-4 py-3 border-r border-slate-200 flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-sm mt-1 shrink-0"
                          style={{ backgroundColor: p.color }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            <span className="font-mono">{p.code}</span> · {p.commune}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                        {totalCalDays} j
                      </span>
                    </div>

                    <div className="col-span-8 lg:col-span-9 relative h-14 flex items-center">
                      {horizon === '60d' ? (
                        <div
                          className="absolute inset-0 grid divide-x divide-slate-100 pointer-events-none"
                          style={{
                            gridTemplateColumns: 'repeat(60, minmax(0, 1fr))',
                          }}
                        >
                          {dayColumns.map((col) => (
                            <div
                              key={`bg-${p.id}-${col.iso}`}
                              className={col.isWeekend ? 'bg-slate-50/90' : ''}
                            />
                          ))}
                        </div>
                      ) : (
                        <div
                          className="absolute inset-0 grid divide-x divide-slate-100 pointer-events-none"
                          style={{
                            gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {months.map((m) => (
                            <div key={`bg-${p.id}-${m.key}`} />
                          ))}
                        </div>
                      )}

                      {todayPct > 0 && todayPct < 100 && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-500/80 z-10 pointer-events-none"
                          style={{ left: `${todayPct}%` }}
                          title={`Aujourd'hui (${todayStr})`}
                        />
                      )}

                      {!isOutsideWindow ? (
                        <div
                          className="relative h-7 rounded-md z-20 flex items-center px-2.5 shadow-xs overflow-hidden text-white"
                          style={{
                            marginLeft: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: p.color,
                          }}
                          title={`${p.name} : ${formatFrShort(startStr)} → ${formatFrShort(endStr)} (${totalCalDays} j calendrier)`}
                        >
                          <span className="text-[11px] font-mono font-semibold truncate drop-shadow-xs">
                            {p.commune} · {totalCalDays} j cal. (
                            {daysToEnd >= 0
                              ? `J-${daysToEnd}`
                              : `Dépassé ${Math.abs(daysToEnd)} j`}
                            )
                          </span>
                        </div>
                      ) : (
                        <div className="px-3 text-[11px] font-mono text-slate-400 italic z-20">
                          Hors fenêtre ({formatFrShort(startStr)} → {formatFrShort(endStr)} · {totalCalDays} j)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {projects.length === 0 && (
                <div className="p-10 text-center space-y-2 text-slate-500">
                  <GanttChartSquare className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm">
                    Ajoutez un chantier depuis l’Accueil pour afficher son planning Gantt.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION BAS : RENTRÉE DE PARAMÈTRES */}
      <section
        ref={paramsSectionRef}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Paramètres du planning · Dates & jours calendrier
              </h2>
              <p className="text-xs text-slate-500">
                Ajustez la date de début, le nombre de jours calendrier ou la fin estimée : la barre Gantt se met à jour instantanément.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {projects.map((p) => {
            const startStr = p.startDate || '2026-09-01';
            const endStr = p.estimatedEndDate || '2027-02-28';
            const totalCalDays = diffCalendarDays(startStr, endStr);
            const daysToEnd = getDaysRemaining(endStr);
            const isSelected = selectedProjectId === p.id;

            return (
              <div
                key={`param-${p.id}`}
                className={`p-4 sm:px-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center transition-colors ${
                  isSelected ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="lg:col-span-4 flex items-start gap-3 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-sm mt-1 shrink-0"
                    style={{ backgroundColor: p.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-mono">{p.code}</span> · {p.commune}
                    </div>
                    {onChangeProjectColor && (
                      <div className="flex items-center gap-1 pt-0.5">
                        {PROJECT_COLOR_PALETTE.map((sw) => (
                          <button
                            key={`${p.id}-${sw.hex}`}
                            type="button"
                            onClick={() => onChangeProjectColor(p.id, sw.hex)}
                            title={`Couleur ${sw.label}`}
                            aria-label={`Couleur ${sw.label} pour ${p.code}`}
                            className={`w-4 h-4 rounded-xs border transition-transform ${
                              p.color.toLowerCase() === sw.hex.toLowerCase()
                                ? 'border-slate-900 scale-110'
                                : 'border-slate-200'
                            }`}
                            style={{ backgroundColor: sw.hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">
                      Date de début
                    </span>
                    <input
                      type="date"
                      value={startStr}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        if (!nextStart) return;
                        const nextEnd =
                          nextStart > endStr
                            ? addDaysIso(nextStart, totalCalDays)
                            : endStr;
                        onUpdateProjectDates(p.id, nextStart, nextEnd);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">
                      Jours calendrier
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={totalCalDays}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        const nextEnd = addDaysIso(startStr, val);
                        onUpdateProjectDates(p.id, startStr, nextEnd);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">
                      Fin estimée
                    </span>
                    <input
                      type="date"
                      value={endStr}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        if (!nextEnd) return;
                        onUpdateProjectDates(p.id, startStr, nextEnd);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>

                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
                    <div className="text-slate-500">Échéance</div>
                    <div
                      className={`font-mono tabular-nums font-semibold mt-0.5 ${
                        daysToEnd < 0
                          ? 'text-red-700'
                          : daysToEnd <= 15
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {daysToEnd >= 0
                        ? `Dans ${daysToEnd} j cal.`
                        : `Dépassé de ${Math.abs(daysToEnd)} j`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {projects.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              Aucun chantier à paramétrer pour le moment.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
