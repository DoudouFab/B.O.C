import React, { useEffect, useState } from 'react';
import {
  Check,
  Maximize2,
  NotebookPen,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { POSTIT_COLOR_PALETTE } from '../data/initialData';
import { NotebookItem, Project } from '../types';
import { deriveLightPostItColors } from '../utils/colorUtils';

interface NotesViewProps {
  projects: Project[];
  selectedProjectId: string;
  notebooks: NotebookItem[];
  onCreateNotebook: (
    note: Omit<NotebookItem, 'id' | 'updatedAt'>
  ) => Promise<string>;
  onUpdateNotebook: (
    id: string,
    patch: Partial<
      Pick<NotebookItem, 'title' | 'content' | 'projectId' | 'color' | 'pinned'>
    >
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
  const [modalNoteId, setModalNoteId] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftProjectId, setDraftProjectId] = useState('general');
  const [draftColor, setDraftColor] = useState(POSTIT_COLOR_PALETTE[0].hex);
  const [draftPinned, setDraftPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const sortedNotebooks = [...notebooks]
    .filter((n) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  const modalNote = modalNoteId
    ? notebooks.find((n) => n.id === modalNoteId) ?? null
    : null;

  useEffect(() => {
    if (modalNote) {
      setDraftTitle(modalNote.title);
      setDraftContent(modalNote.content);
      setDraftProjectId(modalNote.projectId || 'general');
      setDraftColor(modalNote.color || POSTIT_COLOR_PALETTE[0].hex);
      setDraftPinned(modalNote.pinned);
      setSavedNotice(false);
    }
  }, [modalNoteId]);

  useEffect(() => {
    if (!modalNoteId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalNoteId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalNoteId]);

  const getPaletteEntry = (hex: string) =>
    POSTIT_COLOR_PALETTE.find((p) => p.hex.toLowerCase() === hex.toLowerCase()) ??
    POSTIT_COLOR_PALETTE[0];

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const getNoteVisualColors = (projectId: string, fallbackHex: string) => {
    const proj =
      projectId && projectId !== 'general' ? getProject(projectId) : undefined;
    if (proj) {
      return deriveLightPostItColors(proj.color);
    }
    const pal = getPaletteEntry(fallbackHex || '#FEF9C3');
    return { bgHex: pal.hex, borderHex: pal.borderHex };
  };

  const handleNewPostIt = async () => {
    const targetProjectId =
      selectedProjectId === 'all' ? 'general' : selectedProjectId;
    const targetProj = getProject(targetProjectId);
    const nextColor = targetProj
      ? deriveLightPostItColors(targetProj.color).bgHex
      : POSTIT_COLOR_PALETTE[
          notebooks.length % (POSTIT_COLOR_PALETTE.length - 1)
        ].hex;
    const newId = await onCreateNotebook({
      projectId: targetProjectId,
      title: 'Nouveau post-it',
      content: '',
      color: nextColor,
      pinned: false,
    });
    if (newId) {
      setModalNoteId(newId);
    }
  };

  const handleSaveModal = async (closeAfter = false) => {
    if (!modalNote || !draftTitle.trim()) return;
    setSaving(true);
    try {
      await onUpdateNotebook(modalNote.id, {
        title: draftTitle.trim(),
        content: draftContent,
        projectId: draftProjectId || 'general',
        color: draftColor,
        pinned: draftPinned,
      });
      if (closeAfter) {
        setModalNoteId(null);
      } else {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 1800);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFromModal = async () => {
    if (!modalNote) return;
    const idToDelete = modalNote.id;
    setModalNoteId(null);
    await onDeleteNotebook(idToDelete);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Prise de notes · Mur de Post-it
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cliquez sur une case Post-it pour ouvrir le bloc-notes en plein affichage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer les post-it..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={handleNewPostIt}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-sm font-semibold text-white hover:from-amber-600 hover:to-orange-600 shadow-sm shadow-amber-500/25 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau post-it</span>
          </button>
        </div>
      </div>

      {sortedNotebooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedNotebooks.map((note) => {
            const proj = getProject(note.projectId);
            const visualColors = getNoteVisualColors(
              note.projectId,
              note.color || '#FEF9C3'
            );
            return (
              <div
                key={note.id}
                onClick={() => setModalNoteId(note.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setModalNoteId(note.id);
                  }
                }}
                className="group relative rounded-2xl p-5 min-h-[210px] flex flex-col justify-between gap-4 border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                style={{
                  backgroundColor: visualColors.bgHex,
                  borderColor: visualColors.borderHex,
                }}
              >
                <div className="space-y-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {note.title}
                    </h2>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateNotebook(note.id, { pinned: !note.pinned });
                        }}
                        title={note.pinned ? 'Désépingler' : 'Épingler en haut'}
                        className={`p-1 rounded transition-colors ${
                          note.pinned
                            ? 'text-blue-700 bg-white/70'
                            : 'text-slate-500 opacity-75 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-white/60'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className="p-1 rounded text-slate-500 opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        aria-hidden="true"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed line-clamp-5">
                    {note.content.trim()
                      ? note.content
                      : 'Post-it vide — cliquez pour écrire...'}
                  </p>
                </div>

                <div className="pt-3 border-t border-black/10 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  {proj ? (
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10"
                        style={{ backgroundColor: proj.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium text-slate-800">
                        {proj.commune}
                      </span>
                    </span>
                  ) : (
                    <span className="font-medium text-slate-700">Général</span>
                  )}

                  <span className="font-mono tabular-nums shrink-0">
                    {note.updatedAt}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <NotebookPen className="w-9 h-9 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-800">
            Aucun post-it affiché
          </div>
          <p className="text-xs text-slate-500">
            Créez votre premier post-it coloré pour vos mémos de chantier.
          </p>
          <button
            type="button"
            onClick={handleNewPostIt}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer un post-it</span>
          </button>
        </div>
      )}

      {modalNote && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 p-3 sm:p-6 flex items-center justify-center"
          onClick={() => handleSaveModal(true)}
          role="dialog"
          aria-modal="true"
          aria-label={draftTitle || 'Édition du post-it'}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl h-[94dvh] sm:h-[90vh] rounded-xl sm:rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors"
            style={{
              backgroundColor: getNoteVisualColors(draftProjectId, draftColor)
                .bgHex,
              borderColor: getNoteVisualColors(draftProjectId, draftColor)
                .borderHex,
            }}
          >
            <div className="px-5 sm:px-7 py-4 border-b border-black/10 flex flex-wrap items-center justify-between gap-3 bg-white/45">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Titre du post-it..."
                className="flex-1 min-w-[220px] text-lg sm:text-xl font-bold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
              />

              <div className="flex items-center gap-2 shrink-0">
                {savedNotice && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-white/80 px-2.5 py-1 rounded-md">
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistré</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setDraftPinned((v) => !v)}
                  title={draftPinned ? 'Désépingler' : 'Épingler'}
                  className={`p-2 rounded-lg border transition-colors ${
                    draftPinned
                      ? 'border-blue-300 bg-blue-100 text-blue-800'
                      : 'border-black/10 bg-white/75 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Pin className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleDeleteFromModal}
                  title="Supprimer ce post-it"
                  className="p-2 rounded-lg border border-black/10 bg-white/75 text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveModal(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {saving ? 'Sauvegarde...' : 'Enregistrer'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveModal(true)}
                  aria-label="Fermer la fenêtre"
                  className="p-2 rounded-lg border border-black/10 bg-white/75 text-slate-700 hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-7 py-3 border-b border-black/10 flex flex-wrap items-center justify-between gap-4 bg-white/30">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="modal-note-project"
                  className="text-xs font-medium text-slate-700"
                >
                  Chantier :
                </label>
                <select
                  id="modal-note-project"
                  value={draftProjectId}
                  onChange={(e) => {
                    const nextPid = e.target.value;
                    setDraftProjectId(nextPid);
                    const nextProj = getProject(nextPid);
                    if (nextProj) {
                      setDraftColor(deriveLightPostItColors(nextProj.color).bgHex);
                    }
                  }}
                  className="rounded-lg border border-black/15 bg-white/85 px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="general">Général</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.commune}
                    </option>
                  ))}
                </select>
              </div>

              {draftProjectId !== 'general' && getProject(draftProjectId) ? (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-white/65 px-3 py-1.5 rounded-lg border border-black/10">
                  <span
                    className="w-3.5 h-3.5 rounded-sm border border-black/15 shrink-0"
                    style={{
                      backgroundColor: getProject(draftProjectId)?.color,
                    }}
                    aria-hidden="true"
                  />
                  <span>Couleur claire automatique du chantier</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    Couleur :
                  </span>
                  <div className="flex items-center gap-1.5">
                    {POSTIT_COLOR_PALETTE.map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        title={swatch.label}
                        aria-label={`Couleur ${swatch.label}`}
                        onClick={() => setDraftColor(swatch.hex)}
                        className={`w-6 h-6 rounded-md border transition-transform ${
                          draftColor.toLowerCase() === swatch.hex.toLowerCase()
                            ? 'border-slate-900 scale-110 ring-2 ring-slate-900/20'
                            : 'border-slate-300'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 p-5 sm:p-7 flex flex-col min-h-0">
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Saisissez vos notes de terrain, mesures, remarques de réunion..."
                className="flex-1 w-full rounded-xl border border-black/10 bg-white/55 p-5 text-sm sm:text-base text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white/80 resize-none"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
