"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { notesApi, tasksApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { FileText, CheckSquare, FolderOpen, ArrowRight, Clock, TrendingUp, Calendar } from "lucide-react";
import { format, subDays, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f59e0b", medium: "#6366f1", low: "#6b7280"
};

export default function DashboardPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    Promise.all([
      notesApi.list(),
      tasksApi.list(),
      projectsApi.list(),
    ]).then(([n, t, p]) => {
      setNotes(n);
      setTasks(t);
      setProjects(p);
    }).finally(() => setLoading(false));
  }, [ready]);

  const pending = tasks.filter(t => !t.is_completed);
  const overdue = pending.filter(t => t.due_date && new Date(t.due_date) < new Date());
  const dueToday = pending.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const completedTasks = tasks.filter(t => t.is_completed);

  // Actividad últimos 7 días
  const activityData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, "yyyy-MM-dd");
    const notesCount = notes.filter(n =>
      n.updated_at?.startsWith(dayStr)
    ).length;
    const tasksCount = completedTasks.filter(t =>
      t.completed_at?.startsWith(dayStr)
    ).length;
    return {
      label: i === 6 ? "Hoy" : i === 5 ? "Ayer" : format(day, "EEE", { locale: es }),
      notas: notesCount,
      tareas: tasksCount,
      total: notesCount + tasksCount,
    };
  });

  const maxActivity = Math.max(...activityData.map(d => d.total), 1);

  // Stats por proyecto
  const projectStats = projects.map(p => ({
    ...p,
    noteCount: notes.filter(n => n.project_id === p.id).length,
    taskCount: tasks.filter(t => t.project_id === p.id).length,
    doneCount: tasks.filter(t => t.project_id === p.id && t.is_completed).length,
  })).filter(p => p.noteCount > 0 || p.taskCount > 0);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "ahí";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-white">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Notas", value: notes.length, icon: FileText, color: "text-primary-light", bg: "bg-primary/10", href: "/dashboard/notes" },
          { label: "Pendientes", value: pending.length, icon: CheckSquare, color: "text-success", bg: "bg-success/10", href: "/dashboard/tasks" },
          { label: "Proyectos", value: projects.length, icon: FolderOpen, color: "text-accent", bg: "bg-accent/10", href: "/dashboard/projects" },
          { label: "Completadas", value: completedTasks.length, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", href: "/dashboard/tasks" },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}
            className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className="text-2xl font-bold text-white">{value}</span>
            <span className="text-xs text-gray-400">{label}</span>
          </Link>
        ))}
      </div>

      {/* Alertas */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div className="space-y-2">
          {overdue.length > 0 && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
              <p className="text-sm font-medium text-danger flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                {overdue.length} tarea{overdue.length > 1 ? "s" : ""} vencida{overdue.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-1">
                {overdue.slice(0, 3).map(t => (
                  <Link key={t.id} href="/dashboard/tasks"
                    className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                    {t.title}
                    <span className="text-gray-500 ml-auto">{format(new Date(t.due_date), "d MMM", { locale: es })}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {dueToday.length > 0 && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
              <p className="text-sm font-medium text-warning flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" />
                {dueToday.length} tarea{dueToday.length > 1 ? "s" : ""} para hoy
              </p>
              <div className="space-y-1">
                {dueToday.map(t => (
                  <Link key={t.id} href="/dashboard/tasks"
                    className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actividad semanal */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Actividad últimos 7 días</h2>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={activityData} barSize={20} barGap={4}>
            <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, maxActivity + 1]} />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#fff" }}
              formatter={(value: any, name: string) => [value, name === "notas" ? "Notas" : "Tareas"]}
            />
            <Bar dataKey="notas" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
            <Bar dataKey="tareas" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Notas editadas
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> Tareas completadas
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tareas prioritarias */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Tareas prioritarias</h2>
            <Link href="/dashboard/tasks" className="text-xs text-primary-light flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {pending.length === 0 ? (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">¡Sin pendientes! 🎉</p>
              </div>
            ) : (
              pending
                .sort((a, b) => {
                  const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
                })
                .slice(0, 5)
                .map(t => (
                  <Link key={t.id} href="/dashboard/tasks"
                    className="flex items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-4 py-3 hover:border-primary/20 transition-colors">
                    <div className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: PRIORITY_COLORS[t.priority] || "#6b7280" }} />
                    <span className="text-sm text-white truncate flex-1">{t.title}</span>
                    {t.due_date && (
                      <span className={`text-xs shrink-0 ${new Date(t.due_date) < new Date() ? "text-danger" : "text-gray-500"}`}>
                        {format(new Date(t.due_date), "d MMM", { locale: es })}
                      </span>
                    )}
                  </Link>
                ))
            )}
          </div>
        </div>

        {/* Notas recientes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Notas recientes</h2>
            <Link href="/dashboard/notes" className="text-xs text-primary-light flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {notes.length === 0 ? (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">
                  <Link href="/dashboard/notes" className="text-primary-light hover:underline">Crea tu primera nota →</Link>
                </p>
              </div>
            ) : (
              notes.slice(0, 5).map(n => (
                <Link key={n.id} href={`/dashboard/notes?id=${n.id}`}
                  className="block bg-surface-card border border-surface-border rounded-xl px-4 py-3 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate flex-1">{n.title || "Sin título"}</span>
                    {n.projects && (
                      <span className="text-xs shrink-0 px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: n.projects.color + "20", color: n.projects.color }}>
                        {n.projects.icon}
                      </span>
                    )}
                  </div>
                  {n.content && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{n.content.slice(0, 60)}</p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Proyectos activos */}
      {projectStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Proyectos activos</h2>
            <Link href="/dashboard/projects" className="text-xs text-primary-light flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projectStats.slice(0, 4).map(p => {
              const progress = p.taskCount > 0 ? Math.round((p.doneCount / p.taskCount) * 100) : null;
              return (
                <Link key={p.id} href={`/dashboard/notes?project_id=${p.id}`}
                  className="bg-surface-card border rounded-xl p-4 hover:shadow-md transition-all"
                  style={{ borderColor: p.color + "30" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{p.icon}</span>
                    <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-400 mb-2">
                    <span>{p.noteCount} notas</span>
                    <span>{p.doneCount}/{p.taskCount} tareas</span>
                  </div>
                  {progress !== null && (
                    <div className="h-1 bg-surface rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: p.color }} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
