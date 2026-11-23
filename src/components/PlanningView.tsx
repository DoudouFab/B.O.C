import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  GanttChartSquare,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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

type ZoomLevel =
  | 'jours'
  | 'semaines'
  | 'quinzaine'
  | 'mois'
  | 'trimestre'
  | 'annees';

const ZOOM_LEVELS: { id: ZoomLevel; label: string; colWidthPx: number }[] = [
  { id: 'jours', label: 'Jours', colWidthPx: 36 },
  { id: 'semaines', label: 'Semaines', colWidthPx: 70 },
  { id: 'quinzaine', label: 'Quinzaine', colWidthPx: 82 },
  { id: 'mois', label: 'Mois', colWidthPx: 108 },
  { id: 'trimestre', label: 'Trimestre', colWidthPx: 148 },
  { id: 'annees', label: 'Années', colWidthPx: 220 },
];

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

const signedDiffDays = (fromStr: string, toStr: string): number => {
  const a = parseLocalDate(fromStr);
  const b = parseLocalDate(toStr);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
};

const getIsoWeekNumber = (d: Date): number => {
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
};

interface TopGroup {
  key: string;
  label: string;
  span: number;
}

interface SubColumn {
  key: string;
  topLabel: string;
  bottomLabel?: string;
  isWeekend?: boolean;
  isToday?: boolean;
  title: string;
}

