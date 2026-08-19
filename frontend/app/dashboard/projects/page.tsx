"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { projectsApi, notesApi, tasksApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  Plus, Pencil, Trash2, FileText, CheckSquare,
  FolderOpen, X, Check
} from "lucide-react";
import clsx from "clsx";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
];

const ICONS = ["📁", "💼", "🎯", "📚", "💡", "🚀", "🏠", "❤️", "🎨", "🔧", "📱", "🌿"];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: COLORS[0], icon: ICONS[0] });
  const [projectStats, setProjectStats] = useState<Record<string, { notes: number; tasks: number; done: number }>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const loadProjects = async () => {
    try {
      const data = await projectsApi.list();
      setProjects(data);
      const stats: Record<string, any> = {};
      await Promise.all(data.map(async (p: any) => {
        const [notes, tasks] = await Promise.all([
          notesApi.list({ project_id: p.id }),
          tasksApi.list({ project_id: p.id }),
        ]);
        stats[p.id] = {
          notes: notes.length,
          tasks: tasks.length,
          done: tasks.filter((t: any) => t.is_completed).length,
        };
      }));
      setProjectStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (ready) loadProjects(); }, [ready]);

  const resetForm = () => {
    setForm({ name: "", description: "", color: COLORS[0], icon: ICONS[0] });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await projectsApi.update(editingId, form);
    } else {
      await projectsApi.create(form);
    }
    resetForm();
    loadProjects();
  };

  const handleEdit = (p: any) => {
    setForm({ name: p.name, description: p.description || "", color: p.color, icon: p.icon });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar proyecto? Las notas y tareas quedarán sin proyecto.")) return;
    await projectsApi.delete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Proyectos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Organiza tus notas y tareas por proyecto</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo proyecto
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-card border border-primary/30 rounded-xl p-5 space-y-4 animate-slide-up">
          <h2 className="text-sm font-semibold text-white">
            {editingId ? "Editar proyecto" : "Nuevo proyecto"}
          </h2>
          <input
            type="text" placeholder="Nombre del proyecto *"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
          />
          <input
            type="text" placeholder="Descripción (opcional)"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
          />

          <div>
            <p className="text-xs text-gray-400 mb-2">Ícono</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(icon => (
                <button key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                  className={clsx("w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors",
                    form.icon === icon ? "border-primary bg-primary/20" : "border-surface-border hover:border-gray-500")}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(color => (
                <button key={color} onClick={() => setForm(f => ({ ...f, color }))}
                  className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all"
                  style={{ backgroundColor: color, borderColor: form.color === color ? "white" : "transparent" }}>
                  {form.color === color && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <span className="text-xs text-gray-500">Vista previa:</span>
            <span className="text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ borderColor: form.color + "40", color: form.color, backgroundColor: form.color + "15" }}>
              {form.icon} {form.name || "Mi proyecto"}
            </span>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white px-3 py-2">
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button onClick={handleSubmit} disabled={!form.name.trim()}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" />
              {editingId ? "Guardar cambios" : "Crear proyecto"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FolderOpen className="w-12 h-12 text-gray-700 mx-auto" />
          <p className="text-gray-400 text-sm">Sin proyectos aún</p>
          <button onClick={() => setShowForm(true)} className="text-xs text-primary-light hover:underline">
            + Crea tu primer proyecto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map(p => {
            const stats = projectStats[p.id];
            const progress = stats?.tasks > 0 ? Math.round((stats.done / stats.tasks) * 100) : null;
            return (
              <div key={p.id}
                className="bg-surface-card border rounded-xl p-5 hover:shadow-lg transition-all group cursor-pointer"
                style={{ borderColor: p.color + "30" }}
                onClick={() => router.push(`/dashboard/notes?project_id=${p.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: p.color + "20" }}>
                      {p.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{p.name}</h3>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleEdit(p)}
                      className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-surface-hover transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-gray-500 hover:text-danger rounded-lg hover:bg-surface-hover transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <FileText className="w-3.5 h-3.5" />
                    {stats?.notes ?? "—"} notas
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <CheckSquare className="w-3.5 h-3.5" />
                    {stats?.done ?? 0}/{stats?.tasks ?? "—"} tareas
                  </div>
                </div>

                {progress !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Progreso</span><span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-surface-border">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: p.color + "15", color: p.color }}>
                    {p.icon} {p.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
