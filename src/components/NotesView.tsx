import React, { useEffect, useState } from 'react';
import { NotebookPen, Pin, Plus, Search, Trash2, Check } from 'lucide-react';
import { NotebookItem, Project } from '../types';

interface NotesViewProps {
  projects: Project[];
  selectedProjectId: string;
  notebooks: NotebookItem[];
  onCreateNotebook: (note: Omit<NotebookItem, 'id' | 'updatedAt'>) => Promise<string>;
  onUpdateNotebook: (
    id: string,
    patch: Partial<Pick<NotebookItem, 'title' | 'content' | 'projectId' | 'pinned'>>
  ) => Promise<void>;
  onDeleteNotebook: (id: string) => Promise<void>;
}

export const NotesView: React.FC<NotesViewProps> = ({
  projects,
  selectedProjectId,
  notebooks,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
}) => {
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(
    notebooks[0]?.id ?? null
  );

  const sortedNotebooks = [...notebooks]
    .filter((n) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const activeNote =
    sortedNotebooks.find((n) => n.id === activeId) ?? sortedNotebooks[0] ?? null;

  const [draftTitle, setDraftTitle] = useState(activeNote?.title ?? '');
  const [draftContent, setDraftContent] = useState(activeNote?.content ?? '');
  const [draftProjectId, setDraftProjectId] = useState(
    activeNote?.projectId ?? 'general'
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (activeNote) {
      setDraftTitle(activeNote.title);
      setDraftContent(activeNote.content);
      setDraftProjectId(activeNote.projectId);
    }
  }, [activeNote?.id]);

  const handleNewNotebook = async () => {
    const newId = await onCreateNotebook({
      projectId: selectedProjectId === 'all' ? 'general' : selectedProjectId,
      title: 'Nouveau bloc-notes',
      content: '',
      pinned: false,
    });
    setActiveId(newId);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeNote || !draftTitle.trim()) return;
    setSaving(true);
    try {
      await onUpdateNotebook(activeNote.id, {
        title: draftTitle.trim(),
        content: draftContent,
        projectId: draftProjectId || 'general',
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const getProject = (id: string) => projects.find((p) => p.id === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Prise de notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Rangez vos blocs-notes de chantier et mémos personnels au même endroit.
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewNotebook}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau bloc-notes</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un bloc-notes..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[540px]">
            {sortedNotebooks.map((note) => {
              const proj = getProject(note.projectId);
              const isSelected = activeNote?.id === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setActiveId(note.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors space-y-1 ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {note.title}
                    </span>
                    {note.pinned && (
                      <Pin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {proj ? (
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: proj.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{proj.commune}</span>
                      </span>
                    ) : (
                      <span>Général</span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums shrink-0">
                      {note.updatedAt}
                    </span>
                  </div>
                </button>
              );
            })}

            {sortedNotebooks.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                Aucun bloc-notes trouvé.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl flex flex-col">
          {activeNote ? (
            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    required
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    aria-label="Titre du bloc-notes"
                    className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
                    placeholder="Titre du bloc-notes..."
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNotebook(activeNote.id, {
                        pinned: !activeNote.pinned,
                      })
                    }
                    title={activeNote.pinned ? 'Désépingler' : 'Épingler'}
                    className={`p-2 rounded-lg border transition-colors ${
                      activeNote.pinned
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Pin className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteNotebook(activeNote.id);
                      setActiveId(null);
                    }}
                    title="Supprimer ce bloc-notes"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="note-project"
                    className="text-xs font-medium text-slate-500"
                  >
                    Chantier associé :
                  </label>
                  <select
                    id="note-project"
                    value={draftProjectId}
                    onChange={(e) => setDraftProjectId(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="general">Général</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.commune}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  {savedNotice && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="w-3.5 h-3.5" />
                      <span>Enregistré</span>
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    {saving ? 'Sauvegarde...' : 'Enregistrer'}
                  </button>
                </div>
              </div>

              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={15}
                placeholder="Saisissez vos notes de terrain, relevés, remarques de réunion..."
                className="flex-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white resize-y"
              />
            </form>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-3">
              <NotebookPen className="w-8 h-8 text-slate-300" />
              <div className="text-sm font-medium text-slate-700">
                Sélectionnez ou créez un bloc-notes
              </div>
              <button
                type="button"
                onClick={handleNewNotebook}
                className="px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800"
              >
                Créer mon premier bloc-notes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
