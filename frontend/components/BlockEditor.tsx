"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Image, PenLine,
  Type, Eye, Pencil, Eraser, RotateCcw, Save, X, Minus
} from "lucide-react";
import { notesApi } from "@/lib/api";
import clsx from "clsx";

// ── Tipos de bloque ──────────────────────────────────────────
export type Block =
  | { id: string; type: "text";  content: string }
  | { id: string; type: "image"; url: string; caption?: string }
  | { id: string; type: "draw";  url: string; caption?: string };

const uid = () => Math.random().toString(36).slice(2, 10);

const DRAW_COLORS = ["#ffffff","#6366f1","#a78bfa","#22c55e","#f59e0b","#ef4444","#06b6d4","#000000"];

// ── Canvas de dibujo ─────────────────────────────────────────
function DrawBlock({ block, noteId, onChange, readOnly }: {
  block: Block & { type: "draw" };
  noteId: string;
  onChange: (url: string) => void;
  readOnly: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<"pen"|"eraser">("pen");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(4);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastPos = useRef<{x:number;y:number}|null>(null);

  // Cargar imagen existente al montar
  useEffect(() => {
    if (!block.url || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (block.url.startsWith("http")) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); pushHistory(); };
      img.src = block.url;
    } else {
      pushHistory();
    }
  }, []);

  const pushHistory = () => {
    const c = canvasRef.current; if (!c) return;
    setHistory(prev => [...prev.slice(-20), c.getContext("2d")!.getImageData(0, 0, c.width, c.height)]);
  };

  const getPos = (e: React.TouchEvent|React.MouseEvent, canvas: HTMLCanvasElement) => {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width/r.width, sy = canvas.height/r.height;
    if ("touches" in e) return { x:(e.touches[0].clientX-r.left)*sx, y:(e.touches[0].clientY-r.top)*sy };
    return { x:((e as React.MouseEvent).clientX-r.left)*sx, y:((e as React.MouseEvent).clientY-r.top)*sy };
  };

  const getCtx = () => {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return null;
    ctx.lineJoin="round"; ctx.lineCap="round";
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.strokeStyle = tool==="eraser"?(isDark?"#1a1a1a":"#ffffff"):color;
    ctx.lineWidth = tool==="eraser"?size*3:size;
    return ctx;
  };

  const start = (e: React.TouchEvent|React.MouseEvent) => {
    if (readOnly) return; e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    setDrawing(true); lastPos.current = getPos(e, c);
  };

  const move = (e: React.TouchEvent|React.MouseEvent) => {
    if (readOnly || !drawing) return; e.preventDefault();
    const c = canvasRef.current; if (!c) return;
    const ctx = getCtx(); if (!ctx) return;
    const pos = getPos(e,c), last = lastPos.current||pos;
    ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(pos.x,pos.y); ctx.stroke();
    lastPos.current = pos; setDirty(true);
  };

  const end = (e: React.TouchEvent|React.MouseEvent) => {
    if (!drawing) return; e.preventDefault();
    setDrawing(false); lastPos.current = null; pushHistory();
  };

  const undo = () => {
    const c = canvasRef.current; if (!c||history.length<2) return;
    c.getContext("2d")!.putImageData(history[history.length-2],0,0);
    setHistory(h=>h.slice(0,-1)); setDirty(true);
  };

  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.fillStyle = isDark?"#1a1a1a":"#ffffff"; ctx.fillRect(0,0,c.width,c.height);
    pushHistory(); setDirty(true);
  };

  const save = async () => {
    const c = canvasRef.current; if (!c||saving) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((res,rej) => c.toBlob(b=>b?res(b):rej(),"image/png",0.92));
      const file = new File([blob],`draw-${Date.now()}.png`,{type:"image/png"});
      const img = await notesApi.uploadImage(noteId, file);
      onChange(img.public_url);
      setDirty(false);
    } finally { setSaving(false); }
  };

  if (readOnly && block.url) {
    return (
      <div className="rounded-xl overflow-hidden border border-surface-border">
        <img src={block.url} alt={block.caption||"Dibujo"} className="w-full" />
        {block.caption && <p className="text-xs text-center py-1.5" style={{color:"var(--color-text-subtle)"}}>{block.caption}</p>}
      </div>
    );
  }

  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border flex-wrap" style={{backgroundColor:"var(--color-surface)"}}>
        <div className="flex bg-surface-card border border-surface-border rounded-lg p-0.5 gap-0.5">
          <button onClick={()=>setTool("pen")} className={clsx("p-1.5 rounded-md transition-colors",tool==="pen"?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
            <Pencil className="w-3.5 h-3.5"/>
          </button>
          <button onClick={()=>setTool("eraser")} className={clsx("p-1.5 rounded-md transition-colors",tool==="eraser"?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
            <Eraser className="w-3.5 h-3.5"/>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={()=>setSize(s=>Math.max(1,s-2))} className="p-1 text-gray-500 hover:text-white"><Minus className="w-3 h-3"/></button>
          <div className="w-5 h-5 flex items-center justify-center">
            <div className="rounded-full" style={{width:Math.min(size*2,18),height:Math.min(size*2,18),backgroundColor:color}}/>
          </div>
          <button onClick={()=>setSize(s=>Math.min(30,s+2))} className="p-1 text-gray-500 hover:text-white"><Plus className="w-3 h-3"/></button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {DRAW_COLORS.map(c=>(
            <button key={c} onClick={()=>{setColor(c);setTool("pen");}}
              className={clsx("w-4 h-4 rounded-full border-2 transition-transform hover:scale-110",color===c&&tool==="pen"?"border-white scale-125":"border-transparent")}
              style={{backgroundColor:c}}/>
          ))}
        </div>
        <div className="flex-1"/>
        <button onClick={undo} className="p-1.5 text-gray-500 hover:text-white rounded-lg"><RotateCcw className="w-3.5 h-3.5"/></button>
        <button onClick={clear} className="p-1.5 text-gray-500 hover:text-danger rounded-lg"><Trash2 className="w-3.5 h-3.5"/></button>
        {dirty && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1 text-xs bg-primary hover:bg-primary-dark disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors">
            {saving?<><div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>Guardando...</>:<><Save className="w-3 h-3"/>Guardar</>}
          </button>
        )}
      </div>
      <canvas ref={canvasRef} width={1200} height={500}
        className="w-full touch-none cursor-crosshair"
        style={{maxHeight:"280px",display:"block"}}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
    </div>
  );
}

// ── Bloque de texto ──────────────────────────────────────────
function TextBlock({ block, onChange, readOnly }: {
  block: Block & { type: "text" };
  onChange: (content: string) => void;
  readOnly: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [block.content, readOnly]);

  if (readOnly) {
    return block.content ? (
      <div className="prose prose-invert prose-sm max-w-none
        prose-headings:font-bold prose-p:leading-relaxed
        prose-code:text-accent prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-surface prose-pre:border prose-pre:border-surface-border prose-pre:rounded-xl
        prose-blockquote:border-primary/50 prose-blockquote:text-gray-400
        prose-a:text-primary-light prose-img:rounded-xl prose-img:w-full
        prose-hr:border-surface-border">
        <ReactMarkdown>{block.content}</ReactMarkdown>
      </div>
    ) : null;
  }

  return (
    <textarea
      ref={ref}
      value={block.content}
      onChange={e => { onChange(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
      placeholder="Escribe aquí... (soporta Markdown)"
      className="w-full bg-transparent text-sm focus:outline-none resize-none leading-relaxed font-mono placeholder-gray-500 min-h-[60px]"
      style={{color:"var(--color-text)"}}
      rows={3}
    />
  );
}

// ── Bloque de imagen ─────────────────────────────────────────
function ImageBlock({ block, noteId, onAdd, onDelete, readOnly }: {
  block: Block & { type: "image" };
  noteId: string;
  onAdd: (url: string) => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const img = await notesApi.uploadImage(noteId, file);
      onAdd(img.public_url);
    } finally { setUploading(false); }
  };

  if (!block.url) {
    return (
      <div className="border-2 border-dashed border-surface-border rounded-xl p-8 flex flex-col items-center gap-3">
        <Image className="w-8 h-8 text-gray-600" />
        <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Toca para subir una foto</p>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="text-xs bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40">
          {uploading ? "Subiendo..." : "Elegir foto"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-surface-border">
      <img src={block.url} alt={block.caption||"Imagen"} className="w-full" />
      {block.caption && <p className="text-xs text-center py-1.5" style={{color:"var(--color-text-subtle)"}}>{block.caption}</p>}
      {!readOnly && (
        <button onClick={onDelete}
          className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ── Menú de agregar bloque ───────────────────────────────────
function AddBlockMenu({ onAdd }: { onAdd: (type: "text"|"image"|"draw") => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-center">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dashed border-surface-border rounded-full hover:border-primary/50 hover:text-primary-light transition-colors"
        style={{color:"var(--color-text-subtle)"}}>
        <Plus className="w-3.5 h-3.5" /> Agregar bloque
      </button>
      {open && (
        <div className="absolute top-full mt-1 z-10 border border-surface-border rounded-xl shadow-xl overflow-hidden animate-slide-up" style={{backgroundColor:"var(--color-surface-card)"}}>
          {[
            { type: "text" as const, icon: Type, label: "Texto" },
            { type: "draw" as const, icon: PenLine, label: "Dibujo a mano" },
            { type: "image" as const, icon: Image, label: "Foto" },
          ].map(({ type, icon: Icon, label }) => (
            <button key={type} onClick={() => { onAdd(type); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-surface-hover transition-colors text-left"
              style={{color:"var(--color-text)"}}>
              <Icon className="w-4 h-4 text-primary-light" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor principal ─────────────────────────────────────────
interface BlockEditorProps {
  noteId: string;
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  readOnly?: boolean;
}

export default function BlockEditor({ noteId, blocks, onChange, readOnly = false }: BlockEditorProps) {
  const addBlock = (type: "text"|"image"|"draw", afterIndex?: number) => {
    const newBlock: Block =
      type === "text"  ? { id: uid(), type: "text", content: "" } :
      type === "draw"  ? { id: uid(), type: "draw", url: "", caption: "" } :
                         { id: uid(), type: "image", url: "", caption: "" };

    const idx = afterIndex !== undefined ? afterIndex + 1 : blocks.length;
    const next = [...blocks];
    next.splice(idx, 0, newBlock);
    onChange(next);
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, ...patch } as Block : b));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const next = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  // Inicializar con un bloque de texto si está vacío
  useEffect(() => {
    if (!readOnly && blocks.length === 0) {
      onChange([{ id: uid(), type: "text", content: "" }]);
    }
  }, []);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={block.id} className="group/block relative">
          {/* Controles del bloque */}
          {!readOnly && (
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity z-10">
              <button onClick={() => moveBlock(block.id, -1)} disabled={i === 0}
                className="w-6 h-6 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => removeBlock(block.id)}
                className="w-6 h-6 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center text-gray-500 hover:text-danger transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
              <button onClick={() => moveBlock(block.id, 1)} disabled={i === blocks.length - 1}
                className="w-6 h-6 bg-surface-card border border-surface-border rounded-lg flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Contenido del bloque */}
          <div className={clsx(
            "rounded-xl pr-8",
            !readOnly && block.type === "text" && "border border-transparent hover:border-surface-border focus-within:border-primary/30 p-3 transition-colors"
          )}>
            {block.type === "text" && (
              <TextBlock block={block} readOnly={readOnly}
                onChange={content => updateBlock(block.id, { content })} />
            )}
            {block.type === "draw" && (
              <DrawBlock block={block} noteId={noteId} readOnly={readOnly}
                onChange={url => updateBlock(block.id, { url })} />
            )}
            {block.type === "image" && (
              <ImageBlock block={block} noteId={noteId} readOnly={readOnly}
                onAdd={url => updateBlock(block.id, { url })}
                onDelete={() => removeBlock(block.id)} />
            )}
          </div>

          {/* Agregar bloque entre bloques */}
          {!readOnly && (
            <div className="py-1 opacity-0 hover:opacity-100 group-hover/block:opacity-100 transition-opacity">
              <AddBlockMenu onAdd={type => addBlock(type, i)} />
            </div>
          )}
        </div>
      ))}

      {/* Agregar al final */}
      {!readOnly && (
        <AddBlockMenu onAdd={type => addBlock(type)} />
      )}
    </div>
  );
}