export const PlanningView: React.FC<PlanningViewProps> = ({
  projects,
  onUpdateProjectDates,
  onChangeProjectColor,
}) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('mois');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const paramsSectionRef = useRef<HTMLElement | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = toIsoDate(today);

  const getProjectDeadlineStr = (p: Project): string => {
    if (p.contractualEndDate && /^\d{4}-\d{2}-\d{2}$/.test(p.contractualEndDate)) {
      return p.contractualEndDate;
    }
    if (p.delaiRestantJours > 0) {
      return addDaysIso(todayStr, p.delaiRestantJours);
    }
    return p.estimatedEndDate || addDaysIso(todayStr, 60);
  };

  const maxProjectedEndDate = useMemo(() => {
    const minFallback = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);
    let maxMs = minFallback.getTime();
    for (const p of projects) {
      const dl = parseLocalDate(getProjectDeadlineStr(p));
      const est = parseLocalDate(p.estimatedEndDate || getProjectDeadlineStr(p));
      if (!Number.isNaN(dl.getTime()) && dl.getTime() > maxMs) {
        maxMs = dl.getTime();
      }
      if (!Number.isNaN(est.getTime()) && est.getTime() > maxMs) {
        maxMs = est.getTime();
      }
    }
    return new Date(maxMs);
  }, [projects, today]);

  const { timelineStart, timelineEnd, topGroups, subColumns, colWidthPx } = useMemo(() => {
    const cfg = ZOOM_LEVELS.find((z) => z.id === zoomLevel) ?? ZOOM_LEVELS[3];
    const groups: TopGroup[] = [];
    const cols: SubColumn[] = [];

    const pushGroup = (key: string, label: string) => {
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        groups.push({ key, label, span: 1 });
      } else {
        last.span += 1;
      }
    };

    if (zoomLevel === 'jours') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endTarget = new Date(
        Math.max(
          maxProjectedEndDate.getTime(),
          start.getTime() + 29 * DAY_MS
        )
      );
      const totalDays = Math.max(30, Math.ceil((endTarget.getTime() - start.getTime()) / DAY_MS) + 1);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + totalDays - 1);

      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const iso = toIsoDate(d);
        const dow = d.getDay();
        pushGroup(
          `${d.getFullYear()}-${d.getMonth()}`,
          `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
        );
        cols.push({
          key: iso,
          topLabel: WEEKDAY_INITIALS[dow],
          bottomLabel: String(d.getDate()),
          isWeekend: dow === 0 || dow === 6,
          isToday: iso === todayStr,
          title: iso,
        });
      }
      return {
        timelineStart: start,
        timelineEnd: end,
        topGroups: groups,
        subColumns: cols,
        colWidthPx: cfg.colWidthPx,
      };
    }

    if (zoomLevel === 'semaines') {
      const dow = (today.getDay() + 6) % 7;
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
      const minEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 12 * 7 - 1);
      const targetEndMs = Math.max(maxProjectedEndDate.getTime(), minEnd.getTime());

      let cursor = new Date(start);
      let end = new Date(start);
      while (cursor.getTime() <= targetEndMs) {
        const wkNum = getIsoWeekNumber(cursor);
        const wkEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
        const containsToday =
          today.getTime() >= cursor.getTime() && today.getTime() <= wkEnd.getTime();
        pushGroup(
          `${cursor.getFullYear()}-${cursor.getMonth()}`,
          `${MONTH_SHORT[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`
        );
        cols.push({
          key: `w-${toIsoDate(cursor)}`,
          topLabel: `S${wkNum}`,
          bottomLabel: `${String(cursor.getDate()).padStart(2, '0')}/${String(
            cursor.getMonth() + 1
          ).padStart(2, '0')}`,
          isToday: containsToday,
          title: `Semaine ${wkNum} (${toIsoDate(cursor)} → ${toIsoDate(wkEnd)})`,
        });
        end = wkEnd;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      }

      return {
        timelineStart: start,
        timelineEnd: end,
        topGroups: groups,
        subColumns: cols,
        colWidthPx: cfg.colWidthPx,
      };
    }

    if (zoomLevel === 'quinzaine') {
      const startHalf = today.getDate() <= 15 ? 1 : 16;
      const start = new Date(today.getFullYear(), today.getMonth(), startHalf);
      const minEnd = new Date(today.getFullYear(), today.getMonth() + 6, 0);
      const targetEndMs = Math.max(maxProjectedEndDate.getTime(), minEnd.getTime());

      let y = start.getFullYear();
      let m = start.getMonth();
      let half: 1 | 2 = startHalf === 1 ? 1 : 2;
      let end = new Date(start);

      while (true) {
        const qStart = new Date(y, m, half === 1 ? 1 : 16);
        const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
        const qEnd = new Date(y, m, half === 1 ? 15 : lastDayOfMonth);
        const containsToday =
          today.getTime() >= qStart.getTime() && today.getTime() <= qEnd.getTime();

        pushGroup(
          `${y}-${m}`,
          `${MONTH_SHORT[m]} ${String(y).slice(2)}`
        );
        cols.push({
          key: `q-${y}-${m}-${half}`,
          topLabel: half === 1 ? 'Q1' : 'Q2',
          bottomLabel: half === 1 ? '1-15' : `16-${lastDayOfMonth}`,
          isToday: containsToday,
          title: `${MONTH_SHORT[m]} ${y} · ${half === 1 ? '1 au 15' : `16 au ${lastDayOfMonth}`}`,
        });
        end = qEnd;
        if (qEnd.getTime() >= targetEndMs) break;

        if (half === 1) {
          half = 2;
        } else {
          half = 1;
          m += 1;
          if (m > 11) {
            m = 0;
            y += 1;
          }
        }
      }

      return {
        timelineStart: start,
        timelineEnd: end,
        topGroups: groups,
        subColumns: cols,
        colWidthPx: cfg.colWidthPx,
      };
    }

    if (zoomLevel === 'mois') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const minEnd = new Date(today.getFullYear(), today.getMonth() + 6, 0);
      const targetEndMs = Math.max(maxProjectedEndDate.getTime(), minEnd.getTime());

      let y = start.getFullYear();
      let m = start.getMonth();
      let end = new Date(start);

      while (true) {
        const mStart = new Date(y, m, 1);
        const daysInM = new Date(y, m + 1, 0).getDate();
        const mEnd = new Date(y, m, daysInM);
        const containsToday =
          today.getFullYear() === y && today.getMonth() === m;

        pushGroup(`${y}`, String(y));
        cols.push({
          key: `m-${y}-${m}`,
          topLabel: `${MONTH_SHORT[m]} ${String(y).slice(2)}`,
          bottomLabel: `${daysInM} j`,
          isToday: containsToday,
          title: `${MONTH_SHORT[m]} ${y}`,
        });
        end = mEnd;
        if (mEnd.getTime() >= targetEndMs && cols.length >= 6) break;

        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
      }

      return {
        timelineStart: start,
        timelineEnd: end,
        topGroups: groups,
        subColumns: cols,
        colWidthPx: cfg.colWidthPx,
      };
    }

    if (zoomLevel === 'trimestre') {
      const startQ = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), startQ * 3, 1);
      const minEnd = new Date(today.getFullYear(), startQ * 3 + 12, 0);
      const targetEndMs = Math.max(maxProjectedEndDate.getTime(), minEnd.getTime());

      let y = start.getFullYear();
      let q = startQ;
      let end = new Date(start);

      while (true) {
        const qStart = new Date(y, q * 3, 1);
        const qEnd = new Date(y, q * 3 + 3, 0);
        const containsToday =
          today.getTime() >= qStart.getTime() && today.getTime() <= qEnd.getTime();
        const mLabel = `${MONTH_SHORT[q * 3]}–${MONTH_SHORT[q * 3 + 2]}`;

        pushGroup(`${y}`, String(y));
        cols.push({
          key: `t-${y}-${q}`,
          topLabel: `T${q + 1} ${String(y).slice(2)}`,
          bottomLabel: mLabel,
          isToday: containsToday,
          title: `Trimestre ${q + 1} ${y} (${mLabel})`,
        });
        end = qEnd;
        if (qEnd.getTime() >= targetEndMs && cols.length >= 4) break;

        q += 1;
        if (q > 3) {
          q = 0;
          y += 1;
        }
      }

      return {
        timelineStart: start,
        timelineEnd: end,
        topGroups: groups,
        subColumns: cols,
        colWidthPx: cfg.colWidthPx,
      };
    }

    // 'annees'
    const startYear = today.getFullYear();
    const endYear = Math.max(startYear + 2, maxProjectedEndDate.getFullYear());
    const start = new Date(startYear, 0, 1);
    const end = new Date(endYear, 11, 31);

    pushGroup('horizon', `Projection ${startYear} – ${endYear}`);
    for (let y = startYear; y <= endYear; y++) {
      cols.push({
        key: `y-${y}`,
        topLabel: String(y),
        bottomLabel: 'T1 · T2 · T3 · T4',
        isToday: y === today.getFullYear(),
        title: `Année ${y}`,
      });
    }

    return {
      timelineStart: start,
      timelineEnd: end,
      topGroups: groups,
      subColumns: cols,
      colWidthPx: cfg.colWidthPx,
    };
  }, [zoomLevel, today, todayStr, maxProjectedEndDate]);

  const timelineTrackWidthPx = Math.max(760, subColumns.length * colWidthPx);

  const totalSpanMs = Math.max(
    DAY_MS,
    timelineEnd.getTime() - timelineStart.getTime() + DAY_MS
  );

  const getRawPct = (dateStr: string, inclusiveEnd = false) => {
    const d = parseLocalDate(dateStr);
    if (Number.isNaN(d.getTime())) return 0;
    const offset =
      d.getTime() - timelineStart.getTime() + (inclusiveEnd ? DAY_MS : 0);
    return (offset / totalSpanMs) * 100;
  };

  const todayPct = Math.max(0, Math.min(100, getRawPct(todayStr, false)));

  const zoomIdx = ZOOM_LEVELS.findIndex((z) => z.id === zoomLevel);
  const canZoomIn = zoomIdx > 0;
  const canZoomOut = zoomIdx < ZOOM_LEVELS.length - 1;

  const handleSelectFromGantt = (projectId: string) => {
    setSelectedProjectId(projectId);
    paramsSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Planning Gantt · Délai Project-Controler & Fin estimée
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            De aujourd’hui jusqu’au {formatFrShort(toIsoDate(maxProjectedEndDate))} · Zoomable du jour à l’année, avec écart entre fin de délai (JC) et estimation contrôleur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200/90 shadow-xs rounded-xl">
            <button
              type="button"
              disabled={!canZoomOut}
              onClick={() => canZoomOut && setZoomLevel(ZOOM_LEVELS[zoomIdx + 1].id)}
              title="Dézoomer (moins de détails)"
              aria-label="Dézoomer"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-0.5 overflow-x-auto max-w-[68vw] sm:max-w-none">
              {ZOOM_LEVELS.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setZoomLevel(z.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    zoomLevel === z.id
                      ? 'bg-gradient-to-r from-blue-700 to-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!canZoomIn}
              onClick={() => canZoomIn && setZoomLevel(ZOOM_LEVELS[zoomIdx - 1].id)}
              title="Zoomer (plus de détails)"
              aria-label="Zoomer"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Légende concise */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 px-1">
        <span className="inline-flex items-center gap-2">
          <span className="w-6 h-3 rounded-sm bg-blue-700 inline-block relative overflow-hidden">
            <span className="absolute inset-y-0 left-0 w-1/2 bg-blue-950/35" />
          </span>
          <span>Barre progressive (délai PC selon JC)</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-6 h-3 rounded-sm bg-blue-700/35 border border-blue-700/50 inline-block" />
          <span>Prolongation (fin estimée plus longue)</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-6 h-3 rounded-sm border border-blue-700/70 inline-block"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, rgba(29,78,216,0.45) 0px, rgba(29,78,216,0.45) 3px, rgba(29,78,216,0.12) 3px, rgba(29,78,216,0.12) 6px)',
            }}
          />
          <span>Hachuré (fin estimée plus courte que délai)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 border-y border-r border-dashed border-slate-500 inline-flex items-center justify-end pr-0.5 text-[9px] text-slate-600">
            →
          </span>
          <span>Pointillés : se poursuit hors fenêtre</span>
        </span>
      </div>

      {/* SECTION HAUT : GANTT ZOOMABLE */}
      <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <div className="w-fit min-w-full">
            {/* En-tête Groupe (Mois / Années) */}
            <div className="flex border-b border-blue-950/20 bg-gradient-to-r from-[#0B1F4D] to-[#122D6E] text-xs font-semibold text-white">
              <div className="sticky left-0 z-30 w-[240px] sm:w-[320px] shrink-0 px-4 py-2.5 border-r border-white/15 bg-[#0B1F4D] flex items-center justify-between">
                <span>Chantier & Dates</span>
                <span className="text-[11px] font-medium text-sky-200/90">
                  JC restants
                </span>
              </div>

              <div
                className="grid divide-x divide-white/15 shrink-0"
                style={{
                  width: `${timelineTrackWidthPx}px`,
                  gridTemplateColumns: `repeat(${subColumns.length}, minmax(0, 1fr))`,
                }}
              >
                {topGroups.map((g) => (
                  <div
                    key={g.key}
                    style={{ gridColumn: `span ${g.span} / span ${g.span}` }}
                    className="py-2.5 px-2 text-left font-mono text-[11px] text-sky-100 truncate"
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Sous-en-tête Granularité */}
            <div className="flex border-b border-slate-200 bg-slate-50/90 text-[10px] font-mono text-slate-500">
              <div className="sticky left-0 z-30 w-[240px] sm:w-[320px] shrink-0 px-4 py-1.5 border-r border-slate-200 bg-slate-50 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  Échelle : {ZOOM_LEVELS[zoomIdx]?.label}
                </span>
              </div>

              <div
                className="grid divide-x divide-slate-200/70 shrink-0"
                style={{
                  width: `${timelineTrackWidthPx}px`,
                  gridTemplateColumns: `repeat(${subColumns.length}, minmax(0, 1fr))`,
                }}
              >
                {subColumns.map((col) => (
                  <div
                    key={col.key}
                    title={col.title}
                    className={`py-1 px-0.5 text-center leading-tight truncate ${
                      col.isToday
                        ? 'bg-red-600 text-white font-bold'
                        : col.isWeekend
                        ? 'bg-slate-100 text-slate-400'
                        : 'text-slate-600'
                    }`}
                  >
                    <div className="truncate">{col.topLabel}</div>
                    {col.bottomLabel && (
                      <div className="text-[9px] opacity-85 truncate">
                        {col.bottomLabel}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Lignes Chantiers */}
            <div className="divide-y divide-slate-100">
              {projects.map((p) => {
                const startStr = p.startDate || '2026-09-01';
                const deadlineStr = getProjectDeadlineStr(p);
                const estimatedStr = p.estimatedEndDate || deadlineStr;

                const deltaDays = signedDiffDays(deadlineStr, estimatedStr); // >0 => plus long, <0 => plus court
                const mainEndStr = deltaDays < 0 ? estimatedStr : deadlineStr;
                const outerEndStr = deltaDays > 0 ? estimatedStr : deadlineStr;

                const rawStart = getRawPct(startStr, false);
                const rawMainEnd = getRawPct(mainEndStr, true);
                const rawOuterEnd = getRawPct(outerEndStr, true);

                const completelyBefore = rawOuterEnd <= 0;
                const completelyAfter = rawStart >= 100;

                const cutsLeft = rawStart < 0 && rawOuterEnd > 0;
                const cutsRight = rawOuterEnd > 100 && rawStart < 100;

                const visMainLeft = Math.max(0, Math.min(100, rawStart));
                const visMainRight = Math.max(0, Math.min(100, rawMainEnd));
                const mainWidth = Math.max(0, visMainRight - visMainLeft);

                const visExtLeft = Math.max(0, Math.min(100, rawMainEnd));
                const visExtRight = Math.max(0, Math.min(100, rawOuterEnd));
                const extWidth = Math.max(0, visExtRight - visExtLeft);

                const totalWrapLeft = Math.max(0, Math.min(100, rawStart));
                const totalWrapRight = Math.max(0, Math.min(100, rawOuterEnd));
                const totalWrapWidth = Math.max(
                  cutsLeft || cutsRight ? 2 : 1.5,
                  totalWrapRight - totalWrapLeft
                );

                // Progression temporelle / financière sur la barre principale
                const totalProjectDays = diffCalendarDays(startStr, mainEndStr);
                const elapsedDays = Math.max(
                  0,
                  Math.min(totalProjectDays, signedDiffDays(startStr, todayStr))
                );
                const timeProgressPct = Math.round(
                  (elapsedDays / totalProjectDays) * 100
                );
                const finProgressPct =
                  p.marcheTotalReviseEur > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((p.cumulEaValidesEur + p.eaEnCoursEur) /
                            p.marcheTotalReviseEur) *
                            100
                        )
                      )
                    : 0;
                const progressPct = Math.max(timeProgressPct, finProgressPct);

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
                    className={`flex items-stretch cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/55' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Colonne Chantier sticky à gauche avec ligne supplémentaire de dates */}
                    <div
                      className={`sticky left-0 z-20 w-[240px] sm:w-[320px] shrink-0 px-4 py-3 border-r border-slate-200 flex items-center justify-between gap-2 min-w-0 ${
                        isSelected ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-sm mt-1 shrink-0"
                          style={{ backgroundColor: p.color }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            <span className="font-mono">{p.code}</span> · {p.commune}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-600 truncate">
                            <span>Délai PC : {formatFrShort(deadlineStr)}</span>
                            <span aria-hidden="true"> · </span>
                            <span
                              className={
                                deltaDays > 0
                                  ? 'text-amber-700 font-semibold'
                                  : deltaDays < 0
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-slate-700 font-medium'
                              }
                            >
                              Estim. : {formatFrShort(estimatedStr)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                        {p.delaiRestantJours} JC
                      </span>
                    </div>

                    {/* Piste Timeline */}
                    <div
                      className="relative min-h-[68px] flex items-center shrink-0 overflow-hidden"
                      style={{ width: `${timelineTrackWidthPx}px` }}
                    >
                      {/* Grille arrière-plan */}
                      <div
                        className="absolute inset-0 grid divide-x divide-slate-100 pointer-events-none"
                        style={{
                          gridTemplateColumns: `repeat(${subColumns.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {subColumns.map((col) => (
                          <div
                            key={`bg-${p.id}-${col.key}`}
                            className={col.isWeekend ? 'bg-slate-50/90' : ''}
                          />
                        ))}
                      </div>

                      {/* Ligne Aujourd'hui */}
                      {todayPct >= 0 && todayPct <= 100 && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-500/80 z-10 pointer-events-none"
                          style={{ left: `${todayPct}%` }}
                          title={`Aujourd'hui (${todayStr})`}
                        />
                      )}

                      {/* Barre composite */}
                      {!completelyBefore && !completelyAfter ? (
                        <div
                          className="absolute inset-y-0 flex items-center z-20"
                          style={{
                            left: `${totalWrapLeft}%`,
                            width: `${totalWrapWidth}%`,
                          }}
                          title={`${p.name} | Début : ${formatFrShort(
                            startStr
                          )} | Fin délai PC : ${formatFrShort(
                            deadlineStr
                          )} (${p.delaiRestantJours} JC) | Fin estimée : ${formatFrShort(
                            estimatedStr
                          )}`}
                        >
                          <div className="relative w-full h-8 flex items-center">
                            {/* Partie principale progressive */}
                            {mainWidth > 0 && (
                              <div
                                className={`relative h-full overflow-hidden flex items-center text-white shadow-xs ${
                                  cutsLeft
                                    ? 'rounded-l-none border-l-2 border-dashed border-white/95'
                                    : 'rounded-l-md'
                                } ${
                                  extWidth > 0
                                    ? 'rounded-r-none'
                                    : cutsRight
                                    ? 'rounded-r-none border-r-2 border-dashed border-white/95'
                                    : 'rounded-r-md'
                                }`}
                                style={{
                                  width: `${(mainWidth / totalWrapWidth) * 100}%`,
                                  backgroundColor: `${p.color}C8`,
                                }}
                              >
                                {/* Remplissage d'avancement progressif */}
                                <div
                                  className="absolute inset-y-0 left-0 pointer-events-none"
                                  style={{
                                    width: `${progressPct}%`,
                                    backgroundColor: p.color,
                                  }}
                                />
                                {/* Piste fine de progression en bas de barre */}
                                <div className="absolute bottom-0 inset-x-0 h-1 bg-black/15 pointer-events-none">
                                  <div
                                    className="h-full bg-white/85"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>

                                <div className="relative z-10 flex items-center justify-between gap-1.5 w-full px-2">
                                  {cutsLeft && (
                                    <ArrowLeft className="w-3 h-3 shrink-0 opacity-95" />
                                  )}
                                  <span className="text-[11px] font-mono font-semibold truncate drop-shadow-xs">
                                    {p.commune} · {progressPct}% ·{' '}
                                    {p.delaiRestantJours} JC
                                  </span>
                                  {extWidth === 0 && cutsRight && (
                                    <ArrowRight className="w-3 h-3 shrink-0 opacity-95 ml-auto" />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Partie différence : soit plus longue (plus claire), soit plus courte (hachurée) */}
                            {extWidth > 0 && (
                              <div
                                className={`relative h-full overflow-hidden flex items-center justify-between px-1.5 border-y ${
                                  mainWidth === 0 && cutsLeft
                                    ? 'rounded-l-none border-l-2 border-dashed'
                                    : ''
                                } ${
                                  cutsRight
                                    ? 'rounded-r-none border-r-2 border-dashed'
                                    : 'rounded-r-md border-r'
                                }`}
                                style={
                                  deltaDays > 0
                                    ? {
                                        width: `${(extWidth / totalWrapWidth) * 100}%`,
                                        backgroundColor: `${p.color}4A`,
                                        borderColor: `${p.color}88`,
                                        color: '#0F172A',
                                      }
                                    : {
                                        width: `${(extWidth / totalWrapWidth) * 100}%`,
                                        backgroundImage: `repeating-linear-gradient(-45deg, ${p.color}55 0px, ${p.color}55 4px, ${p.color}14 4px, ${p.color}14 8px)`,
                                        borderColor: `${p.color}99`,
                                        color: '#0F172A',
                                      }
                                }
                              >
                                <span className="text-[10px] font-mono font-bold truncate px-0.5 bg-white/65 rounded-xs">
                                  {deltaDays > 0
                                    ? `+${deltaDays} j`
                                    : `${deltaDays} j`}
                                </span>
                                {cutsRight && (
                                  <ArrowRight className="w-3 h-3 shrink-0 text-slate-900 ml-auto" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 text-[11px] font-mono text-slate-400 italic z-20">
                          {completelyBefore
                            ? `Achevé avant aujourd'hui (${formatFrShort(outerEndStr)})`
                            : `Démarre le ${formatFrShort(startStr)}`}
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

      {/* SECTION BAS : PARAMÈTRES CHANTIERS (FIN DÉLAI PC + FIN ESTIMÉE CONTRÔLEUR) */}
      <section
        ref={paramsSectionRef}
        className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r from-sky-50/70 via-blue-50/30 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Paramètres des chantiers · Fin délai (Project-Controler) & Fin estimée
              </h2>
              <p className="text-xs text-slate-500">
                La fin du délai suit automatiquement les JC restants de Project-Controler ; ajustez ci-dessous la date de début ou votre fin estimée de chantier.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {projects.map((p) => {
            const startStr = p.startDate || '2026-09-01';
            const deadlineStr = getProjectDeadlineStr(p);
            const estimatedStr = p.estimatedEndDate || deadlineStr;
            const totalEstimatedDays = diffCalendarDays(startStr, estimatedStr);
            const deltaDays = signedDiffDays(deadlineStr, estimatedStr);
            const daysToEstimated = signedDiffDays(todayStr, estimatedStr);
            const isSelected = selectedProjectId === p.id;

            return (
              <div
                key={`param-${p.id}`}
                className={`p-4 sm:px-5 grid grid-cols-1 xl:grid-cols-12 gap-4 items-center transition-colors ${
                  isSelected ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="xl:col-span-4 flex items-start gap-3 min-w-0">
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

                <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
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
                          nextStart > estimatedStr
                            ? addDaysIso(nextStart, totalEstimatedDays)
                            : estimatedStr;
                        onUpdateProjectDates(p.id, nextStart, nextEnd);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>

                  {/* Case supplémentaire dédiée : Fin délai reprise de Project-Controler */}
                  <div className="rounded-lg bg-sky-50/75 border border-sky-200/90 px-2.5 py-1.5 text-xs">
                    <span className="block font-medium text-sky-900 truncate">
                      Fin délai (PC)
                    </span>
                    <div className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                      {formatFrShort(deadlineStr)}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-sky-800">
                      {p.delaiRestantJours} JC restants
                    </div>
                  </div>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-600">
                      Jours estimés
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={totalEstimatedDays}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        const nextEnd = addDaysIso(startStr, val);
                        onUpdateProjectDates(p.id, startStr, nextEnd);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>

                  <label className="space-y-1 text-xs">
                    <span className="block font-medium text-slate-700">
                      Fin estimée (Contrôleur)
                    </span>
                    <input
                      type="date"
                      value={estimatedStr}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        if (!nextEnd) return;
                        onUpdateProjectDates(p.id, startStr, nextEnd);
                      }}
                      className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-xs font-mono text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>

                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 text-xs">
                    <div className="text-slate-500">Écart / Échéance</div>
                    <div
                      className={`font-mono tabular-nums font-semibold mt-0.5 ${
                        deltaDays > 0
                          ? 'text-amber-700'
                          : deltaDays < 0
                          ? 'text-emerald-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {deltaDays > 0
                        ? `+${deltaDays} j vs délai`
                        : deltaDays < 0
                        ? `${deltaDays} j (avance)`
                        : 'Sur le délai'}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500">
                      {daysToEstimated >= 0
                        ? `Dans ${daysToEstimated} j cal.`
                        : `Dépassé ${Math.abs(daysToEstimated)} j`}
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
