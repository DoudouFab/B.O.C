import { CalendarEntry, NotebookItem, Project, TodoItem } from '../types';

export const PROJECT_COLOR_PALETTE: { label: string; hex: string }[] = [
  { label: 'Bleu cobalt', hex: '#1D4ED8' },
  { label: 'Vert émeraude', hex: '#047857' },
  { label: 'Ambre chantier', hex: '#B45309' },
  { label: 'Violet ardoise', hex: '#6D28D9' },
  { label: 'Bordeaux', hex: '#BE123C' },
  { label: 'Sarcelle', hex: '#0F766E' },
];

export const POSTIT_COLOR_PALETTE: {
  label: string;
  hex: string;
  borderHex: string;
}[] = [
  { label: 'Jaune Post-it', hex: '#FEF9C3', borderHex: '#FDE047' },
  { label: 'Bleu ciel', hex: '#E0F2FE', borderHex: '#7DD3FC' },
  { label: 'Vert sauge', hex: '#DCFCE7', borderHex: '#86EFAC' },
  { label: 'Pêche', hex: '#FFEDD5', borderHex: '#FDBA74' },
  { label: 'Lavande', hex: '#F3E8FF', borderHex: '#D8B4FE' },
  { label: 'Blanc', hex: '#FFFFFF', borderHex: '#E2E8F0' },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-profondeville',
    code: 'INASEP-26-041',
    name: 'Égouttage Rue de la Station & Voirie',
    commune: 'Profondeville',
    color: '#1D4ED8',
    marcheTotalReviseEur: 485000,
    cumulEaValidesEur: 248500,
    eaEnCoursEur: 62400,
    eaEnCoursCoche: true,
    delaiRestantJours: 38,
    startDate: '2026-09-01',
    contractualEndDate: '2027-01-12',
    estimatedEndDate: '2027-01-25',
  },
  {
    id: 'proj-gembloux',
    code: 'INASEP-26-058',
    name: 'Collecteur Séparatif Chaussée de Charleroi',
    commune: 'Gembloux',
    color: '#047857',
    marcheTotalReviseEur: 612000,
    cumulEaValidesEur: 184000,
    eaEnCoursEur: 48200,
    eaEnCoursCoche: true,
    delaiRestantJours: 74,
    startDate: '2026-10-12',
    contractualEndDate: '2027-04-02',
    estimatedEndDate: '2027-03-18',
  },
  {
    id: 'proj-floreffe',
    code: 'INASEP-26-072',
    name: 'Réfection Voirie & Avaloirs Rue du Moulin',
    commune: 'Floreffe',
    color: '#B45309',
    marcheTotalReviseEur: 294000,
    cumulEaValidesEur: 268500,
    eaEnCoursEur: 25500,
    eaEnCoursCoche: false,
    delaiRestantJours: 9,
    startDate: '2026-08-18',
    contractualEndDate: '2026-12-08',
    estimatedEndDate: '2026-12-08',
  },
];

export const INITIAL_TODOS: TodoItem[] = [
  {
    id: 'todo-1',
    projectId: 'proj-profondeville',
    title: 'Vérifier réception lit de sable avant remblai secteur bas',
    priority: 'Haute',
    done: false,
    dueDate: '2026-11-21',
  },
  {
    id: 'todo-2',
    projectId: 'proj-profondeville',
    title: 'Contrôler EA n°4 dans Project-Controler',
    priority: 'Haute',
    done: false,
    dueDate: '2026-11-22',
  },
  {
    id: 'todo-3',
    projectId: 'proj-gembloux',
    title: 'Relancer entrepreneur pour fiches techniques tampons D400',
    priority: 'Normale',
    done: false,
    dueDate: '2026-11-24',
  },
  {
    id: 'todo-4',
    projectId: 'proj-floreffe',
    title: 'Préparer PV de réception provisoire',
    priority: 'Basse',
    done: true,
    dueDate: '2026-11-18',
  },
];

export const INITIAL_CALENDAR_ENTRIES: CalendarEntry[] = [
  {
    id: 'cal-1',
    projectId: 'proj-profondeville',
    date: '2026-11-21',
    title: 'Réunion de chantier hebdomadaire',
    details: 'Point sur avancement égouttage et déviation riverains.',
    startTime: '09:00',
    durationMinutes: 90,
    location: 'Rue de la Station, Profondeville',
    entryType: 'Annotation',
    source: 'boc',
  },
  {
    id: 'cal-2',
    projectId: 'proj-profondeville',
    date: '2026-11-17',
    title: 'Intempérie · Pluie continue',
    details: 'Synchronisé depuis Project-Controler (arrêt terrassement).',
    startTime: '',
    durationMinutes: 480,
    allDay: true,
    location: 'Profondeville',
    entryType: 'Intempérie',
    source: 'project-controler',
  },
  {
    id: 'cal-3',
    projectId: 'proj-gembloux',
    date: '2026-11-19',
    title: 'JC · Gel matinal (-3 °C)',
    details: 'Synchronisé depuis Project-Controler (journée complète).',
    startTime: '',
    durationMinutes: 480,
    allDay: true,
    location: 'Gembloux',
    entryType: 'JC',
    source: 'project-controler',
  },
  {
    id: 'cal-4',
    projectId: 'proj-floreffe',
    date: '2026-11-25',
    title: 'Visite pré-réception commune',
    details: 'Contrôle des filets d’eau et avaloirs avec l’échevin des travaux.',
    startTime: '14:00',
    durationMinutes: 60,
    location: 'Rue du Moulin, Floreffe',
    entryType: 'Annotation',
    source: 'boc',
  },
];

export const INITIAL_NOTEBOOKS: NotebookItem[] = [
  {
    id: 'note-1',
    projectId: 'proj-profondeville',
    title: 'Chantier Profondeville — Semaine 47',
    content:
      '• Riverain n°24 : demande raccordement eau pluviale en attente.\n• Remarque conducteur : prévoir signalisation renforcée au carrefour pour vendredi.\n• À vérifier au prochain passage : niveau radier chambre R15.',
    color: '#FEF9C3',
    pinned: true,
    updatedAt: '2026-11-21',
  },
  {
    id: 'note-2',
    projectId: 'general',
    title: 'Mémo administratif INASEP',
    content:
      '• Toujours encoder les jours d’intempérie et JC directement dans Project-Controler.\n• Exporter le récapitulatif Project-Controler avant chaque réunion mensuelle pour garder B.O.C à jour.',
    color: '#E0F2FE',
    pinned: false,
    updatedAt: '2026-11-19',
  },
  {
    id: 'note-3',
    projectId: 'proj-gembloux',
    title: 'Livraison tampons fonte D400',
    content:
      '• Vérifier marquage EN124 sur le lot livré mardi.\n• Stocker sur zone clôturée chaussée de Charleroi.',
    color: '#DCFCE7',
    pinned: false,
    updatedAt: '2026-11-20',
  },
];
