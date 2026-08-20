"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, AlertTriangle, Sparkles, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

export default function FinanzasPage() {
  const [data, setData] = useState<any>(null);
  const [advice, setAdvice] = useState<string>("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const d = await finanzasApi.dashboard(month, year);
      setData(d);
    } catch (e: any) {
      if (e.message?.includes("familia")) setNeedsSetup(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (ready) loadDashboard(); }, [ready, month, year]);

  const setup = async () => {
    await finanzasApi.setup();
    setNeedsSetup(false);
    loadDashboard();
  };

  const getAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const r = await finanzasApi.advice(month, year);
      setAdvice(r.advice);
    } finally {
      setLoadingAdvice(false);
    }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  if (!ready || loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (needsSetup) return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
        <Wallet className="w-8 h-8 text-primary-light" />
      </div>
      <h2 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Configurar HaIA Finanzas</h2>
      <p className="text-sm max-w-xs" style={{color:"var(--color-text-muted)"}}>
        Esto creará tu espacio familiar compartido con categorías de gastos listas para usar.
      </p>
      <button onClick={setup} className="bg-primary hover:bg-primary-dark text-white font-medium px-6 py-3 rounded-xl transition-colors">
        Comenzar
      </button>
    </div>
  );

  const s = data?.summary || {};
  const isOverspending = s.total_expenses > s.total_income;

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-4xl mx-auto">
      {/* Header + nav mes */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Finanzas</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Control familiar HaIA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-hover transition-colors" style={{color:"var(--color-text-subtle)"}}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold w-20 text-center" style={{color:"var(--color-text)"}}>
            {MONTHS[month-1]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-hover transition-colors" style={{color:"var(--color-text-subtle)"}}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerta de sobregasto */}
      {isOverspending && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
          <div>
            <p className="text-sm font-medium text-danger">Gastos superan los ingresos</p>
            <p className="text-xs text-danger/70">Llevan {COP(s.total_expenses - s.total_income)} por encima del ingreso</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ingresos", value: s.total_income, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
          { label: "Gastos", value: s.total_expenses, icon: TrendingDown, color: "text-danger", bg: "bg-danger/10" },
          { label: "Balance", value: s.balance, icon: Wallet, color: s.balance >= 0 ? "text-success" : "text-danger", bg: s.balance >= 0 ? "bg-success/10" : "bg-danger/10" },
          { label: "Ahorros", value: s.savings_total, icon: PiggyBank, color: "text-accent", bg: "bg-accent/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-4">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${color}`}>{COP(value || 0)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Gráfica por categoría */}
        {data?.by_category?.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4" style={{color:"var(--color-text-muted)"}}>Gastos por categoría</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.by_category} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {data.by_category.map((c: any, i: number) => (
                    <Cell key={i} fill={c.color || `hsl(${i*40},70%,60%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => COP(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Presupuestos */}
        {data?.budget_status?.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{color:"var(--color-text-muted)"}}>Presupuestos</h2>
              <Link href="/dashboard/finanzas/presupuestos" className="text-xs text-primary-light hover:underline">Gestionar</Link>
            </div>
            <div className="space-y-3">
              {data.budget_status.slice(0, 5).map((b: any) => (
                <div key={b.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{color:"var(--color-text)"}}>{b.icon} {b.category}</span>
                    <span style={{color: b.percent > 90 ? "#ef4444" : b.percent > 70 ? "#f59e0b" : "var(--color-text-subtle)"}}>
                      {b.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(b.percent, 100)}%`, backgroundColor: b.percent > 90 ? "#ef4444" : b.percent > 70 ? "#f59e0b" : "#6366f1" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ahorros */}
      {data?.savings?.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{color:"var(--color-text-muted)"}}>Ahorros e inversiones</h2>
            <Link href="/dashboard/finanzas/ahorros" className="text-xs text-primary-light hover:underline">Ver todo</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.savings.map((s: any) => {
              const pct = s.target_amount ? Math.min((s.current_amount / s.target_amount) * 100, 100) : null;
              return (
                <div key={s.name} className="border border-surface-border rounded-xl p-3" style={{borderColor: s.color + "30"}}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-xs font-medium truncate" style={{color:"var(--color-text)"}}>{s.name}</span>
                  </div>
                  <p className="text-sm font-bold" style={{color: s.color}}>{COP(s.current_amount)}</p>
                  {pct !== null && (
                    <div className="mt-2">
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                      </div>
                      <p className="text-xs mt-0.5" style={{color:"var(--color-text-subtle)"}}>{pct.toFixed(0)}% de {COP(s.target_amount)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consejo IA */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-light" />
            <h2 className="text-sm font-semibold" style={{color:"var(--color-text-muted)"}}>Consejo financiero IA</h2>
          </div>
          <button onClick={getAdvice} disabled={loadingAdvice}
            className="flex items-center gap-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary-light border border-primary/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {loadingAdvice
              ? <><div className="w-3 h-3 border border-primary-light border-t-transparent rounded-full animate-spin" />Analizando...</>
              : <><Sparkles className="w-3 h-3" />Analizar</>}
          </button>
        </div>
        {advice
          ? <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{advice}</ReactMarkdown></div>
          : <p className="text-sm text-center py-4" style={{color:"var(--color-text-subtle)"}}>Obtén un análisis personalizado de tus finanzas del mes.</p>
        }
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
        <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
          💡 Usa las pestañas de arriba para navegar entre Gastos, Ingresos, Presupuestos y más.
        </p>
      </div>
    </div>
  );
}
