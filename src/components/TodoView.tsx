import React, { useState } from 'react';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import { Project, TodoItem, TodoPriority } from '../types';

interface TodoViewProps {
  projects: Project[];
  selectedProjectId: string;
  todos: TodoItem[];
  onAddTodo: (todo: Omit<TodoItem, 'id'>) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onDeleteTodo: (id: string) => void;
}

const PRIORITIES: TodoPriority[] = ['Haute', 'Normale', 'Basse'];

export const TodoView: React.FC<TodoViewProps> = ({
  projects,
  selectedProjectId,
  todos,
  onAddTodo,
  onToggleDone,
  onDeleteTodo,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'Toutes' | 'À faire' | 'Terminées'>('Toutes');
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string>(
    selectedProjectId === 'all' ? 'general' : selectedProjectId
  );
  const [priority, setPriority] = useState<TodoPriority>('Normale');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const filtered = todos.filter((t) => {
    const matchesStatus =
      filter === 'Toutes' ||
      (filter === 'À faire' && !t.done) ||
      (filter === 'Terminées' && t.done);
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || t.title.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddTodo({
      projectId: projectId || 'general',
      title: title.trim(),
      priority,
      done: false,
      dueDate,
    });
    setTitle('');
  };

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const openCount = todos.filter((t) => !t.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">To-Do Liste</h1>
          <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
            {openCount} tâche(s) à traiter · {todos.length} au total
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-end gap-3"
      >
        <div className="flex-1 min-w-0">
          <label
            htmlFor="todo-title"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Nouvelle tâche
          </label>
          <input
            id="todo-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Rappeler conducteur pour visite chantier..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="w-full lg:w-52">
          <label
            htmlFor="todo-project"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Chantier
          </label>
          <select
            id="todo-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
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

        <div className="w-full lg:w-36">
          <label
            htmlFor="todo-priority"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Priorité
          </label>
          <select
            id="todo-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TodoPriority)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full lg:w-40">
          <label
            htmlFor="todo-date"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Échéance
          </label>
          <input
            id="todo-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 h-[38px]"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter</span>
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(['Toutes', 'À faire', 'Terminées'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
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
              placeholder="Filtrer les tâches..."
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
                className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onToggleDone(todo.id, !todo.done)}
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

                  <div className="min-w-0 space-y-1">
                    <p
                      className={`text-sm font-medium ${
                        todo.done ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {todo.title}
                    </p>
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
                  onClick={() => onDeleteTodo(todo.id)}
                  aria-label={`Supprimer ${todo.title}`}
                  className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500">
              Aucune tâche à afficher.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
