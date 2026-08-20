"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Check, RefreshCw } from "lucide-react";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
const DAYS = Array.from({length: 28}, (_, i) => i + 1);

export default function GastosFijosPage() {
  const [fixed, setFixed] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", category_id: "", day_of_month: "1" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); }); }, []);

  const load = async () => {
    const [f, c] = await Promise.all([finanzasApi.fixedExpenses.list(), finanzasApi.categories()]);
    setFixed(f); setCategories(c);
  };

  useEffect(() => { if (ready) load(); }, [ready]);

  const create = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    try {
      await finanzasApi.fixedExpenses.create({
        name: form.name,
        amount: parseFloat(form.amount.replace(/\./g, "").replace(",", ".")),
        category_id: form.category_id || null,
        day_of_month: parseInt(form.day_of_month),
      });
      setForm({ name: "", amount: "", category_id: "", day_of_month: "1" });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await finanzasApi.fixedExpenses.delete(id);
    setFixed(prev => prev.filter(f => f.id !== id));
  };

  const total = fixed.reduce((s, f) => s + parseFloat(f.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Gastos fijos</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Total mensual: {COP(total)}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-card border border-primary/30 rounded-xl p-4 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold" style={{color:"var(--color-text)"}}>Nuevo gasto fijo</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nombre * (ej: Arriendo)" value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="col-span-2 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
            <input placeholder="Monto *" value={form.amount}
              onChange={e => setForm(f => ({...f, amount: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
            <select value={form.day_of_month} onChange={e => setForm(f => ({...f, day_of_month: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
              {DAYS.map(d => <option key={d} value={d}>Día {d}</option>)}
            </select>
            <select value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))}
              className="col-span-2 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
            <button onClick={create} disabled={!form.name || !form.amount || saving}
              className="flex items-center gap-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
        <RefreshCw className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
          Los gastos fijos se descuentan automáticamente del balance mensual sin necesidad de registrarlos cada mes.
        </p>
      </div>

      {/* Lista */}
      {fixed.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Sin gastos fijos registrados</p>
          <button onClick={() => setShowForm(true)} className="text-xs text-primary-light hover:underline">+ Agregar arriendo, servicios, colegios...</button>
        </div>
      ) : (
        <div className="space-y-2">
          {fixed.map(f => {
            const cat = f.expense_categories;
            return (
              <div key={f.id} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: (cat?.color || "#6366f1") + "20" }}>
                  {cat?.icon || "🔄"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{color:"var(--color-text)"}}>{f.name}</p>
                  <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
                    {cat?.name || "Sin categoría"} · Día {f.day_of_month} de cada mes
                  </p>
                </div>
                <p className="text-sm font-bold" style={{color:"var(--color-text)"}}>{COP(parseFloat(f.amount))}</p>
                <button onClick={() => remove(f.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-danger rounded-lg transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* Total */}
          <div className="bg-surface-card border border-primary/20 rounded-xl px-4 py-3 flex justify-between">
            <span className="text-sm font-semibold" style={{color:"var(--color-text)"}}>Total mensual fijo</span>
            <span className="text-sm font-bold text-primary-light">{COP(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
