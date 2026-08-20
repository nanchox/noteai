"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { notesApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import {
  Plus, Search, Pin, Trash2, Upload, X, FolderOpen,
  ChevronDown, Eye, Pencil, PenLine, Minus, RotateCcw,
  Download, Save, Check, Eraser
} from "lucide-react";
import clsx from "clsx";

// ── Canvas de dibujo inline ──────────────────────────────────
const COLORS = ["#ffffff","#6366f1","#a78bfa","#22c55e","#f59e0b","#ef4444","#06b6d4","#ec4899","#000000"];

function DrawCanvas({ noteId, onSaved }: { noteId: string; onSaved: (url: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<"pen"|"eraser">("pen");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(4);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState(false);
  const lastPos = useRef<{x:number;y:number}|null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory(ctx, canvas);
  }, []);

  const pushHistory = (ctx?: CanvasRenderingContext2D, canvas?: HTMLCanvasElement) => {
    const c = canvas || canvasRef.current; if (!c) return;
    const x = ctx || c.getContext("2d")!;
    setHistory(prev => [...prev.slice(-20), x.getImageData(0, 0, c.width, c.height)]);
  };

  const getPos = (e: React.TouchEvent|React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width/rect.width, sy = canvas.height/rect.height;
    if ("touches" in e) return { x:(e.touches[0].clientX-rect.left)*sx, y:(e.touches[0].clientY-rect.top)*sy };
    return { x:((e as React.MouseEvent).clientX-rect.left)*sx, y:((e as React.MouseEvent).clientY-rect.top)*sy };
  };

  const getCtx = () => {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return null;
    ctx.lineJoin="round"; ctx.lineCap="round";
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.strokeStyle = tool==="eraser" ? (isDark?"#1a1a1a":"#ffffff") : color;
    ctx.lineWidth = tool==="eraser" ? size*3 : size;
    return ctx;
  };

  const start = (e: React.TouchEvent|React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    setDrawing(true); lastPos.current = getPos(e, canvas);
  };

  const move = (e: React.TouchEvent|React.MouseEvent) => {
    e.preventDefault(); if (!drawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = getCtx(); if (!ctx) return;
    const pos = getPos(e, canvas), last = lastPos.current||pos;
    ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(pos.x,pos.y); ctx.stroke();
    lastPos.current = pos;
  };

  const end = (e: React.TouchEvent|React.MouseEvent) => {
    e.preventDefault(); if (!drawing) return;
    setDrawing(false); lastPos.current = null; pushHistory();
  };

  const undo = () => {
    const canvas = canvasRef.current; if (!canvas||history.length<2) return;
    canvas.getContext("2d")!.putImageData(history[history.length-2],0,0);
    setHistory(h=>h.slice(0,-1));
  };

  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.fillStyle = isDark?"#1a1a1a":"#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height); pushHistory();
  };

  const saveDrawing = async () => {
    const canvas = canvasRef.current; if (!canvas||saving) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve,reject) =>
        canvas.toBlob(b=>b?resolve(b):reject(new Error("vacío")),"image/png",0.92)
      );
      const file = new File([blob], `dibujo-${Date.now()}.png`, {type:"image/png"});
      const imgRecord = await notesApi.uploadImage(noteId, file);
      onSaved(imgRecord.public_url);
    } finally { setSaving(false); }
  };

  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      {/* Toolbar del canvas */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border flex-wrap" style={{backgroundColor:"var(--color-surface)"}}>
        <div className="flex bg-surface-card border border-surface-border rounded-lg p-0.5 gap-0.5">
          <button onClick={()=>setTool("pen")} className={clsx("p-1.5 rounded-md transition-colors", tool==="pen"?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={()=>setTool("eraser")} className={clsx("p-1.5 rounded-md transition-colors", tool==="eraser"?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={()=>setSize(s=>Math.max(1,s-2))} className="p-1 text-gray-500 hover:text-white"><Minus className="w-3 h-3" /></button>
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="rounded-full" style={{width:Math.min(size*2,22),height:Math.min(size*2,22),backgroundColor:color}} />
          </div>
          <button onClick={()=>setSize(s=>Math.min(30,s+2))} className="p-1 text-gray-500 hover:text-white"><Plus className="w-3 h-3" /></button>
        </div>
        <div className="flex gap-1.5">
          {COLORS.map(c=>(
            <button key={c} onClick={()=>{setColor(c);setTool("pen");}}
              className={clsx("w-4 h-4 rounded-full border-2 transition-transform hover:scale-110",color===c&&tool==="pen"?"border-white scale-125":"border-transparent")}
              style={{backgroundColor:c}} />
          ))}
        </div>
        <div className="flex-1"/>
        <button onClick={undo} className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors"><RotateCcw className="w-3.5 h-3.5"/></button>
        <button onClick={clear} className="p-1.5 text-gray-500 hover:text-danger rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
        <button onClick={saveDrawing} disabled={saving}
          className="flex items-center gap-1 text-xs bg-primary hover:bg-primary-dark disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors">
          {saving ? <><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>Guardando...</> : <><Save className="w-3 h-3"/>Insertar</>}
        </button>
      </div>
      <canvas ref={canvasRef} width={1200} height={600}
        className="w-full touch-none cursor-crosshair"
        style={{maxHeight:"300px"}}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
    </div>
  );
}

// ── Página de notas ──────────────────────────────────────────
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
  const [showDraw, setShowDraw] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout>();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { supabase.auth.getSession().then(({data})=>{ if(data.session) setReady(true); }); }, []);

  const loadNotes = useCallback(async () => {
    if (!ready) return;
    try {
      const params: any = {};
      if (activeProject) params.project_id = activeProject;
      if (search) params.search = search;
      setNotes(await notesApi.list(params));
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }, [activeProject, search, ready]);

  useEffect(()=>{ loadNotes(); },[loadNotes]);
  useEffect(()=>{ if(ready) projectsApi.list().then(setProjects).catch(console.error); },[ready]);

  useEffect(()=>{
    const id = searchParams.get("id");
    if(id && ready) notesApi.get(id).then(setSelectedNote).catch(console.error);
  },[searchParams, ready]);

  useEffect(()=>{
    if(selectedNote) { setPreviewMode((selectedNote.content?.length||0)>200); setShowDraw(false); }
  },[selectedNote?.id]);

  const handleNoteChange = (field: string, value: string) => {
    if(!selectedNote) return;
    const noteId = selectedNote.id;
    setSelectedNote((n:any)=>({...n,[field]:value}));
    setNotes(prev=>prev.map(n=>n.id===noteId?{...n,[field]:value}:n));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async()=>{
      setSaving(true);
      try { await notesApi.update(noteId,{[field]:value}); } finally { setSaving(false); }
    },800);
  };

  const createNote = async() => {
    const note = await notesApi.create({project_id:activeProject});
    setNotes(prev=>[note,...prev]); setSelectedNote(note); setPreviewMode(false);
  };
  const deleteNote = async(id:string)=>{ await notesApi.delete(id); setNotes(prev=>prev.filter(n=>n.id!==id)); if(selectedNote?.id===id) setSelectedNote(null); };
  const togglePin = async(note:any)=>{ const u=await notesApi.update(note.id,{is_pinned:!note.is_pinned}); setNotes(prev=>prev.map(n=>n.id===note.id?u:n)); setSelectedNote(u); };

  const handleImageUpload = async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0]; if(!file||!selectedNote) return;
    const img=await notesApi.uploadImage(selectedNote.id,file);
    handleNoteChange("content",(selectedNote.content||"")+`\n![${img.file_name}](${img.public_url})\n`);
  };

  const onDrawSaved = (url: string) => {
    handleNoteChange("content",(selectedNote.content||"")+`\n![dibujo](${url})\n`);
    setShowDraw(false);
  };

  return (
    <div className="flex h-full animate-fade-in">
      {/* Lista */}
      <div className={clsx("flex flex-col border-r border-surface-border",
        selectedNote?"hidden md:flex w-72 shrink-0":"flex-1 md:w-72 md:shrink-0"
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
            <input type="search" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50"
              style={{color:"var(--color-text)"}} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={()=>setActiveProject(null)}
              className={clsx("shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                !activeProject?"bg-primary/20 border-primary/50 text-primary-light":"border-surface-border hover:text-white")}
              style={activeProject?{color:"var(--color-text-muted)"}:{}}>Todas</button>
            {projects.map(p=>(
              <button key={p.id} onClick={()=>setActiveProject(p.id)}
                className={clsx("shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                  activeProject===p.id?"bg-primary/20 border-primary/50 text-primary-light":"border-surface-border hover:text-white")}
                style={activeProject!==p.id?{color:"var(--color-text-muted)"}:{}}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>}
          {!loading && notes.length===0 && (
            <div className="p-4 text-center">
              <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Sin notas</p>
              <button onClick={createNote} className="mt-2 text-xs text-primary-light hover:underline">+ Nueva nota</button>
            </div>
          )}
          {notes.map(note=>(
            <button key={note.id} onClick={()=>setSelectedNote(note)}
              className={clsx("w-full text-left px-4 py-3 border-b border-surface-border hover:bg-surface-hover transition-colors",
                selectedNote?.id===note.id&&"bg-surface-hover")}>
              <p className="text-sm font-medium truncate flex items-center gap-1" style={{color:"var(--color-text)"}}>
                {note.is_pinned&&<Pin className="w-3 h-3 text-accent shrink-0"/>}
                {note.title||"Sin título"}
              </p>
              {note.content&&<p className="text-xs mt-0.5 line-clamp-2" style={{color:"var(--color-text-subtle)"}}>{note.content.replace(/[#*`_\[\]!]/g,"").slice(0,80)}</p>}
              {note.projects&&<span className="text-xs mt-0.5 inline-block" style={{color:note.projects.color}}>{note.projects.icon} {note.projects.name}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      {selectedNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border flex-wrap">
            <button onClick={()=>setSelectedNote(null)} className="md:hidden" style={{color:"var(--color-text-subtle)"}}>
              <ChevronDown className="w-5 h-5 rotate-90"/>
            </button>
            <div className="relative">
              <select value={selectedNote.project_id||""} onChange={e=>handleNoteChange("project_id",e.target.value||"")}
                className="appearance-none bg-surface border border-surface-border rounded-lg pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:border-primary/50"
                style={{color:"var(--color-text-muted)"}}>
                <option value="">Sin proyecto</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
              <FolderOpen className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{color:"var(--color-text-subtle)"}}/>
            </div>
            <div className="flex-1"/>
            {saving&&<span className="text-xs animate-pulse" style={{color:"var(--color-text-subtle)"}}>Guardando...</span>}

            {/* Toggle edit/preview */}
            <div className="flex bg-surface border border-surface-border rounded-lg p-0.5">
              <button onClick={()=>{setPreviewMode(false);setShowDraw(false);}}
                className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  !previewMode&&!showDraw?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
                <Pencil className="w-3 h-3"/> Editar
              </button>
              <button onClick={()=>{setPreviewMode(true);setShowDraw(false);}}
                className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  previewMode?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
                <Eye className="w-3 h-3"/> Vista
              </button>
              {/* Botón pincel */}
              <button onClick={()=>{setShowDraw(v=>!v);setPreviewMode(false);}}
                className={clsx("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  showDraw?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}
                title="Insertar dibujo a mano alzada">
                <PenLine className="w-3 h-3"/> Dibujar
              </button>
            </div>

            <button onClick={()=>togglePin(selectedNote)}
              className={clsx("p-1.5 rounded-lg transition-colors",selectedNote.is_pinned?"text-accent":"text-gray-500 hover:text-white")}>
              <Pin className="w-4 h-4"/>
            </button>
            <button onClick={()=>fileInput.current?.click()} className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors">
              <Upload className="w-4 h-4"/>
            </button>
            <button onClick={()=>deleteNote(selectedNote.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-danger transition-colors">
              <Trash2 className="w-4 h-4"/>
            </button>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload}/>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 md:px-8 pt-6 pb-2">
              <input type="text" value={selectedNote.title} onChange={e=>handleNoteChange("title",e.target.value)}
                placeholder="Título de la nota"
                className="w-full bg-transparent text-2xl font-bold placeholder-gray-600 focus:outline-none"
                style={{color:"var(--color-text)"}}/>
            </div>

            {/* Canvas de dibujo inline */}
            {showDraw && (
              <div className="px-4 md:px-8 pb-4">
                <DrawCanvas noteId={selectedNote.id} onSaved={onDrawSaved}/>
              </div>
            )}

            {previewMode ? (
              <div className="px-4 md:px-8 pb-8">
                {selectedNote.content ? (
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:font-bold prose-p:leading-relaxed
                    prose-code:text-accent prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                    prose-pre:bg-surface prose-pre:border prose-pre:border-surface-border prose-pre:rounded-xl
                    prose-blockquote:border-primary/50 prose-blockquote:text-gray-400
                    prose-a:text-primary-light prose-a:no-underline hover:prose-a:underline
                    prose-img:rounded-xl prose-img:border prose-img:border-surface-border prose-img:w-full
                    prose-hr:border-surface-border">
                    <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Sin contenido aún.</p>
                    <button onClick={()=>setPreviewMode(false)} className="mt-2 text-xs text-primary-light hover:underline">Empezar a escribir</button>
                  </div>
                )}
              </div>
            ) : !showDraw && (
              <div className="px-4 md:px-8 pb-8">
                <div className="flex gap-1 mb-3 flex-wrap">
                  {[{l:"H1",i:"# "},{l:"H2",i:"## "},{l:"**B**",i:"**texto**"},{l:"_I_",i:"_texto_"},{l:"- Lista",i:"\n- "},{l:"1. Num",i:"\n1. "},{l:"> Cita",i:"\n> "},{l:"`código`",i:"`código`"}].map(({l,i})=>(
                    <button key={l} onClick={()=>handleNoteChange("content",(selectedNote.content||"")+i)}
                      className="text-xs px-2 py-1 bg-surface border border-surface-border hover:border-primary/30 rounded-md transition-colors font-mono"
                      style={{color:"var(--color-text-muted)"}}>
                      {l}
                    </button>
                  ))}
                </div>
                <textarea value={selectedNote.content} onChange={e=>handleNoteChange("content",e.target.value)}
                  placeholder={"Escribe en Markdown...\n\n# Título\n**negrita** _cursiva_\n- lista"}
                  className="w-full bg-transparent text-sm placeholder-gray-600 focus:outline-none resize-none leading-relaxed font-mono"
                  style={{minHeight:"60vh",color:"var(--color-text)"}} rows={30}/>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center" style={{color:"var(--color-text-subtle)"}}>
          <div className="text-center space-y-2">
            <p className="text-sm">Selecciona o crea una nota</p>
            <button onClick={createNote} className="text-xs text-primary-light hover:underline">+ Nueva nota</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>}>
      <NotesContent/>
    </Suspense>
  );
}
