"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Check, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PresupuestosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); }); }, []);

  const load = async () => {
    const [b, c, d] = await Promise.all([
      finanzasApi.budgets.list({ month, year }),
      finanzasApi.categories(),
      finanzasApi.dashboard(month, year),
    ]);
    setBudgets(b); setCategories(c); setDashboard(d);
  };

  useEffect(() => { if (ready) load(); }, [ready, month, year]);

  const saveBudget = async (categoryId: string) => {
    if (!editValue) return;
    setSaving(true);
    try {
      await finanzasApi.budgets.upsert({
        category_id: categoryId,
        monthly_limit: parseFloat(editValue.replace(/\./g, "").replace(",", ".")),
        month, year,
      });
      setEditing(null); setEditValue("");
      load();
    } finally { setSaving(false); }
  };

  // Combinar categorías con gastos reales y presupuestos
  const rows = categories.map(cat => {
    const budget = budgets.find(b => b.category_id === cat.id);
    const spent = dashboard?.by_category?.find((c: any) => c.name === cat.name)?.total || 0;
    const limit = budget ? parseFloat(budget.monthly_limit) : 0;
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    return { ...cat, limit, spent, pct, budget_id: budget?.id };
  }).filter(r => r.spent > 0 || r.limit > 0);

  const unbudgeted = categories.filter(cat =>
    !budgets.find(b => b.category_id === cat.id) &&
    dashboard?.by_category?.find((c: any) => c.name === cat.name)?.total > 0
  );

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Presupuestos</h1>
        <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Límites por categoría</p>
      </div>

      {/* Selector de mes */}
      <div className="flex gap-2">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
          className="w-24 bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}} />
      </div>

      {/* Alertas */}
      {rows.filter(r => r.pct > 90).length > 0 && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
          <p className="text-sm font-medium text-danger flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" /> Presupuestos en alerta
          </p>
          {rows.filter(r => r.pct > 90).map(r => (
            <p key={r.id} className="text-xs text-danger/80">
              {r.icon} {r.name}: {r.pct.toFixed(0)}% usado
            </p>
          ))}
        </div>
      )}

      {/* Categorías con gasto o presupuesto */}
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-center py-8" style={{color:"var(--color-text-subtle)"}}>
            Registra gastos primero para ver las categorías aquí.
          </p>
        )}
        {rows.map(r => (
          <div key={r.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{r.icon}</span>
                <span className="text-sm font-medium" style={{color:"var(--color-text)"}}>{r.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{color:"var(--color-text-subtle)"}}>
                  {COP(r.spent)} {r.limit > 0 ? `/ ${COP(r.limit)}` : ""}
                </span>
                {editing === r.id ? (
                  <div className="flex items-center gap-1">
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveBudget(r.id); if (e.key === "Escape") setEditing(null); }}
                      placeholder="Límite" className="w-28 bg-surface border border-primary/50 rounded-lg px-2 py-1 text-xs focus:outline-none" style={{color:"var(--color-text)"}} />
                    <button onClick={() => saveBudget(r.id)} disabled={saving}
                      className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center transition-colors disabled:opacity-40">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(r.id); setEditValue(r.limit ? String(r.limit) : ""); }}
                    className="text-xs text-primary-light hover:underline">
                    {r.limit > 0 ? "Editar" : "+ Límite"}
                  </button>
                )}
              </div>
            </div>

            {r.limit > 0 ? (
              <>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${r.pct}%`,
                      backgroundColor: r.pct > 90 ? "#ef4444" : r.pct > 70 ? "#f59e0b" : r.color
                    }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{color:"var(--color-text-subtle)"}}>
                    {r.pct.toFixed(0)}% usado
                  </span>
                  <span className={clsx("text-xs font-medium", r.pct > 100 ? "text-danger" : "text-success")}>
                    {r.pct > 100 ? `Excedido ${COP(r.spent - r.limit)}` : `Disponible ${COP(r.limit - r.spent)}`}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs mt-1" style={{color:"var(--color-text-subtle)"}}>Sin límite definido · Gasto: {COP(r.spent)}</p>
            )}
          </div>
        ))}
      </div>

      {/* Categorías sin presupuesto pero con gasto */}
      {unbudgeted.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-warning mb-2">Categorías sin presupuesto asignado:</p>
          <div className="flex flex-wrap gap-2">
            {unbudgeted.map(c => (
              <button key={c.id} onClick={() => { setEditing(c.id); setEditValue(""); }}
                className="text-xs bg-surface border border-surface-border px-2.5 py-1.5 rounded-lg hover:border-primary/30 transition-colors" style={{color:"var(--color-text)"}}>
                {c.icon} {c.name} → Asignar límite
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
