"use client";
import { useEffect, useState } from "react";
import { remindersApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";
import {
  Bell, Plus, Trash2, X, Check, RefreshCw,
  Calendar, Sparkles, ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import clsx from "clsx";

const REPEAT_LABELS: Record<string, string> = {
  daily: "Diario", weekly: "Semanal", monthly: "Mensual"
};

export default function RemindersPage() {
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form, setForm] = useState({
    message: "", remind_at: "", repeat: ""
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const loadUpcoming = async () => {
    try {
      const data = await remindersApi.upcoming();
      setUpcoming(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (ready) loadUpcoming(); }, [ready]);

  const createReminder = async () => {
    if (!form.message.trim() || !form.remind_at) return;
    await remindersApi.create({
      message: form.message,
      remind_at: new Date(form.remind_at).toISOString(),
      repeat: form.repeat || null,
    });
    setForm({ message: "", remind_at: "", repeat: "" });
    setShowForm(false);
    loadUpcoming();
  };

  const dismissReminder = async (id: string) => {
    await remindersApi.dismiss(id);
    setUpcoming(prev => prev.filter(r => r.id !== id));
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const data = await remindersApi.weeklySummary();
      setSummary(data);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Fecha mínima = ahora
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Recordatorios</h1>
          <p className="text-sm text-gray-400 mt-0.5">Próximos 7 días</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-surface-card border border-primary/30 rounded-xl p-5 space-y-4 animate-slide-up">
          <h2 className="text-sm font-semibold text-white">Nuevo recordatorio</h2>
          <input type="text" placeholder="¿De qué quieres que te recuerde? *"
            value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            autoFocus
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Fecha y hora *</label>
              <input type="datetime-local" min={minDateTime}
                value={form.remind_at} onChange={e => setForm(f => ({ ...f, remind_at: e.target.value }))}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Repetir</label>
              <select value={form.repeat} onChange={e => setForm(f => ({ ...f, repeat: e.target.value }))}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                <option value="">No repetir</option>
                <option value="daily">Cada día</option>
                <option value="weekly">Cada semana</option>
                <option value="monthly">Cada mes</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-white px-3 py-2 transition-colors">
              Cancelar
            </button>
            <button onClick={createReminder} disabled={!form.message.trim() || !form.remind_at}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" /> Crear
            </button>
          </div>
        </div>
      )}

      {/* Lista de próximos recordatorios */}
      <div className="space-y-2">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && upcoming.length === 0 && (
          <div className="text-center py-10 bg-surface-card border border-surface-border rounded-xl">
            <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Sin recordatorios próximos</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-primary-light hover:underline">
              + Crear recordatorio
            </button>
          </div>
        )}
        {upcoming.map(r => {
          const dt = new Date(r.remind_at);
          const isOverdue = dt < new Date();
          return (
            <div key={r.id}
              className={clsx("bg-surface-card border rounded-xl p-4 flex items-start gap-3 group",
                isOverdue ? "border-warning/30" : "border-surface-border")}>
              <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                isOverdue ? "bg-warning/10" : "bg-primary/10")}>
                <Bell className={clsx("w-4 h-4", isOverdue ? "text-warning" : "text-primary-light")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{r.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={clsx("text-xs flex items-center gap-1",
                    isOverdue ? "text-warning" : "text-gray-400")}>
                    <Calendar className="w-3 h-3" />
                    {format(dt, "d MMM, HH:mm", { locale: es })}
                  </span>
                  {r.repeat && (
                    <span className="text-xs flex items-center gap-1 text-gray-500">
                      <RefreshCw className="w-2.5 h-2.5" />
                      {REPEAT_LABELS[r.repeat]}
                    </span>
                  )}
                  {r.tasks && <span className="text-xs text-gray-500">📋 {r.tasks.title}</span>}
                  {r.notes && <span className="text-xs text-gray-500">📝 {r.notes.title}</span>}
                </div>
              </div>
              <button onClick={() => dismissReminder(r.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-danger rounded-lg transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Resumen semanal IA */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-light" />
            <h2 className="text-sm font-semibold text-white">Resumen semanal IA</h2>
          </div>
          <button onClick={generateSummary} disabled={summaryLoading}
            className="flex items-center gap-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary-light border border-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {summaryLoading
              ? <><div className="w-3 h-3 border border-primary-light border-t-transparent rounded-full animate-spin" /> Generando...</>
              : <><Sparkles className="w-3 h-3" /> Generar</>
            }
          </button>
        </div>

        {!summary && !summaryLoading && (
          <p className="text-sm text-gray-500 text-center py-4">
            Genera un análisis de tu semana con recomendaciones personalizadas.
          </p>
        )}

        {summary && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Notas editadas", value: summary.stats.notes_edited },
                { label: "Tareas hechas", value: summary.stats.tasks_completed },
                { label: "Pendientes", value: summary.stats.tasks_pending },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface rounded-xl p-3 text-center border border-surface-border">
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {/* Resumen IA */}
            <div className="prose prose-invert prose-sm max-w-none border-t border-surface-border pt-4">
              <ReactMarkdown>{summary.summary}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
