"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notesApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Pencil, Eraser, Trash2, Download, Save,
  Minus, Plus, Palette, RotateCcw, Check
} from "lucide-react";
import clsx from "clsx";

const COLORS = ["#ffffff", "#6366f1", "#a78bfa", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#000000"];
const SIZES = [2, 4, 8, 14, 22];

export default function DrawPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ffffff");
  const [size, setSize] = useState(4);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [title, setTitle] = useState("Nota dibujada");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) projectsApi.list().then(setProjects);
  }, [ready]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // Fondo según tema
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  }, []);

  const getCtx = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return null;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tool === "eraser"
      ? (document.documentElement.getAttribute("data-theme") === "light" ? "#ffffff" : "#1a1a1a")
      : color;
    ctx.lineWidth = tool === "eraser" ? size * 3 : size;
    return ctx;
  };

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    setHistory(prev => [...prev.slice(-20), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e, canvas);
    const last = lastPos.current || pos;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawing) return;
    setDrawing(false);
    lastPos.current = null;
    pushHistory();
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const prev = history[history.length - 2];
    canvas.getContext("2d")!.putImageData(prev, 0, 0);
    setHistory(h => h.slice(0, -1));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${title}.png`;
    a.click();
  };

  const saveAsNote = async () => {
    const canvas = canvasRef.current;
    if (!canvas || saving || !ready) return;
    setSaving(true);
    try {
      // Crear nota
      const note = await notesApi.create({
        title,
        content: `*Nota dibujada a mano alzada*\n\n_Creada desde HaIA Draw_`,
        project_id: selectedProject || null,
        tags: ["dibujo"],
      });

      // Convertir canvas a blob y subir como imagen
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${title}.png`, { type: "image/png" });
        await notesApi.uploadImage(note.id, file);

        // Actualizar contenido con la imagen
        await notesApi.update(note.id, {
          content: `*Nota dibujada a mano alzada*\n\n![${title}](adjunto)`,
        });

        setSaved(true);
        setTimeout(() => router.push(`/dashboard/notes?id=${note.id}`), 1200);
      }, "image/png");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border bg-surface-card flex-wrap shrink-0">
        {/* Título */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50 w-36"
        />

        <div className="w-px h-6 bg-surface-border" />

        {/* Herramientas */}
        <div className="flex bg-surface border border-surface-border rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setTool("pen")}
            className={clsx("p-2 rounded-md transition-colors", tool === "pen" ? "bg-primary/20 text-primary-light" : "text-gray-500 hover:text-white")}>
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setTool("eraser")}
            className={clsx("p-2 rounded-md transition-colors", tool === "eraser" ? "bg-primary/20 text-primary-light" : "text-gray-500 hover:text-white")}>
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Tamaño */}
        <div className="flex items-center gap-1">
          <button onClick={() => setSize(s => Math.max(1, s - 2))}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="w-8 h-8 flex items-center justify-center">
            <div className="rounded-full bg-white"
              style={{ width: Math.min(size * 2.5, 28), height: Math.min(size * 2.5, 28), backgroundColor: color }} />
          </div>
          <button onClick={() => setSize(s => Math.min(30, s + 2))}
            className="p-1.5 text-gray-500 hover:text-white rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Colores */}
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool("pen"); }}
              className={clsx("w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                color === c && tool === "pen" ? "border-white scale-125" : "border-transparent")}
              style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="flex-1" />

        {/* Acciones */}
        <button onClick={undo} title="Deshacer"
          className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-surface-hover transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={clear} title="Limpiar"
          className="p-2 text-gray-500 hover:text-danger rounded-lg hover:bg-surface-hover transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={download} title="Descargar"
          className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-surface-hover transition-colors">
          <Download className="w-4 h-4" />
        </button>

        {/* Proyecto */}
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-primary/50">
          <option value="">Sin proyecto</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
        </select>

        <button onClick={saveAsNote} disabled={saving || saved}
          className={clsx(
            "flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors",
            saved
              ? "bg-success/20 text-success border border-success/30"
              : "bg-primary hover:bg-primary-dark text-white"
          )}>
          {saved ? <><Check className="w-4 h-4" /> Guardado</> : saving
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
            : <><Save className="w-4 h-4" /> Guardar nota</>}
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={2048}
          height={1536}
          className="w-full h-full touch-none cursor-crosshair"
          style={{ imageRendering: "pixelated" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {/* Hint para iOS */}
        {history.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-2 opacity-30">
              <Pencil className="w-12 h-12 mx-auto" />
              <p className="text-sm">Dibuja con el dedo o Apple Pencil</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
