"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { notesApi, tasksApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Search, FileText, CheckSquare, FolderOpen, ArrowRight } from "lucide-react";
import clsx from "clsx";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ notes: any[]; tasks: any[]; projects: any[] }>({ notes: [], tasks: [], projects: [] });
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { setReady(true); inputRef.current?.focus(); }
    });
  }, []);

  useEffect(() => {
    if (!ready || !query.trim()) {
      setResults({ notes: [], tasks: [], projects: [] });
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      const q = query.toLowerCase();
      try {
        const [notes, tasks, projects] = await Promise.all([
          notesApi.list({ search: query }),
          tasksApi.list(),
          projectsApi.list(),
        ]);
        setResults({
          notes: notes.slice(0, 5),
          tasks: tasks.filter((t: any) =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q)
          ).slice(0, 5),
          projects: projects.filter((p: any) =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
          ).slice(0, 3),
        });
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query, ready]);

  const total = results.notes.length + results.tasks.length + results.projects.length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-xl font-bold text-white mb-4">Búsqueda</h1>

      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar notas, tareas, proyectos..."
          className="w-full bg-surface-card border border-surface-border rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
          autoFocus
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results */}
      {query.trim() && !loading && total === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-700" />
          <p className="text-sm">Sin resultados para "{query}"</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Proyectos */}
        {results.projects.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5" /> Proyectos
            </h2>
            <div className="space-y-2">
              {results.projects.map(p => (
                <button key={p.id} onClick={() => router.push(`/dashboard/notes?project_id=${p.id}`)}
                  className="w-full flex items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors text-left">
                  <span className="text-lg">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Notas */}
        {results.notes.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Notas
            </h2>
            <div className="space-y-2">
              {results.notes.map(n => (
                <button key={n.id} onClick={() => router.push(`/dashboard/notes?id=${n.id}`)}
                  className="w-full flex items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors text-left">
                  <FileText className="w-4 h-4 text-primary-light shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{n.title || "Sin título"}</p>
                    {n.content && <p className="text-xs text-gray-400 truncate">{n.content.slice(0, 80)}</p>}
                  </div>
                  {n.projects && (
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: n.projects.color + "20", color: n.projects.color }}>
                      {n.projects.icon}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Tareas */}
        {results.tasks.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" /> Tareas
            </h2>
            <div className="space-y-2">
              {results.tasks.map(t => (
                <button key={t.id} onClick={() => router.push("/dashboard/tasks")}
                  className="w-full flex items-center gap-3 bg-surface-card border border-surface-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors text-left">
                  <div className={clsx("w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                    t.is_completed ? "bg-success border-success" : "border-gray-600")} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx("text-sm font-medium truncate", t.is_completed ? "line-through text-gray-500" : "text-white")}>
                      {t.title}
                    </p>
                    {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                  </div>
                  <span className={clsx("text-xs px-1.5 py-0.5 rounded-full shrink-0",
                    t.priority === "urgent" ? "bg-red-500/10 text-red-400" :
                    t.priority === "high" ? "bg-orange-500/10 text-orange-400" :
                    "bg-indigo-500/10 text-indigo-400")}>
                    {t.priority}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
