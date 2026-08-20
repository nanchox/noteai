"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Download, Filter } from "lucide-react";
import clsx from "clsx";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const METHODS: Record<string, string> = { efectivo: "💵 Efectivo", debito: "💳 Débito", credito: "🪙 Crédito", transferencia: "📲 Transferencia", otro: "🔄 Otro" };

export default function HistorialPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); }); }, []);

  useEffect(() => {
    if (!ready) return;
    finanzasApi.categories().then(setCategories);
  }, [ready]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await finanzasApi.expenses.list({
        month, year,
        category_id: filterCat || undefined,
      });
      setExpenses(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (ready) load(); }, [ready, month, year, filterCat]);

  // Filtro local por método de pago
  const filtered = filterMethod ? expenses.filter(e => e.payment_method === filterMethod) : expenses;
  const total = filtered.reduce((s, e) => s + parseFloat(e.amount), 0);

  // Agrupar por fecha
  const grouped = filtered.reduce((acc: Record<string, any[]>, e) => {
    const date = e.expense_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(e);
    return acc;
  }, {});

  const exportCSV = () => {
    const rows = [
      ["Fecha","Descripción","Lugar","Categoría","Monto","Método","Registrado por"],
      ...filtered.map(e => [
        e.expense_date,
        e.description,
        e.place || "",
        e.expense_categories?.name || "",
        e.amount,
        e.payment_method,
        e.profiles?.full_name || "",
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gastos-${MONTHS[month-1]}-${year}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Historial</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>{filtered.length} gastos · {COP(total)}</p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="flex items-center gap-1.5 bg-surface-card border border-surface-border hover:border-primary/30 text-sm px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
          style={{color:"var(--color-text-muted)"}}>
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-3.5 h-3.5" style={{color:"var(--color-text-subtle)"}} />
          <span className="text-xs font-semibold" style={{color:"var(--color-text-subtle)"}}>Filtros</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
            <option value="">Todos los métodos</option>
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Lista agrupada por fecha */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-center py-10" style={{color:"var(--color-text-subtle)"}}>Sin gastos en este período</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => {
            const dayTotal = (items as any[]).reduce((s, e) => s + parseFloat(e.amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{color:"var(--color-text-subtle)"}}>
                    {new Date(date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <p className="text-xs font-medium text-danger">{COP(dayTotal)}</p>
                </div>
                <div className="space-y-2">
                  {(items as any[]).map(e => {
                    const cat = e.expense_categories;
                    return (
                      <div key={e.id} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                          style={{ backgroundColor: (cat?.color || "#6b7280") + "20" }}>
                          {cat?.icon || "💰"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{color:"var(--color-text)"}}>{e.description}</p>
                          <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
                            {e.place ? `${e.place} · ` : ""}{METHODS[e.payment_method]?.split(" ")[1] || e.payment_method}
                            {e.profiles ? ` · ${e.profiles.full_name?.split(" ")[0]}` : ""}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-danger shrink-0">{COP(parseFloat(e.amount))}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
