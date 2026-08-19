"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { notesApi, projectsApi } from "@/lib/api";
import {
  Plus, Search, Pin, Trash2, Upload, X, FolderOpen, ChevronDown
} from "lucide-react";
import clsx from "clsx";

export default function NotesPage() {
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout>();
  const fileInput = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async () => {
    const data = await notesApi.list({ project_id: activeProject || undefined, search: search || undefined });
    setNotes(data);
    setLoading(false);
  }, [activeProject, search]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Cargar nota desde URL param
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      notesApi.get(id).then(setSelectedNote);
    }
  }, [searchParams]);

  useEffect(() => {
    projectsApi.list().then(setProjects);
  }, []);

  // Auto-save con debounce 800ms
  const handleNoteChange = (field: string, value: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, [field]: value };
    setSelectedNote(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await notesApi.update(selectedNote.id, { [field]: value });
      setSaving(false);
      setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, [field]: value } : n));
    }, 800);
  };

  const createNote = async () => {
    const note = await notesApi.create({ project_id: activeProject });
    setNotes(prev => [note, ...prev]);
    setSelectedNote(note);
  };

  const deleteNote = async (id: string) => {
    await notesApi.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNote?.id === id) setSelectedNote(null);
  };

  const togglePin = async (note: any) => {
    const updated = await notesApi.update(note.id, { is_pinned: !note.is_pinned });
    setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNote) return;
    const img = await notesApi.uploadImage(selectedNote.id, file);
    setSelectedNote((n: any) => ({ ...n, note_images: [...(n.note_images || []), img] }));
  };

  return (
    <div className="flex h-full animate-fade-in">
      {/* Notes list */}
      <div className={clsx(
        "flex flex-col border-r border-surface-border bg-surface-card",
        selectedNote ? "hidden md:flex w-72 shrink-0" : "flex-1 md:w-72 md:shrink-0"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Notas</h2>
            <button onClick={createNote}
              className="w-8 h-8 bg-primary hover:bg-primary-dark rounded-lg flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="search" placeholder="Buscar..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Project filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-gray-500 p-4">Cargando...</p>}
          {!loading && notes.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">Sin notas</p>
              <button onClick={createNote} className="mt-2 text-xs text-primary-light hover:underline">
                + Nueva nota
              </button>
            </div>
          )}
          {notes.map(note => (
            <button key={note.id} onClick={() => setSelectedNote(note)}
              className={clsx(
                "w-full text-left px-4 py-3 border-b border-surface-border hover:bg-surface-hover transition-colors",
                selectedNote?.id === note.id && "bg-surface-hover"
              )}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate flex items-center gap-1">
                    {note.is_pinned && <Pin className="w-3 h-3 text-accent shrink-0" />}
                    {note.title || "Sin título"}
                  </p>
                  {note.content && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{note.content.slice(0, 100)}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Note editor */}
      {selectedNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
            <button onClick={() => setSelectedNote(null)} className="md:hidden text-gray-400 hover:text-white">
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>

            {/* Project selector */}
            <div className="relative">
              <select
                value={selectedNote.project_id || ""}
                onChange={e => handleNoteChange("project_id", e.target.value || null)}
                className="appearance-none bg-surface border border-surface-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-primary/50"
              >
                <option value="">Sin proyecto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
              <FolderOpen className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
            </div>

            <div className="flex-1" />

            {saving && <span className="text-xs text-gray-500">Guardando...</span>}
            
            <button onClick={() => togglePin(selectedNote)} title="Fijar nota"
              className={clsx("p-1.5 rounded-lg transition-colors", selectedNote.is_pinned ? "text-accent" : "text-gray-500 hover:text-white")}>
              <Pin className="w-4 h-4" />
            </button>
            <button onClick={() => fileInput.current?.click()} title="Subir imagen"
              className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors">
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={() => deleteNote(selectedNote.id)} title="Eliminar"
              className="p-1.5 rounded-lg text-gray-500 hover:text-danger transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <input
              type="text"
              value={selectedNote.title}
              onChange={e => handleNoteChange("title", e.target.value)}
              placeholder="Título de la nota"
              className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none mb-4"
            />
            <textarea
              value={selectedNote.content}
              onChange={e => handleNoteChange("content", e.target.value)}
              placeholder="Empieza a escribir... (soporta Markdown)"
              className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[300px] leading-relaxed"
              rows={20}
            />

            {/* Images */}
            {selectedNote.note_images?.length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-gray-500 mb-3">Imágenes adjuntas</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedNote.note_images.map((img: any) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-surface-border">
                      <img src={img.public_url} alt="" className="w-full h-32 object-cover" />
                      <button
                        onClick={() => notesApi.deleteImage(selectedNote.id, img.id).then(() =>
                          setSelectedNote((n: any) => ({ ...n, note_images: n.note_images.filter((i: any) => i.id !== img.id) }))
                        )}
                        className="absolute top-2 right-2 bg-black/60 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-sm">Selecciona o crea una nota</p>
            <button onClick={createNote} className="mt-2 text-xs text-primary-light hover:underline">
              + Nueva nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
