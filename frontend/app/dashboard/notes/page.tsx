"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { notesApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import BlockEditor, { Block } from "@/components/BlockEditor";
import {
  Plus, Search, Pin, Trash2, FolderOpen, ChevronDown, Eye, Pencil
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
  const titleTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
  }, []);

  const loadNotes = useCallback(async () => {
    if (!ready) return;
    try {
      const params: any = {};
      if (activeProject) params.project_id = activeProject;
      if (search) params.search = search;
      setNotes(await notesApi.list(params));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeProject, search, ready]);

  useEffect(() => { loadNotes(); }, [loadNotes]);
  useEffect(() => { if (ready) projectsApi.list().then(setProjects).catch(console.error); }, [ready]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && ready) notesApi.get(id).then(n => { setSelectedNote(n); setPreviewMode(false); }).catch(console.error);
  }, [searchParams, ready]);

  // Auto-save de bloques con debounce
  const saveBlocks = useCallback((noteId: string, blocks: Block[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await notesApi.update(noteId, { blocks }); }
      finally { setSaving(false); }
    }, 800);
  }, []);

  const handleBlocksChange = (blocks: Block[]) => {
    if (!selectedNote) return;
    setSelectedNote((n: any) => ({ ...n, blocks }));
    setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, blocks } : n));
    saveBlocks(selectedNote.id, blocks);
  };

  const handleTitleChange = (title: string) => {
    if (!selectedNote) return;
    setSelectedNote((n: any) => ({ ...n, title }));
    setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, title } : n));
    clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await notesApi.update(selectedNote.id, { title }); }
      finally { setSaving(false); }
    }, 800);
  };

  const createNote = async () => {
    const initialBlocks: Block[] = [{ id: Math.random().toString(36).slice(2), type: "text", content: "" }];
    const note = await notesApi.create({ project_id: activeProject, blocks: initialBlocks });
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
    const u = await notesApi.update(note.id, { is_pinned: !note.is_pinned });
    setNotes(prev => prev.map(n => n.id === note.id ? u : n));
    setSelectedNote(u);
  };

  // Preview de la nota en la lista
  const getNotePreview = (note: any): string => {
    if (!note.blocks?.length) return note.content?.slice(0, 80) || "";
    const textBlock = note.blocks.find((b: Block) => b.type === "text" && (b as any).content);
    return textBlock ? (textBlock as any).content.replace(/[#*`_]/g, "").slice(0, 80) : "📎 Nota con bloques";
  };

  const getNoteIcons = (note: any): string => {
    if (!note.blocks?.length) return "";
    const types = note.blocks.map((b: Block) => b.type);
    const icons = [];
    if (types.includes("draw")) icons.push("✏️");
    if (types.includes("image")) icons.push("📷");
    return icons.join(" ");
  };

  return (
    <div className="flex h-full animate-fade-in">
      {/* Lista de notas */}
      <div className={clsx(
        "flex flex-col border-r border-surface-border",
        selectedNote ? "hidden md:flex w-72 shrink-0" : "flex-1 md:w-72 md:shrink-0"
      )} style={{backgroundColor:"var(--color-surface-card)"}}>

        <div className="p-4 border-b border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{color:"var(--color-text)"}}>Notas</h2>
            <button onClick={createNote} className="w-8 h-8 bg-primary hover:bg-primary-dark rounded-lg flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{color:"var(--color-text-subtle)"}} />
            <input type="search" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50"
              style={{color:"var(--color-text)"}} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setActiveProject(null)}
              className={clsx("shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                !activeProject ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border")}
              style={activeProject ? {color:"var(--color-text-muted)"} : {}}>Todas</button>
            {projects.map(p => (
              <button key={p.id} onClick={() => setActiveProject(p.id)}
                className={clsx("shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                  activeProject === p.id ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border")}
                style={activeProject !== p.id ? {color:"var(--color-text-muted)"} : {}}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>}
          {!loading && notes.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Sin notas</p>
              <button onClick={createNote} className="mt-2 text-xs text-primary-light hover:underline">+ Nueva nota</button>
            </div>
          )}
          {notes.map(note => (
            <button key={note.id} onClick={() => { setSelectedNote(note); setPreviewMode(false); }}
              className={clsx("w-full text-left px-4 py-3 border-b border-surface-border hover:bg-surface-hover transition-colors",
                selectedNote?.id === note.id && "bg-surface-hover")}>
              <p className="text-sm font-medium truncate flex items-center gap-1" style={{color:"var(--color-text)"}}>
                {note.is_pinned && <Pin className="w-3 h-3 text-accent shrink-0" />}
                {note.title || "Sin título"}
                {getNoteIcons(note) && <span className="ml-1 text-xs">{getNoteIcons(note)}</span>}
              </p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{color:"var(--color-text-subtle)"}}>{getNotePreview(note)}</p>
              {note.projects && <span className="text-xs mt-0.5 inline-block" style={{color:note.projects.color}}>{note.projects.icon} {note.projects.name}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Editor de nota */}
      {selectedNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border flex-wrap shrink-0">
            <button onClick={() => setSelectedNote(null)} className="md:hidden" style={{color:"var(--color-text-subtle)"}}>
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>

            <div className="relative">
              <select value={selectedNote.project_id || ""}
                onChange={async e => {
                  const pid = e.target.value || null;
                  setSelectedNote((n: any) => ({ ...n, project_id: pid }));
                  await notesApi.update(selectedNote.id, { project_id: pid });
                }}
                className="appearance-none bg-surface border border-surface-border rounded-lg pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                style={{color:"var(--color-text-muted)"}}>
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
              <FolderOpen className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{color:"var(--color-text-subtle)"}} />
            </div>

            <div className="flex-1" />
            {saving && <span className="text-xs animate-pulse" style={{color:"var(--color-text-subtle)"}}>Guardando...</span>}

            {/* Toggle preview */}
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
            <button onClick={() => deleteNote(selectedNote.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-danger transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            {/* Título */}
            <input type="text" value={selectedNote.title} onChange={e => handleTitleChange(e.target.value)}
              placeholder="Título de la nota"
              className="w-full bg-transparent text-2xl font-bold placeholder-gray-600 focus:outline-none mb-6"
              style={{color:"var(--color-text)"}} />

            {/* Bloques */}
            <BlockEditor
              noteId={selectedNote.id}
              blocks={selectedNote.blocks || []}
              onChange={handleBlocksChange}
              readOnly={previewMode}
            />
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center" style={{color:"var(--color-text-subtle)"}}>
          <div className="text-center space-y-3">
            <p className="text-sm">Selecciona o crea una nota</p>
            <button onClick={createNote} className="text-xs text-primary-light hover:underline">+ Nueva nota con bloques</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>}>
      <NotesContent />
    </Suspense>
  );
}
