"use client";
import { useEffect, useState } from "react";
import { tasksApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Plus, Flag, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import clsx from "clsx";

const COLUMNS = [
  { id: "todo",        label: "Por hacer",   color: "#6366f1", dot: "bg-primary" },
  { id: "in_progress", label: "En progreso", color: "#f59e0b", dot: "bg-warning" },
  { id: "done",        label: "Hecho",       color: "#22c55e", dot: "bg-success" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400 border-red-400/30",
  high:   "text-orange-400 border-orange-400/30",
  medium: "text-indigo-400 border-indigo-400/30",
  low:    "text-gray-400 border-gray-600",
};

function taskToColumn(task: any): string {
  if (task.is_completed) return "done";
  if (task.kanban_status === "in_progress") return "in_progress";
  return "todo";
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    Promise.all([tasksApi.list(), projectsApi.list()]).then(([t, p]) => {
      setTasks(t);
      setProjects(p);
      setLoading(false);
    });
  }, [ready]);

  const getColumnTasks = (colId: string) =>
    tasks.filter(t => taskToColumn(t) === colId);

  const moveTask = async (taskId: string, toColumn: string) => {
    const update: any = {};
    if (toColumn === "done") {
      update.is_completed = true;
      update.completed_at = new Date().toISOString();
    } else {
      update.is_completed = false;
      update.completed_at = null;
      update.kanban_status = toColumn === "in_progress" ? "in_progress" : null;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...update } : t));
    await tasksApi.update(taskId, update);
  };

  const addQuickTask = async (column: string) => {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    const task = await tasksApi.create({
      title: newTitle.trim(),
      priority: "medium",
      is_completed: column === "done",
      kanban_status: column === "in_progress" ? "in_progress" : null,
    });
    setTasks(prev => [task, ...prev]);
    setNewTitle("");
    setAddingTo(null);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragging) moveTask(dragging, colId);
    setDragging(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Kanban</h1>
          <p className="text-xs text-gray-400">{tasks.length} tareas en total</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4 md:p-6">
        <div className="flex gap-4 h-full min-w-max md:min-w-0">
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.id);
            return (
              <div key={col.id}
                className="flex flex-col w-72 md:flex-1 bg-surface-card border border-surface-border rounded-xl overflow-hidden"
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                    <span className="text-xs text-gray-500 bg-surface px-1.5 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-surface-hover transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick add */}
                {addingTo === col.id && (
                  <div className="p-3 border-b border-surface-border">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") addQuickTask(col.id);
                        if (e.key === "Escape") setAddingTo(null);
                      }}
                      placeholder="Título de la tarea..."
                      className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => addQuickTask(col.id)}
                        className="text-xs bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg transition-colors">
                        Agregar
                      </button>
                      <button onClick={() => setAddingTo(null)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {colTasks.length === 0 && addingTo !== col.id && (
                    <div className="text-center py-8 text-gray-600 text-xs">
                      Sin tareas aquí
                    </div>
                  )}
                  {colTasks.map(task => (
                    <div key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      className={clsx(
                        "bg-surface border border-surface-border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:border-primary/20 group",
                        dragging === task.id && "opacity-40"
                      )}
                    >
                      <p className={clsx("text-sm font-medium mb-2", task.is_completed ? "line-through text-gray-500" : "text-white")}>
                        {task.title}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx("text-xs border px-1.5 py-0.5 rounded-full", PRIORITY_COLORS[task.priority])}>
                          <Flag className="w-2.5 h-2.5 inline mr-0.5" />
                          {task.priority === "urgent" ? "Urgente" : task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}
                        </span>
                        {task.due_date && (
                          <span className={clsx("text-xs flex items-center gap-1",
                            new Date(task.due_date) < new Date() && !task.is_completed ? "text-danger" : "text-gray-500")}>
                            <Calendar className="w-3 h-3" />
                            {format(new Date(task.due_date), "d MMM", { locale: es })}
                          </span>
                        )}
                        {task.projects && (
                          <span className="text-xs text-gray-500">{task.projects.icon}</span>
                        )}
                      </div>

                      {/* Move buttons — visible on hover */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter(c => c.id !== col.id).map(c => (
                          <button key={c.id}
                            onClick={() => moveTask(task.id, c.id)}
                            className="text-xs px-2 py-1 rounded-lg border border-surface-border text-gray-400 hover:text-white hover:border-primary/30 transition-colors">
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
