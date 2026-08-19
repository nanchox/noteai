"use client";
import { useEffect, useState } from "react";
import { tasksApi, projectsApi } from "@/lib/api";
import { Plus, Check, Trash2, Calendar, Flag } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import clsx from "clsx";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400 border-red-400/40",
  high: "text-orange-400 border-orange-400/40",
  medium: "text-indigo-400 border-indigo-400/40",
  low: "text-gray-400 border-gray-600",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja"
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "", project_id: "" });

  const loadTasks = async () => {
    const data = await tasksApi.list({ completed: filterCompleted, project_id: activeProject || undefined });
    setTasks(data);
  };

  useEffect(() => { loadTasks(); }, [filterCompleted, activeProject]);
  useEffect(() => { projectsApi.list().then(setProjects); }, []);

  const createTask = async () => {
    if (!form.title.trim()) return;
    await tasksApi.create({
      ...form,
      due_date: form.due_date || null,
      project_id: form.project_id || null,
    });
    setForm({ title: "", description: "", priority: "medium", due_date: "", project_id: "" });
    setShowForm(false);
    loadTasks();
  };

  const toggleComplete = async (task: any) => {
    await tasksApi.update(task.id, { is_completed: !task.is_completed });
    loadTasks();
  };

  const deleteTask = async (id: string) => {
    await tasksApi.delete(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Tareas</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCompleted(false)}
          className={clsx("text-xs px-3 py-1.5 rounded-full border transition-colors",
            !filterCompleted ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border text-gray-400 hover:text-white")}>
          Pendientes
        </button>
        <button onClick={() => setFilterCompleted(true)}
          className={clsx("text-xs px-3 py-1.5 rounded-full border transition-colors",
            filterCompleted ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border text-gray-400 hover:text-white")}>
          Completadas
        </button>
        {projects.map(p => (
          <button key={p.id} onClick={() => setActiveProject(activeProject === p.id ? null : p.id)}
            className={clsx("text-xs px-3 py-1.5 rounded-full border transition-colors",
              activeProject === p.id ? "bg-primary/20 border-primary/50 text-primary-light" : "border-surface-border text-gray-400 hover:text-white")}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      {/* New task form */}
      {showForm && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3 animate-slide-up">
          <input
            type="text" placeholder="Título de la tarea *"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
            autoFocus
          />
          <textarea
            placeholder="Descripción (opcional)"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 resize-none"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prioridad</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha límite</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Proyecto</label>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
              <option value="">Sin proyecto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-white px-3 py-2">Cancelar</button>
            <button onClick={createTask} className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Crear tarea
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">{filterCompleted ? "Sin tareas completadas" : "Sin tareas pendientes 🎉"}</p>
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id}
            className={clsx(
              "bg-surface-card border rounded-xl p-4 flex items-start gap-3 group transition-colors",
              task.is_completed ? "border-surface-border opacity-60" : "border-surface-border hover:border-primary/20"
            )}>
            {/* Checkbox */}
            <button onClick={() => toggleComplete(task)}
              className={clsx(
                "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                task.is_completed
                  ? "bg-success border-success"
                  : "border-gray-600 hover:border-success"
              )}>
              {task.is_completed && <Check className="w-3 h-3 text-white" />}
            </button>

            <div className="flex-1 min-w-0">
              <p className={clsx("text-sm font-medium", task.is_completed ? "line-through text-gray-500" : "text-white")}>
                {task.title}
              </p>
              {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={clsx("text-xs border px-2 py-0.5 rounded-full", PRIORITY_COLORS[task.priority])}>
                  <Flag className="w-2.5 h-2.5 inline mr-1" />
                  {PRIORITY_LABELS[task.priority]}
                </span>
                {task.due_date && (
                  <span className={clsx("text-xs flex items-center gap-1",
                    new Date(task.due_date) < new Date() && !task.is_completed ? "text-danger" : "text-gray-400")}>
                    <Calendar className="w-3 h-3" />
                    {format(new Date(task.due_date), "d MMM", { locale: es })}
                  </span>
                )}
                {task.projects && (
                  <span className="text-xs text-gray-500">{task.projects.icon} {task.projects.name}</span>
                )}
              </div>
            </div>

            <button onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-danger transition-all rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
