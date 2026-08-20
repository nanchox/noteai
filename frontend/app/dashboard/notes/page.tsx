"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { notesApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import {
  Plus, Search, Pin, Trash2, Upload, X, FolderOpen,
  ChevronDown, Eye, Pencil
} from "lucide-react";
import clsx from "clsx";

function NotesContent() {
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const loadNotes = useCallback(async () => {
    if (!ready) return;
    try {
      const params: any = {};
      if (activeProject) params.project_id = activeProject;
      if (search) params.search = search;
      const data = await notesApi.list(params);
      setNotes(data);
    } catch (e) {
      console.error("Error cargando notas:", e);
    } finally {
      setLoading(false);
    }
  }, [activeProject, search, ready]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (!ready) return;
    projectsApi.list().then(setProjects).catch(console.error);
  }, [ready]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && ready) notesApi.get(id).then(setSelectedNote).catch(console.error);
  }, [searchParams, ready]);

  // Al abrir una nota larga, empezar en preview
  useEffect(() => {
    if (selectedNote) {
      setPreviewMode((selectedNote.content?.length || 0) > 200);
    }
  }, [selectedNote?.id]);

  const handleNoteChange = (field: string, value: string) => {
    if (!selectedNote) return;
    const noteId = selectedNote.id;
    const updated = { ...selectedNote, [field]: value };
    setSelectedNote(updated);
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, [field]: value } : n));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await notesApi.update(noteId, { [field]: value });
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const createNote = async () => {
    const note = await notesApi.create({ project_id: activeProject });
    setNotes(prev => [note, ...prev]);
    setSelectedNote(note);
    setPreviewMode(false);
  };

  const deleteNote = async (id: string) => {
    await notesApi.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
  };

  const togglePin = async (note: any) => {
    const updated = await notesApi.update(note.id, { is_pinned: !note.is_pinned });
    setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
    setSelectedNote(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNote) return;
    const img = await notesApi.uploadImage(selectedNote.id, file);
    // Insertar imagen como markdown en el contenido
    const imgMd = `\n![${img.file_name}](${img.public_url})\n`;
    handleNoteChange("content", (selectedNote.content || "") + imgMd);
    setSelectedNote((n: any) => ({ ...n, note_images: [...(n.note_images || []), img] }));
  };

  return (
    <div className="flex h-full animate-fade-in">
      {/* Lista de notas */}
      <div className={clsx(
        "flex flex-col border-r border-surface-border bg-surface-card",
        selectedNote ? "hidden md:flex w-72 shrink-0" : "flex-1 md:w-72 md:shrink-0"
      )}>
        <div className="p-4 border-b border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Notas</h2>
            <button onClick={createNote}
              className="w-8 h-8 bg-primary hover:bg-primary-dark rounded-lg flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input type="search" placeholder="Buscar..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setActiveProject(null)}
              className={clsx("shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                !activeProject ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border text-gray-400 hover:text-white")}>
              Todas
            </button>
            {projects.map(p => (
              <button key={p.id} onClick={() => setActiveProject(p.id)}
                className={clsx("shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                  activeProject === p.id ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border text-gray-400 hover:text-white")}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
          {!loading && notes.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">Sin notas</p>
              <button onClick={createNote} className="mt-2 text-xs text-primary-light hover:underline">+ Nueva nota</button>
            </div>
          )}
          {notes.map(note => (
            <button key={note.id} onClick={() => setSelectedNote(note)}
              className={clsx("w-full text-left px-4 py-3 border-b border-surface-border hover:bg-surface-hover transition-colors",
                selectedNote?.id === note.id && "bg-surface-hover")}>
              <p className="text-sm font-medium text-white truncate flex items-center gap-1">
                {note.is_pinned && <Pin className="w-3 h-3 text-accent shrink-0" />}
                {note.title || "Sin título"}
              </p>
              {note.content && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                  {note.content.replace(/[#*`_\[\]]/g, "").slice(0, 80)}
                </p>
              )}
              {note.projects && (
                <span className="text-xs mt-1 inline-block" style={{ color: note.projects.color }}>
                  {note.projects.icon} {note.projects.name}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Editor / Preview */}
      {selectedNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <button onClick={() => setSelectedNote(null)} className="md:hidden text-gray-400 hover:text-white">
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>

            <div className="relative">
              <select value={selectedNote.project_id || ""}
                onChange={e => handleNoteChange("project_id", e.target.value || "")}
                className="appearance-none bg-surface border border-surface-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-primary/50">
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
              <FolderOpen className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
            </div>

            <div className="flex-1" />
            {saving && <span className="text-xs text-gray-500 animate-pulse">Guardando...</span>}

            {/* Toggle preview/edit */}
            <div className="flex bg-surface border border-surface-border rounded-lg p-0.5">
              <button onClick={() => setPreviewMode(false)}
                className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  !previewMode ? "bg-primary/20 text-primary-light" : "text-gray-500 hover:text-white")}>
                <Pencil className="w-3 h-3" /> Editar
              </button>
              <button onClick={() => setPreviewMode(true)}
                className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  previewMode ? "bg-primary/20 text-primary-light" : "text-gray-500 hover:text-white")}>
                <Eye className="w-3 h-3" /> Vista
              </button>
            </div>

            <button onClick={() => togglePin(selectedNote)}
              className={clsx("p-1.5 rounded-lg transition-colors", selectedNote.is_pinned ? "text-accent" : "text-gray-500 hover:text-white")}>
              <Pin className="w-4 h-4" />
            </button>
            <button onClick={() => fileInput.current?.click()}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors">
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={() => deleteNote(selectedNote.id)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-danger transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <input ref={fileInput} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto">
            {/* Título siempre editable */}
            <div className="px-4 md:px-8 pt-6 pb-2">
              <input type="text" value={selectedNote.title}
                onChange={e => handleNoteChange("title", e.target.value)}
                placeholder="Título de la nota"
                className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none"
              />
            </div>

            {previewMode ? (
              /* Vista Markdown renderizada */
              <div className="px-4 md:px-8 pb-8">
                {selectedNote.content ? (
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:text-white prose-headings:font-bold
                    prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                    prose-p:text-gray-200 prose-p:leading-relaxed
                    prose-strong:text-white prose-em:text-gray-300
                    prose-code:text-accent prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                    prose-pre:bg-surface prose-pre:border prose-pre:border-surface-border prose-pre:rounded-xl
                    prose-blockquote:border-primary/50 prose-blockquote:text-gray-400
                    prose-ul:text-gray-200 prose-ol:text-gray-200
                    prose-li:marker:text-primary-light
                    prose-a:text-primary-light prose-a:no-underline hover:prose-a:underline
                    prose-img:rounded-xl prose-img:border prose-img:border-surface-border prose-hr:border-surface-border">
                    <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-600 text-sm">Sin contenido. Cambia a modo edición para escribir.</p>
                    <button onClick={() => setPreviewMode(false)}
                      className="mt-3 text-xs text-primary-light hover:underline flex items-center gap-1 mx-auto">
                      <Pencil className="w-3 h-3" /> Empezar a escribir
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Modo edición */
              <div className="px-4 md:px-8 pb-8">
                {/* Toolbar Markdown rápido */}
                <div className="flex gap-1 mb-3 flex-wrap">
                  {[
                    { label: "H1", insert: "# " },
                    { label: "H2", insert: "## " },
                    { label: "**B**", insert: "**texto**" },
                    { label: "_I_", insert: "_texto_" },
                    { label: "- Lista", insert: "\n- " },
                    { label: "1. Lista", insert: "\n1. " },
                    { label: "> Cita", insert: "\n> " },
                    { label: "`código`", insert: "`código`" },
                  ].map(({ label, insert }) => (
                    <button key={label}
                      onClick={() => handleNoteChange("content", (selectedNote.content || "") + insert)}
                      className="text-xs px-2 py-1 bg-surface border border-surface-border text-gray-400 hover:text-white hover:border-primary/30 rounded-md transition-colors font-mono">
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={selectedNote.content}
                  onChange={e => handleNoteChange("content", e.target.value)}
                  placeholder={"Escribe en Markdown...\n\n# Título\n## Subtítulo\n**negrita** _cursiva_\n- lista\n```código```"}
                  className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none resize-none leading-relaxed font-mono"
                  style={{ minHeight: "60vh" }}
                  rows={30}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-600">
          <div className="text-center space-y-2">
            <p className="text-sm">Selecciona o crea una nota</p>
            <button onClick={createNote} className="text-xs text-primary-light hover:underline">
              + Nueva nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NotesContent />
    </Suspense>
  );
}
