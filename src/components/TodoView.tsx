import React, { useEffect, useState } from 'react';
import { Calendar, Check, CheckSquare, Plus, Search, Trash2, X } from 'lucide-react';
import { Project, TodoItem, TodoPriority } from '../types';

interface TodoViewProps {
  projects: Project[];
  selectedProjectId: string;
  todos: TodoItem[];
  onAddTodo: (todo: Omit<TodoItem, 'id'>) => Promise<void> | void;
  onUpdateTodo: (
    id: string,
    patch: Partial<
      Pick<TodoItem, 'projectId' | 'title' | 'details' | 'priority' | 'done' | 'dueDate'>
    >
  ) => Promise<void> | void;
  onToggleDone: (id: string, done: boolean) => Promise<void> | void;
  onDeleteTodo: (id: string) => Promise<void> | void;
}

const PRIORITIES: TodoPriority[] = ['Haute', 'Normale', 'Basse'];

export const TodoView: React.FC<TodoViewProps> = ({
  projects,
  selectedProjectId,
  todos,
  onAddTodo,
  onUpdateTodo,
  onToggleDone,
  onDeleteTodo,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'Toutes' | 'À faire' | 'Terminées'>('Toutes');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDetails, setDraftDetails] = useState('');
  const [draftProjectId, setDraftProjectId] = useState<string>('general');
  const [draftPriority, setDraftPriority] = useState<TodoPriority>('Normale');
  const [draftDueDate, setDraftDueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [draftDone, setDraftDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  const openCreateModal = () => {
    setEditingTodo(null);
    setDraftTitle('');
    setDraftDetails('');
    setDraftProjectId(selectedProjectId === 'all' ? 'general' : selectedProjectId);
    setDraftPriority('Normale');
    setDraftDueDate(new Date().toISOString().slice(0, 10));
    setDraftDone(false);
    setModalOpen(true);
  };

  const openEditModal = (todo: TodoItem) => {
    setEditingTodo(todo);
    setDraftTitle(todo.title);
    setDraftDetails(todo.details || '');
    setDraftProjectId(todo.projectId || 'general');
    setDraftPriority(todo.priority);
    setDraftDueDate(todo.dueDate || new Date().toISOString().slice(0, 10));
    setDraftDone(todo.done);
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim()) return;
    setSaving(true);
    try {
      if (editingTodo) {
        await onUpdateTodo(editingTodo.id, {
          title: draftTitle.trim(),
          details: draftDetails.trim(),
          projectId: draftProjectId || 'general',
          priority: draftPriority,
          dueDate: draftDueDate,
          done: draftDone,
        });
      } else {
        await onAddTodo({
          projectId: draftProjectId || 'general',
          title: draftTitle.trim(),
          details: draftDetails.trim(),
          priority: draftPriority,
          done: draftDone,
          dueDate: draftDueDate,
        });
      }
      setModalOpen(false);
      setEditingTodo(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFromModal = async () => {
    if (!editingTodo) return;
    const id = editingTodo.id;
    setModalOpen(false);
    setEditingTodo(null);
    await onDeleteTodo(id);
  };

  const filtered = todos.filter((t) => {
    const matchesStatus =
      filter === 'Toutes' ||
      (filter === 'À faire' && !t.done) ||
      (filter === 'Terminées' && t.done);
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.details || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getProject = (id: string) => projects.find((p) => p.id === id);
  const openCount = todos.filter((t) => !t.done).length;

  return (
    <div className="space-y-4">
      {/* Barre d'action sticky : le bouton Ajouter tâche reste toujours visible */}
      <div className="sticky top-16 z-20 bg-[#f1f5fb]/95 backdrop-blur-md py-3 border-b border-slate-200/80 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">
            To-Do Liste
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 tabular-nums">
            {openCount} tâche(s) à traiter · {todos.length} au total
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 text-xs sm:text-sm font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-sm shadow-blue-700/20 transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter tâche</span>
        </button>
      </div>

      {/* Liste pure des tâches */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-3.5 sm:px-4 border-b border-slate-200/80 bg-gradient-to-r from-indigo-50/50 via-white to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            {(['Toutes', 'À faire', 'Terminées'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une tâche..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((todo) => {
            const proj = getProject(todo.projectId);
            return (
              <div
                key={todo.id}
                onClick={() => openEditModal(todo)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openEditModal(todo);
                  }
                }}
                className="px-4 py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDone(todo.id, !todo.done);
                    }}
                    aria-label={
                      todo.done
                        ? `Marquer "${todo.title}" à faire`
                        : `Marquer "${todo.title}" terminée`
                    }
                    className={`w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      todo.done
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <div className="min-w-0 space-y-1 flex-1">
                    <p
                      className={`text-sm font-medium leading-snug ${
                        todo.done ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {todo.title}
                    </p>
                    {todo.details && (
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {todo.details}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {proj ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: proj.color }}
                            aria-hidden="true"
                          />
                          <span>
                            {proj.code} · {proj.commune}
                          </span>
                        </span>
                      ) : (
                        <span>Général</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          todo.priority === 'Haute'
                            ? 'text-red-700 font-medium'
                            : todo.priority === 'Normale'
                            ? 'text-amber-700 font-medium'
                            : 'text-slate-600'
                        }
                      >
                        {todo.priority}
                      </span>
                      {todo.dueDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {todo.dueDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTodo(todo.id);
                  }}
                  aria-label={`Supprimer ${todo.title}`}
                  className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 px-4 text-center space-y-2.5 text-slate-500">
              <CheckSquare className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm">Aucune tâche à afficher.</p>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une tâche</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up création / détail & modification */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 p-3 sm:p-6 flex items-center justify-center"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={editingTodo ? 'Détails de la tâche' : 'Nouvelle tâche'}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveModal}
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
              <h2 className="text-base font-bold text-slate-900">
                {editingTodo ? 'Détails & paramètres de la tâche' : 'Nouvelle tâche'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label
                  htmlFor="modal-todo-title"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Titre de la tâche *
                </label>
                <input
                  id="modal-todo-title"
                  type="text"
                  required
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Ex. Rappeler conducteur pour visite chantier..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="modal-todo-details"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Détails / notes complémentaires
                </label>
                <textarea
                  id="modal-todo-details"
                  rows={3}
                  value={draftDetails}
                  onChange={(e) => setDraftDetails(e.target.value)}
                  placeholder="Précisions, contacts, points à vérifier sur place..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="modal-todo-project"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Chantier lié
                  </label>
                  <select
                    id="modal-todo-project"
                    value={draftProjectId}
                    onChange={(e) => setDraftProjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  <label
                    htmlFor="modal-todo-date"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Échéance
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="modal-todo-date"
                      type="date"
                      value={draftDueDate}
                      onChange={(e) => setDraftDueDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Priorité
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITIES.map((p) => {
                    const active = draftPriority === p;
                    const activeColor =
                      p === 'Haute'
                        ? 'bg-red-50 border-red-300 text-red-800'
                        : p === 'Normale'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-slate-100 border-slate-300 text-slate-900';
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDraftPriority(p)}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                          active
                            ? activeColor
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editingTodo && (
                <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draftDone}
                    onChange={(e) => setDraftDone(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Tâche terminée
                  </span>
                </label>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              {editingTodo ? (
                <button
                  type="button"
                  onClick={handleDeleteFromModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !draftTitle.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors"
                >
                  {saving
                    ? 'Enregistrement...'
                    : editingTodo
                    ? 'Enregistrer'
                    : 'Créer la tâche'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
