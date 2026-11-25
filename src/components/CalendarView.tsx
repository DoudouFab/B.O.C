import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  Download,
  ExternalLink,
  Mail,
  MapPin,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PROJECT_COLOR_PALETTE } from '../data/initialData';
import { CalendarEntry, CalendarViewMode, Project } from '../types';
import { getCachedCalendarAccessToken } from '../firebase';
import { sendGoogleCalendarInvites } from '../utils/googleCalendarInvite';

interface CalendarViewProps {
  projects: Project[];
  entries: CalendarEntry[];
  projectControlerUrl: string;
  calendarInviteEmails: string[];
  controllerName: string;
  controllerEmail: string;
  onAddAnnotation: (entry: {
    projectId: string;
    date: string;
    title: string;
    details: string;
    startTime: string;
    durationMinutes: number;
    location: string;
  }) => Promise<string | void>;
  onUpdateEntry: (
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
  ) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onChangeProjectColor: (projectId: string, color: string) => Promise<void>;
  onCreateManualProject: (
    project: Omit<Project, 'id'> & { id?: string }
  ) => Promise<string | null>;
  onImportProjectControlerFile: (files: File | FileList | File[]) => Promise<void>;
  onNotify?: (msg: string) => void;
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

const HOURS = Array.from({ length: 13 }, (_, idx) => idx + 7); // 07:00 -> 19:00

const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
  { label: 'Journée (8h)', minutes: 480 },
];

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDateStr = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getMondayOfWeek = (dateStr: string): Date => {
  const d = parseDateStr(dateStr);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const formatDurationLabel = (mins: number): string => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h}h` : `${h}h${String(rem).padStart(2, '0')}`;
};

const isAllDayEntry = (ev: CalendarEntry): boolean =>
  Boolean(ev.allDay) ||
  ev.source === 'project-controler' ||
  ev.entryType === 'Intempérie' ||
  ev.entryType === 'JC';

const computeEndDateTime = (
  dateStr: string,
  startTime: string,
  durationMinutes: number
) => {
  const [hh, mm] = (startTime || '09:00').split(':').map(Number);
  const start = parseDateStr(dateStr);
  start.setHours(hh || 9, mm || 0, 0, 0);
  const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60000);
  return { start, end };
};

const toCompactStamp = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}00`;
};

