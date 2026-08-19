"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { notesApi, tasksApi, projectsApi } from "@/lib/api";
import { FileText, CheckSquare, FolderOpen, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function DashboardPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      notesApi.list(),
      tasksApi.list({ completed: false }),
      projectsApi.list(),
    ]).then(([n, t, p]) => {
      setNotes(n.slice(0, 5));
      setTasks(t.slice(0, 5));
      setProjects(p);
    }).finally(() => setLoading(false));
  }, []);

  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date());

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white">Inicio</h1>
        <p className="text-sm text-gray-400">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Notas", value: notes.length, icon: FileText, color: "text-primary-light", href: "/dashboard/notes" },
          { label: "Pendientes", value: tasks.length, icon: CheckSquare, color: "text-success", href: "/dashboard/tasks" },
          { label: "Proyectos", value: projects.length, icon: FolderOpen, color: "text-accent", href: "/dashboard/notes" },
        ].map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}
            className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-2xl font-bold text-white">{value}</span>
            <span className="text-xs text-gray-400">{label}</span>
          </Link>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
          <p className="text-sm font-medium text-danger flex items-center gap-2">
            <Clock className="w-4 h-4" /> {overdue.length} tarea{overdue.length > 1 ? "s" : ""} vencida{overdue.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 space-y-1">
            {overdue.map(t => (
              <li key={t.id} className="text-xs text-gray-300">• {t.title}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent notes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Notas recientes</h2>
          <Link href="/dashboard/notes" className="text-xs text-primary-light flex items-center gap-1 hover:underline">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {notes.length === 0 && (
            <p className="text-sm text-gray-500 bg-surface-card border border-surface-border rounded-xl p-4">
              Sin notas aún. <Link href="/dashboard/notes" className="text-primary-light hover:underline">Crea tu primera nota →</Link>
            </p>
          )}
          {notes.map(n => (
            <Link key={n.id} href={`/dashboard/notes?id=${n.id}`}
              className="block bg-surface-card border border-surface-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{n.title}</p>
                  {n.content && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.content.slice(0, 80)}</p>
                  )}
                </div>
                {n.projects && (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full border"
                    style={{ borderColor: n.projects.color + "40", color: n.projects.color }}>
                    {n.projects.icon} {n.projects.name}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Pending tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Tareas pendientes</h2>
          <Link href="/dashboard/tasks" className="text-xs text-primary-light flex items-center gap-1 hover:underline">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {tasks.length === 0 && (
            <p className="text-sm text-gray-500 bg-surface-card border border-surface-border rounded-xl p-4">
              Sin tareas pendientes. ¡Todo al día! 🎉
            </p>
          )}
          {tasks.map(t => (
            <div key={t.id}
              className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                t.priority === "urgent" ? "bg-danger" :
                t.priority === "high" ? "bg-warning" :
                t.priority === "medium" ? "bg-primary" : "bg-gray-500"
              }`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{t.title}</p>
                {t.due_date && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Vence: {format(new Date(t.due_date), "d MMM", { locale: es })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
