export type ModuleTab =
  | 'overview'
  | 'planning'
  | 'todo'
  | 'calendar'
  | 'notes'
  | 'connector';

export interface ControllerProfile {
  uid: string;
  email: string;
  displayName: string;
  jtdUrl: string;
  inasepUrl: string;
  sitesnapUrl: string;
  linksLocked: boolean;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  commune: string;
  color: string;
  marcheTotalReviseEur: number;
  cumulEaValidesEur: number;
  eaEnCoursEur: number;
  eaEnCoursCoche: boolean;
  delaiRestantJours: number;
  startDate: string; // YYYY-MM-DD
  estimatedEndDate: string; // YYYY-MM-DD
}

export type TodoPriority = 'Haute' | 'Normale' | 'Basse';

export interface TodoItem {
  id: string;
  projectId: string;
  title: string;
  details?: string;
  priority: TodoPriority;
  done: boolean;
  dueDate: string;
}

export type CalendarEntryType = 'Annotation' | 'Intempérie' | 'JC';
export type CalendarSource = 'boc' | 'project-controler';
export type CalendarViewMode = 'month' | 'week' | 'day' | 'year';

export interface CalendarEntry {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  title: string;
  details: string;
  startTime: string; // HH:MM
  durationMinutes: number;
  location: string;
  entryType: CalendarEntryType;
  source: CalendarSource;
}

export interface NotebookItem {
  id: string;
  projectId: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  updatedAt: string;
}