const toIsoLocalDateTime = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}:00`;
};

const escapeIcsText = (str: string): string =>
  str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

export const CalendarView: React.FC<CalendarViewProps> = ({
  projects,
  entries,
  projectControlerUrl,
  calendarInviteEmails,
  controllerName,
  controllerEmail,
  onAddAnnotation,
  onUpdateEntry,
  onDeleteEntry,
  onChangeProjectColor,
  onCreateManualProject,
  onImportProjectControlerFile,
  onNotify,
}) => {
  const todayStr = formatDateStr(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [anchorDate, setAnchorDate] = useState<string>(todayStr);
  const [editingColorFor, setEditingColorFor] = useState<string | null>(null);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [creatingNewEvent, setCreatingNewEvent] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editProjectId, setEditProjectId] = useState('general');
  const [editDate, setEditDate] = useState(todayStr);
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editDurationMinutes, setEditDurationMinutes] = useState(60);
  const [editLocation, setEditLocation] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [selectedInviteEmails, setSelectedInviteEmails] = useState<string[]>([]);
  const [autoSendInvite, setAutoSendInvite] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [pendingInviteConfirm, setPendingInviteConfirm] = useState<{
    summary: string;
    description: string;
    location: string;
    start: Date;
    end: Date;
    attendeeEmails: string[];
    date: string;
    startTime: string;
  } | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [showManualProjectModal, setShowManualProjectModal] = useState(false);
  const [manualProjName, setManualProjName] = useState('');
  const [manualProjCode, setManualProjCode] = useState('');
  const [manualProjCommune, setManualProjCommune] = useState('');
  const [manualProjColor, setManualProjColor] = useState(
    PROJECT_COLOR_PALETTE[0].hex
  );
  const [savingManualProj, setSavingManualProj] = useState(false);
  const [assignManualToEventModal, setAssignManualToEventModal] =
    useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const anchorObj = parseDateStr(anchorDate);
  const viewYear = anchorObj.getFullYear();
  const viewMonth = anchorObj.getMonth();

  const selectedEntry = selectedEntryId
    ? entries.find((e) => e.id === selectedEntryId) ?? null
    : null;
  const isEventModalOpen =
    creatingNewEvent || Boolean(selectedEntry) || Boolean(pendingInviteConfirm);

  useEffect(() => {
    if (selectedEntry) {
      setCreatingNewEvent(false);
      setEditTitle(selectedEntry.title);
      setEditProjectId(selectedEntry.projectId || 'general');
      setEditDate(selectedEntry.date);
      setEditStartTime(selectedEntry.startTime || '09:00');
      setEditDurationMinutes(selectedEntry.durationMinutes ?? 60);
      setEditLocation(selectedEntry.location || '');
      setEditDetails(selectedEntry.details || '');
      setSelectedInviteEmails(calendarInviteEmails);
      setAutoSendInvite(calendarInviteEmails.length > 0);
      setPendingInviteConfirm(null);
      setInviteError(null);
    }
  }, [selectedEntryId, calendarInviteEmails]);

  useEffect(() => {
    if (!isEventModalOpen && !showManualProjectModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showManualProjectModal) {
          setShowManualProjectModal(false);
        } else {
          setSelectedEntryId(null);
          setCreatingNewEvent(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEventModalOpen, showManualProjectModal]);

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const handleNavigate = (dir: -1 | 1) => {
    const d = parseDateStr(anchorDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + dir * 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() + dir);
    } else {
      d.setFullYear(d.getFullYear() + dir);
    }
    setAnchorDate(formatDateStr(d));
  };

  const getHeaderLabel = (): string => {
    if (viewMode === 'month') return `${MONTH_NAMES[viewMonth]} ${viewYear}`;
    if (viewMode === 'year') return `Année ${viewYear}`;
    if (viewMode === 'day') {
      return anchorObj.toLocaleDateString('fr-BE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    const monday = getMondayOfWeek(anchorDate);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `Semaine du ${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} au ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]} ${sunday.getFullYear()}`;
  };

  const openNewEventModal = (date = anchorDate, startTime = '09:00') => {
    setSelectedEntryId(null);
    setCreatingNewEvent(true);
    setEditTitle('');
    setEditProjectId(projects[0]?.id ?? 'general');
    setEditDate(date);
    setEditStartTime(startTime);
    setEditDurationMinutes(60);
    setEditLocation('');
    setEditDetails('');
    setSelectedInviteEmails(calendarInviteEmails);
    setAutoSendInvite(calendarInviteEmails.length > 0);
    setPendingInviteConfirm(null);
    setInviteError(null);
  };

  const openManualProjectModal = (assignToEvent = false) => {
    setAssignManualToEventModal(assignToEvent);
    setManualProjName('');
    setManualProjCode('');
    setManualProjCommune('');
    setManualProjColor(
      PROJECT_COLOR_PALETTE[projects.length % PROJECT_COLOR_PALETTE.length].hex
    );
    setShowManualProjectModal(true);
  };

  const handleSaveManualProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProjName.trim() || savingManualProj) return;
    setSavingManualProj(true);
    try {
      const autoCode = `LIB-${String(projects.length + 1).padStart(2, '0')}`;
      const createdId = await onCreateManualProject({
        code: manualProjCode.trim() || autoCode,
        name: manualProjName.trim(),
        commune: manualProjCommune.trim() || 'Chantier libre',
        color: manualProjColor,
        marcheTotalReviseEur: 0,
        cumulEaValidesEur: 0,
        eaEnCoursEur: 0,
        eaEnCoursCoche: false,
        delaiRestantJours: 0,
        startDate: todayStr,
        contractualEndDate: todayStr,
        estimatedEndDate: todayStr,
      });
      if (assignManualToEventModal && createdId) {
        setEditProjectId(createdId);
      }
      setShowManualProjectModal(false);
    } finally {
      setSavingManualProj(false);
    }
  };

  const openInlineDraft = (date: string, startTime = '09:00') => {
    openNewEventModal(date, startTime);
  };

  const closeEventModal = () => {
    setSelectedEntryId(null);
    setCreatingNewEvent(false);
    setPendingInviteConfirm(null);
    setInviteError(null);
  };

  const handleSaveModalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntry && selectedEntry.source === 'project-controler') return;
    if (!editTitle.trim()) return;
    setSavingEntry(true);
    setInviteError(null);
    try {
      if (creatingNewEvent) {
        await onAddAnnotation({
          title: editTitle.trim(),
          projectId: editProjectId || 'general',
          date: editDate,
          startTime: editStartTime,
          durationMinutes: Math.max(0, Number(editDurationMinutes) || 60),
          location: editLocation.trim(),
          details: editDetails.trim(),
        });
      } else if (selectedEntry) {
        await onUpdateEntry(selectedEntry.id, {
          title: editTitle.trim(),
          projectId: editProjectId || 'general',
          date: editDate,
          startTime: editStartTime,
          durationMinutes: Math.max(0, Number(editDurationMinutes) || 60),
          location: editLocation.trim(),
          details: editDetails.trim(),
        });
      }

      if (autoSendInvite && selectedInviteEmails.length > 0) {
        const preview = buildInviteLinks();
        setCreatingNewEvent(false);
        setSelectedEntryId(null);
        setPendingInviteConfirm({
          summary: preview.fullTitle,
          description: preview.detailsLines,
          location: editLocation.trim(),
          start: preview.start,
          end: preview.end,
          attendeeEmails: [...selectedInviteEmails],
          date: editDate,
          startTime: editStartTime,
        });
      } else {
        setCreatingNewEvent(false);
        setSelectedEntryId(null);
      }
    } finally {
      setSavingEntry(false);
    }
  };

  const handleConfirmAutoSendInvite = async () => {
    if (!pendingInviteConfirm || sendingInvite) return;
    setSendingInvite(true);
    setInviteError(null);
    try {
      const res = await sendGoogleCalendarInvites({
        summary: pendingInviteConfirm.summary,
        description: pendingInviteConfirm.description,
        location: pendingInviteConfirm.location,
        start: pendingInviteConfirm.start,
        end: pendingInviteConfirm.end,
        attendeeEmails: pendingInviteConfirm.attendeeEmails,
      });
      onNotify?.(
        `Invitation envoyée depuis ${res.organizerEmail || controllerEmail} à ${res.attendeesCount} destinataire(s).`
      );
      setPendingInviteConfirm(null);
    } catch (err) {
      setInviteError(
        err instanceof Error
          ? err.message
          : 'Impossible d’envoyer l’invitation via Google Calendar.'
      );
    } finally {
      setSendingInvite(false);
    }
  };

  const handleDeleteFromModal = async () => {
    if (!selectedEntry || selectedEntry.source === 'project-controler') return;
    const idToDelete = selectedEntry.id;
    setSelectedEntryId(null);
    await onDeleteEntry(idToDelete);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await onImportProjectControlerFile(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleInviteRecipient = (email: string) => {
    setSelectedInviteEmails((curr) =>
      curr.includes(email)
        ? curr.filter((e) => e !== email)
        : [...curr, email]
    );
  };

  const buildInviteLinks = () => {
    const proj = getProject(editProjectId);
    const fullTitle = proj
      ? `[${proj.code}] ${editTitle.trim() || 'Rendez-vous chantier'}`
      : editTitle.trim() || 'Rendez-vous chantier';
    const { start, end } = computeEndDateTime(
      editDate,
      editStartTime,
      editDurationMinutes
    );

    const detailsLines = [
      proj ? `Chantier : ${proj.code} — ${proj.name} (${proj.commune})` : '',
      editDetails.trim(),
      `Organisé via B.O.C par ${controllerName}`,
    ]
      .filter(Boolean)
      .join('\n');

    const googleParams = new URLSearchParams({
      action: 'TEMPLATE',
      text: fullTitle,
      dates: `${toCompactStamp(start)}/${toCompactStamp(end)}`,
      details: detailsLines,
      location: editLocation.trim(),
    });
    if (selectedInviteEmails.length > 0) {
      googleParams.set('add', selectedInviteEmails.join(','));
    }

    const outlookParams = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: fullTitle,
      startdt: toIsoLocalDateTime(start),
      enddt: toIsoLocalDateTime(end),
      body: detailsLines,
      location: editLocation.trim(),
    });
    if (selectedInviteEmails.length > 0) {
      outlookParams.set('to', selectedInviteEmails.join(','));
    }

    return {
      googleUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
      outlookUrl: `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams.toString()}`,
      start,
      end,
      fullTitle,
      detailsLines,
    };
  };

  const handleDownloadIcs = () => {
    const { start, end, fullTitle, detailsLines } = buildInviteLinks();
    const uid = `boc-${selectedEntry?.id || Date.now()}@boc.inasep`;
    const nowStamp = toCompactStamp(new Date());
    const attendeesLines = selectedInviteEmails.map(
      (em) =>
        `ATTENDEE;CN=${escapeIcsText(em)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${em}`
    );

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BOC//Boite a Outils du Controleur//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${toCompactStamp(start)}`,
      `DTEND:${toCompactStamp(end)}`,
      `SUMMARY:${escapeIcsText(fullTitle)}`,
      `DESCRIPTION:${escapeIcsText(detailsLines)}`,
      ...(editLocation.trim()
        ? [`LOCATION:${escapeIcsText(editLocation.trim())}`]
        : []),
      `ORGANIZER;CN=${escapeIcsText(controllerName)}:mailto:${controllerEmail}`,
      ...attendeesLines,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const blob = new Blob([lines.join('\r\n')], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rdv_${editDate}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const mondayOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const monthCells: (string | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) monthCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    monthCells.push(
      `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  const mondayOfWeek = getMondayOfWeek(anchorDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayOfWeek);
    d.setDate(mondayOfWeek.getDate() + i);
    return formatDateStr(d);
  });

  const entriesForDate = (dateStr: string) =>
    entries
      .filter((e) => e.date === dateStr)
      .sort((a, b) => {
        const aAll = isAllDayEntry(a);
        const bAll = isAllDayEntry(b);
        if (aAll !== bAll) return aAll ? -1 : 1;
        return (a.startTime || '09:00').localeCompare(b.startTime || '09:00');
      });

  const renderEventChip = (ev: CalendarEntry, compact = false) => {
    const proj = getProject(ev.projectId);
    const color = proj?.color ?? '#334155';
    const isAllDay = isAllDayEntry(ev);

    return (
      <button
        key={ev.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedEntryId(ev.id);
        }}
        title={
          isAllDay
            ? `${ev.title} (Info journée entière — Project-Controler)`
            : 'Cliquer pour paramétrer ou envoyer une invitation'
        }
        className={`w-full text-left rounded-md px-2 py-1 text-[11px] leading-tight transition-opacity hover:opacity-90 flex items-center gap-1.5 border ${
          isAllDay ? 'border-dashed' : ''
        }`}
        style={{
          backgroundColor: `${color}16`,
          borderColor: `${color}55`,
          color: '#0F172A',
        }}
      >
        {isAllDay ? (
          <CloudRain className="w-3 h-3 shrink-0" style={{ color }} />
        ) : (
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        {!compact && !isAllDay && ev.startTime && (
          <span className="font-mono text-[10px] text-slate-600 shrink-0">
            {ev.startTime}
          </span>
        )}
        <span className="truncate font-semibold">
          {ev.source === 'project-controler' ? `[${ev.entryType}] ` : ''}
          {ev.title}
        </span>
      </button>
    );
  };

  const dayAllDayEntries = entriesForDate(anchorDate).filter(isAllDayEntry);
  const weekHasAnyAllDay = weekDates.some((d) =>
    entriesForDate(d).some(isAllDayEntry)
  );

  const invitePreview =
    creatingNewEvent ||
    (selectedEntry && selectedEntry.source !== 'project-controler')
      ? buildInviteLinks()
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Calendrier chantier
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Double-cliquez sur une case ou cliquez sur « Nouvel événement » · Les intempéries et congés Project-Controler apparaissent en info journée entière.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openNewEventModal(anchorDate, '09:00')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-xs font-semibold text-white hover:from-emerald-700 hover:to-teal-700 shadow-xs transition-all whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvel événement</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Sync Project-Controler (.JSON)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <a
            href={projectControlerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-xs shadow-blue-700/20 transition-all whitespace-nowrap"
          >
            <span>Encoder intempérie / JC dans Project-Controler</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-3.5 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-medium text-slate-500">
          Chantiers & couleurs :
        </span>
        {projects.map((proj) => (
          <div key={proj.id} className="relative">
            <button
              type="button"
              onClick={() =>
                setEditingColorFor((curr) => (curr === proj.id ? null : proj.id))
              }
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-800 transition-colors"
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

        <button
          type="button"
          onClick={() => openManualProjectModal(false)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-blue-300 bg-blue-50/70 hover:bg-blue-100/80 text-xs font-semibold text-blue-800 transition-colors whitespace-nowrap"
          title="Ajouter un chantier libre sans le lier à Project-Controler"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau chantier manuel</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/60 via-slate-50/70 to-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              aria-label="Période précédente"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(todayStr)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap transition-colors"
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              aria-label="Période suivante"
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-slate-900 ml-2 capitalize">
              {getHeaderLabel()}
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'month', label: 'Mois' },
                { id: 'week', label: 'Semaines' },
                { id: 'day', label: 'Jours' },
                { id: 'year', label: 'Année' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setViewMode(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  viewMode === m.id
                    ? 'bg-gradient-to-r from-blue-700 to-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'month' && (
          <>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-2 sm:py-2.5 text-center text-[11px] sm:text-xs font-medium text-slate-500"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {monthCells.map((dateStr, idx) => {
                if (!dateStr) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-14 sm:min-h-28 bg-slate-50/40"
                    />
                  );
                }

                const dayNum = Number(dateStr.slice(8, 10));
                const dayEntries = entriesForDate(dateStr);
                const isSelected = dateStr === anchorDate;
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setAnchorDate(dateStr)}
                    onDoubleClick={() => openInlineDraft(dateStr, '09:00')}
                    className={`group min-h-14 sm:min-h-28 p-1 sm:p-2 flex flex-col gap-1 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-500/40'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
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

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInlineDraft(dateStr, '09:00');
                        }}
                        title="Ajouter une note (ou double-clic sur la case)"
                        className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-white transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex sm:hidden flex-wrap gap-1 px-0.5 pt-0.5">
                      {dayEntries.slice(0, 4).map((ev) => {
                        const proj = getProject(ev.projectId);
                        return (
                          <span
                            key={`dot-${ev.id}`}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: proj?.color ?? '#1D4ED8' }}
                          />
                        );
                      })}
                      {dayEntries.length > 4 && (
                        <span className="text-[9px] font-mono text-slate-500 leading-none">
                          +{dayEntries.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="hidden sm:block space-y-1 w-full">
                      {dayEntries.map((ev) => renderEventChip(ev, true))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sm:hidden border-t border-slate-200 p-4 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Journée du <span className="font-mono">{anchorDate}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {entriesForDate(anchorDate).length} élément(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openInlineDraft(anchorDate, '09:00')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-700 text-xs font-medium text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>

              <div className="space-y-2">
                {entriesForDate(anchorDate).map((ev) => {
                  const proj = getProject(ev.projectId);
                  const color = proj?.color ?? '#334155';
                  const allDay = isAllDayEntry(ev);
                  return (
                    <button
                      key={`mob-ev-${ev.id}`}
                      type="button"
                      onClick={() => setSelectedEntryId(ev.id)}
                      className="w-full text-left rounded-lg bg-white border border-slate-200 p-3 flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {ev.source === 'project-controler'
                              ? `[${ev.entryType}] `
                              : ''}
                            {ev.title}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            {allDay
                              ? 'Journée entière (Info)'
                              : `${ev.startTime || '09:00'} · ${formatDurationLabel(
                                  ev.durationMinutes ?? 60
                                )}`}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {entriesForDate(anchorDate).length === 0 && (
                  <p className="text-xs text-slate-500">
                    Aucun événement ce jour. Appuyez sur Ajouter pour créer une note.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {weekDates.map((dStr, i) => {
                const dayEvs = entriesForDate(dStr);
                const isToday = dStr === todayStr;
                return (
                  <div
                    key={`mob-wk-${dStr}`}
                    className={`p-4 space-y-2.5 ${
                      isToday ? 'bg-blue-50/35' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setAnchorDate(dStr);
                          setViewMode('day');
                        }}
                        className="text-xs font-bold text-slate-900 flex items-center gap-2"
                      >
                        <span>{WEEKDAYS[i]}</span>
                        <span className="font-mono text-slate-600">
                          {dStr.slice(8, 10)}/{dStr.slice(5, 7)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnchorDate(dStr);
                          setViewMode('day');
                          openInlineDraft(dStr, '09:00');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {dayEvs.map((ev) => renderEventChip(ev))}
                      {dayEvs.length === 0 && (
                        <p className="text-xs text-slate-400">Rien de prévu</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
                  <div className="py-2.5 px-3 text-xs font-medium text-slate-500 border-r border-slate-200">
                    Heure
                  </div>
                  {weekDates.map((dStr, i) => {
                    const isToday = dStr === todayStr;
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          setAnchorDate(dStr);
                          setViewMode('day');
                        }}
                        className={`py-2.5 px-2 text-center border-r border-slate-100 hover:bg-white transition-colors ${
                          isToday ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <div className="text-[11px] font-medium text-slate-500">
                          {WEEKDAYS[i]}
                        </div>
                        <div
                          className={`text-xs font-mono tabular-nums mt-0.5 ${
                            isToday
                              ? 'text-blue-700 font-bold'
                              : 'text-slate-900 font-semibold'
                          }`}
                        >
                          {dStr.slice(8, 10)}/{dStr.slice(5, 7)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bande dédiée Journée entière (Intempéries & JC) */}
                {weekHasAnyAllDay && (
                  <div className="grid grid-cols-8 border-b border-slate-200 bg-sky-50/45">
                    <div className="px-3 py-2 text-[11px] font-semibold text-sky-800 border-r border-slate-200 flex items-center">
                      Journée
                    </div>
                    {weekDates.map((dStr) => {
                      const allDayEvs = entriesForDate(dStr).filter(isAllDayEntry);
                      return (
                        <div
                          key={`wk-allday-${dStr}`}
                          className="p-1.5 border-r border-slate-100 space-y-1"
                        >
                          {allDayEvs.map((ev) => renderEventChip(ev, true))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {HOURS.map((hour) => {
                    const hourPrefix = `${String(hour).padStart(2, '0')}:`;
                    const slotTime = `${hourPrefix}00`;
                    return (
                      <div key={hour} className="grid grid-cols-8 min-h-14">
                        <div className="px-3 py-2 text-xs font-mono text-slate-500 border-r border-slate-200 bg-slate-50/50">
                          {slotTime}
                        </div>
                        {weekDates.map((dStr) => {
                          const slotEntries = entriesForDate(dStr).filter((ev) => {
                            if (isAllDayEntry(ev)) return false;
                            const evHour = Number(
                              (ev.startTime || '09:00').slice(0, 2)
                            );
                            return evHour === hour;
                          });

                          return (
                            <div
                              key={`${dStr}-${hour}`}
                              onDoubleClick={() => openInlineDraft(dStr, slotTime)}
                              className="p-1.5 border-r border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer space-y-1"
                            >
                              {slotEntries.map((ev) => renderEventChip(ev))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {viewMode === 'day' && (
          <div className="divide-y divide-slate-100">
            {dayAllDayEntries.length > 0 && (
              <div className="flex items-stretch bg-sky-50/45 border-b border-slate-200">
                <div className="w-16 sm:w-24 shrink-0 px-2.5 sm:px-4 py-3 text-[11px] font-semibold text-sky-900 border-r border-slate-200 flex items-center">
                  Journée entière
                </div>
                <div className="flex-1 p-2.5 flex flex-wrap gap-2 items-center">
                  {dayAllDayEntries.map((ev) => {
                    const proj = getProject(ev.projectId);
                    const color = proj?.color ?? '#334155';
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEntryId(ev.id)}
                        className="text-left rounded-lg px-3.5 py-2 border border-dashed shadow-2xs hover:shadow-xs transition-all min-w-[220px]"
                        style={{
                          backgroundColor: `${color}16`,
                          borderColor: `${color}65`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <CloudRain className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                          <span className="text-xs font-bold text-slate-900">
                            [{ev.entryType}] {ev.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Info journée entière · Project-Controler
                          {ev.location ? ` · ${ev.location}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {HOURS.map((hour) => {
              const slotTime = `${String(hour).padStart(2, '0')}:00`;
              const slotEntries = entriesForDate(anchorDate).filter((ev) => {
                if (isAllDayEntry(ev)) return false;
                const evHour = Number((ev.startTime || '09:00').slice(0, 2));
                return evHour === hour;
              });

              return (
                <div
                  key={hour}
                  onDoubleClick={() => openInlineDraft(anchorDate, slotTime)}
                  className="group flex items-stretch min-h-16 hover:bg-blue-50/30 transition-colors cursor-pointer"
                >
                  <div className="w-16 sm:w-24 shrink-0 px-2.5 sm:px-4 py-3 text-xs font-mono text-slate-500 border-r border-slate-200 bg-slate-50/60 flex items-start justify-between">
                    <span>{slotTime}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openInlineDraft(anchorDate, slotTime);
                      }}
                      className="opacity-75 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 p-2.5 flex flex-wrap gap-2 items-start">
                    {slotEntries.map((ev) => {
                      const proj = getProject(ev.projectId);
                      const color = proj?.color ?? '#334155';
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntryId(ev.id);
                          }}
                          className="text-left rounded-lg px-3.5 py-2 border shadow-xs hover:shadow-sm transition-all min-w-[220px] max-w-md"
                          style={{
                            backgroundColor: `${color}18`,
                            borderColor: `${color}55`,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs font-bold text-slate-900">
                              {ev.title}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {ev.startTime || '09:00'} ·{' '}
                              {formatDurationLabel(ev.durationMinutes ?? 60)}
                            </span>
                            {ev.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {ev.location}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'year' && (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {MONTH_NAMES.map((mName, mIdx) => {
              const mFirst = new Date(viewYear, mIdx, 1);
              const mDays = new Date(viewYear, mIdx + 1, 0).getDate();
              const offset = (mFirst.getDay() + 6) % 7;
              const cells: (string | null)[] = [];
              for (let i = 0; i < offset; i++) cells.push(null);
              for (let d = 1; d <= mDays; d++) {
                cells.push(
                  `${viewYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                );
              }

              return (
                <div
                  key={mName}
                  className="border border-slate-200 rounded-xl p-3 bg-slate-50/40"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAnchorDate(
                        `${viewYear}-${String(mIdx + 1).padStart(2, '0')}-01`
                      );
                      setViewMode('month');
                    }}
                    className="text-xs font-bold text-slate-900 hover:text-blue-700 mb-2 block"
                  >
                    {mName}
                  </button>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, idx) => (
                      <span key={idx}>{l}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((dStr, i) => {
                      if (!dStr) return <div key={`ye-${mIdx}-${i}`} className="h-7" />;
                      const dayEvs = entriesForDate(dStr);
                      const isToday = dStr === todayStr;
                      const firstColor = dayEvs[0]
                        ? getProject(dayEvs[0].projectId)?.color ?? '#1D4ED8'
                        : null;

                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => {
                            setAnchorDate(dStr);
                            setViewMode('day');
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setAnchorDate(dStr);
                            setViewMode('month');
                            openInlineDraft(dStr, '09:00');
                          }}
                          title={
                            dayEvs.length > 0
                              ? `${dayEvs.length} événement(s) — Cliquer pour ouvrir le jour`
                              : 'Double-clic pour ajouter'
                          }
                          className={`h-7 rounded text-[11px] font-mono tabular-nums flex flex-col items-center justify-center transition-colors ${
                            isToday
                              ? 'bg-blue-700 text-white font-bold'
                              : dayEvs.length > 0
                              ? 'bg-white border border-slate-200 font-semibold text-slate-900 hover:border-blue-400'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span>{Number(dStr.slice(8, 10))}</span>
                          {firstColor && (
                            <span
                              className="w-1.5 h-1.5 rounded-full -mt-0.5"
                              style={{ backgroundColor: firstColor }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isEventModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 p-4 flex items-center justify-center overflow-y-auto"
          onClick={closeEventModal}
          role="dialog"
          aria-modal="true"
          aria-label="Paramètres de l'événement"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-auto"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {pendingInviteConfirm
                  ? 'Confirmer l’envoi de l’invitation'
                  : selectedEntry?.source === 'project-controler'
                  ? `${selectedEntry.entryType} · Info Project-Controler`
                  : creatingNewEvent
                  ? 'Nouvel événement & Invitation RDV'
                  : 'Paramètres & Invitation RDV'}
              </h3>
              <button
                type="button"
                onClick={closeEventModal}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingInviteConfirm ? (() => {
              const hasSessionMailConsent = Boolean(
                getCachedCalendarAccessToken()
              );
              return (
                <div className="p-6 space-y-4">
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2.5 text-xs text-blue-950">
                    <div className="font-bold text-sm text-blue-900 flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>Événement enregistré dans votre B.O.C</span>
                    </div>

                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-950 space-y-0.5">
                      <div>
                        <strong>Compte expéditeur (le vôtre) :</strong>{' '}
                        <span className="font-mono font-semibold">
                          {controllerEmail}
                        </span>
                      </div>
                      <div className="text-emerald-800">
                        L’invitation partira directement depuis votre propre agenda Google. Elle ne transite par aucun autre membre ni administrateur.
                      </div>
                    </div>

                    {!hasSessionMailConsent && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-950">
                        Un <strong>pop-up Google</strong> va vous demander l’accord de votre messagerie (
                        <span className="font-mono">{controllerEmail}</span>) pour envoyer cette invitation.
                      </div>
                    )}

                    <div className="bg-white/85 rounded-lg border border-blue-200/80 p-3 space-y-1">
                      <div className="font-semibold text-slate-900">
                        {pendingInviteConfirm.summary}
                      </div>
                      <div className="font-mono text-[11px] text-slate-600">
                        {pendingInviteConfirm.date} à {pendingInviteConfirm.startTime}
                        {pendingInviteConfirm.location
                          ? ` · ${pendingInviteConfirm.location}`
                          : ''}
                      </div>
                      <div className="pt-1 flex flex-wrap gap-1.5">
                        {pendingInviteConfirm.attendeeEmails.map((em) => (
                          <span
                            key={em}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono text-[11px]"
                          >
                            <Mail className="w-3 h-3" />
                            {em}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {inviteError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                      {inviteError}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={sendingInvite}
                      onClick={closeEventModal}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Enregistrer sans envoyer
                    </button>
                    <button
                      type="button"
                      disabled={sendingInvite}
                      onClick={handleConfirmAutoSendInvite}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 disabled:opacity-60 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {sendingInvite
                          ? 'Envoi en cours...'
                          : hasSessionMailConsent
                          ? 'Confirmer et envoyer l’invitation'
                          : 'Autoriser mon mail et envoyer'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })() : selectedEntry && selectedEntry.source === 'project-controler' ? (
              <div className="p-6 space-y-4">
                <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                  <CloudRain className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <span>
                    Cet événement provient de <strong>Project-Controler</strong> à titre d’information pour la journée entière (absent de l’accueil).
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">Titre :</span>
                    <div className="font-semibold text-slate-900">
                      {selectedEntry.title}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Date :</span>
                      <div className="font-mono font-medium text-slate-900">
                        {selectedEntry.date}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Portée :</span>
                      <div className="font-medium text-slate-900">
                        Journée entière (Info)
                      </div>
                    </div>
                  </div>
                  {selectedEntry.details && (
                    <div className="text-xs text-slate-700 pt-2 border-t border-slate-100">
                      {selectedEntry.details}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <a
                    href={projectControlerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800"
                  >
                    <span>Modifier dans Project-Controler</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSaveModalEntry}
                className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Titre
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Ex. Réunion de chantier hebdomadaire"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Chantier (couleur)
                      </label>
                      <button
                        type="button"
                        onClick={() => openManualProjectModal(true)}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
                      >
                        + Chantier manuel
                      </button>
                    </div>
                    <select
                      value={editProjectId}
                      onChange={(e) => setEditProjectId(e.target.value)}
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
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Heure de début
                    </label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Durée (minutes)
                    </label>
                    <input
                      type="number"
                      min="15"
                      max="1440"
                      step="15"
                      value={editDurationMinutes}
                      onChange={(e) =>
                        setEditDurationMinutes(Number(e.target.value) || 60)
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => setEditDurationMinutes(preset.minutes)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                        editDurationMinutes === preset.minutes
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Lieu
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Ex. Bureau INASEP, Rue de la Station..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Notes / Participants
                  </label>
                  <textarea
                    rows={2}
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    placeholder="Détails, remarques, personnes présentes..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Envoi demande de rendez-vous (Gmail / Outlook / ICS) */}
                {invitePreview && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                        <Send className="w-3.5 h-3.5 text-blue-700" />
                        <span>Envoyer une demande de RDV calendrier</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {selectedInviteEmails.length} destinataire(s)
                      </span>
                    </div>

                    {calendarInviteEmails.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-2">
                          {calendarInviteEmails.map((em) => {
                            const checked = selectedInviteEmails.includes(em);
                            return (
                              <label
                                key={em}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  checked
                                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleInviteRecipient(em)}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700"
                                />
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="font-mono text-[11px]">{em}</span>
                              </label>
                            );
                          })}
                        </div>

                        <label className="flex items-start gap-2 rounded-lg bg-white border border-blue-200/80 px-3 py-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSendInvite}
                            onChange={(e) => setAutoSendInvite(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-700 mt-0.5 shrink-0"
                          />
                          <span>
                            Envoyer automatiquement l’invitation depuis votre compte (<span className="font-mono text-slate-900">{controllerEmail}</span>) aux adresses cochées lors du clic sur <strong>Enregistrer</strong> (avec votre accord Google).
                          </span>
                        </label>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Aucune adresse enregistrée : configurez 1 à 3 adresses Gmail/Outlook dans <strong>Paramètres</strong> (ou créez l’invitation directement ci-dessous).
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={invitePreview.googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:border-blue-300 transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-700" />
                        <span>Google Agenda</span>
                      </a>
                      <a
                        href={invitePreview.outlookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-300 transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-sky-700" />
                        <span>Outlook Calendar</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleDownloadIcs}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-700" />
                        <span>Invitation .ICS</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                  {selectedEntry ? (
                    <button
                      type="button"
                      onClick={handleDeleteFromModal}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Création d’événement B.O.C
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeEventModal}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={savingEntry}
                      className="px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {savingEntry ? 'Sauvegarde...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showManualProjectModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 p-4 flex items-center justify-center"
          onClick={() => setShowManualProjectModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Ajouter un chantier manuel"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Nouveau chantier manuel
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chantier libre sans liaison Project-Controler (utilisable partout dans B.O.C).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualProjectModal(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualProject} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Intitulé / Nom du chantier
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={manualProjName}
                  onChange={(e) => setManualProjName(e.target.value)}
                  placeholder="Ex. Visite préliminaire rue Haute"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Code (optionnel)
                  </label>
                  <input
                    type="text"
                    value={manualProjCode}
                    onChange={(e) => setManualProjCode(e.target.value)}
                    placeholder={`Ex. LIB-${String(projects.length + 1).padStart(2, '0')}`}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Commune / Lieu (optionnel)
                  </label>
                  <input
                    type="text"
                    value={manualProjCommune}
                    onChange={(e) => setManualProjCommune(e.target.value)}
                    placeholder="Ex. Namur"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Couleur d’identification
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {PROJECT_COLOR_PALETTE.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={swatch.label}
                      onClick={() => setManualProjColor(swatch.hex)}
                      className={`w-7 h-7 rounded-md border transition-transform ${
                        manualProjColor === swatch.hex
                          ? 'border-slate-900 scale-110 ring-2 ring-slate-900/20'
                          : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualProjectModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingManualProj}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {savingManualProj ? 'Ajout...' : 'Ajouter le chantier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
