"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, TrendingUp, Check } from "lucide-react";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function IngresosPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [incomes, setIncomes] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); }); }, []);

  const load = async () => {
    const data = await finanzasApi.incomes.list({ month, year });
    setIncomes(data);
  };

  useEffect(() => { if (ready) load(); }, [ready, month, year]);

  const create = async () => {
    if (!form.amount) return;
    setSaving(true);
    try {
      await finanzasApi.incomes.create({
        amount: parseFloat(form.amount.replace(/\./g, "").replace(",", ".")),
        description: form.description || "Ingreso",
        month, year,
      });
      setForm({ amount: "", description: "" });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const total = incomes.reduce((s, i) => s + parseFloat(i.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Ingresos</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Total: {COP(total)}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-success hover:bg-success/80 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {/* Selector de mes */}
      <div className="flex gap-2 flex-wrap">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
          className="w-24 bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}} />
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-surface-card border border-success/30 rounded-xl p-4 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold" style={{color:"var(--color-text)"}}>Nuevo ingreso</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Monto * (ej: 3.500.000)" value={form.amount}
              onChange={e => setForm(f => ({...f, amount: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-success/50" style={{color:"var(--color-text)"}} />
            <input placeholder="Descripción (ej: Salario)" value={form.description}
              onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-success/50" style={{color:"var(--color-text)"}} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
            <button onClick={create} disabled={!form.amount || saving}
              className="flex items-center gap-1 bg-success hover:bg-success/80 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Resumen del mes */}
      <div className="bg-surface-card border border-success/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>Total {MONTHS[month-1]} {year}</p>
            <p className="text-xl font-bold text-success">{COP(total)}</p>
          </div>
        </div>

        {incomes.length === 0 ? (
          <p className="text-sm text-center py-4" style={{color:"var(--color-text-subtle)"}}>Sin ingresos registrados este mes</p>
        ) : (
          <div className="space-y-2">
            {incomes.map(i => (
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                <div>
                  <p className="text-sm font-medium" style={{color:"var(--color-text)"}}>{i.description || "Ingreso"}</p>
                  <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
                    {i.profiles?.full_name?.split(" ")[0] || "Tú"}
                  </p>
                </div>
                <p className="text-sm font-bold text-success">{COP(parseFloat(i.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
          💡 Los ingresos registrados aquí se usan para calcular el balance mensual y la tasa de gasto en el dashboard financiero.
        </p>
      </div>
    </div>
  );
}
