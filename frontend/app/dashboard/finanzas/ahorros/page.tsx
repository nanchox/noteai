"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Plus, TrendingUp, TrendingDown, Check, X } from "lucide-react";
import clsx from "clsx";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
const TYPES: Record<string, string> = { ahorro: "Ahorro", inversion: "Inversión", fondo_emergencia: "Fondo emergencia", meta: "Meta" };
const ICONS = ["🏦","💰","📈","🏠","🚗","✈️","🎓","💊","🎯","💎"];
const COLORS = ["#22c55e","#6366f1","#f59e0b","#06b6d4","#ec4899","#8b5cf6","#ef4444","#84cc16"];

export default function AhorrosPage() {
  const [savings, setSavings] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showMov, setShowMov] = useState(false);
  const [form, setForm] = useState({ name: "", type: "ahorro", target_amount: "", description: "", color: COLORS[0], icon: ICONS[0] });
  const [mov, setMov] = useState({ amount: "", note: "", type: "deposit" }); // deposit | withdraw

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); }); }, []);
  useEffect(() => { if (ready) finanzasApi.savings.list().then(setSavings); }, [ready]);

  const openSaving = async (s: any) => {
    setSelected(s);
    const m = await finanzasApi.savings.movements(s.id);
    setMovements(m);
  };

  const createSaving = async () => {
    if (!form.name) return;
    const s = await finanzasApi.savings.create({ ...form, target_amount: form.target_amount ? parseFloat(form.target_amount) : null });
    setSavings(prev => [...prev, s]);
    setForm({ name: "", type: "ahorro", target_amount: "", description: "", color: COLORS[0], icon: ICONS[0] });
    setShowNew(false);
  };

  const addMovement = async () => {
    if (!mov.amount || !selected) return;
    const amount = parseFloat(mov.amount) * (mov.type === "withdraw" ? -1 : 1);
    await finanzasApi.savings.addMovement(selected.id, { amount, note: mov.note });
    const updated = { ...selected, current_amount: parseFloat(selected.current_amount) + amount };
    setSelected(updated);
    setSavings(prev => prev.map(s => s.id === selected.id ? updated : s));
    setMovements(prev => [{ amount, note: mov.note, movement_date: new Date().toISOString().slice(0,10) }, ...prev]);
    setMov({ amount: "", note: "", type: "deposit" });
    setShowMov(false);
  };

  const totalSavings = savings.reduce((s, x) => s + parseFloat(x.current_amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Ahorros e inversiones</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Total: {COP(totalSavings)}</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {showNew && (
        <div className="bg-surface-card border border-primary/30 rounded-xl p-4 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold" style={{color:"var(--color-text)"}}>Nuevo ahorro / inversión</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nombre *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="col-span-2 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
            <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
              {Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" placeholder="Meta (opcional)" value={form.target_amount} onChange={e => setForm(f => ({...f, target_amount: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}} />
          </div>
          <div>
            <p className="text-xs mb-2" style={{color:"var(--color-text-subtle)"}}>Ícono</p>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(i => <button key={i} onClick={() => setForm(f => ({...f, icon: i}))}
                className={clsx("w-9 h-9 rounded-lg text-lg border transition-colors", form.icon === i ? "border-primary bg-primary/20" : "border-surface-border")}>{i}</button>)}
            </div>
          </div>
          <div>
            <p className="text-xs mb-2" style={{color:"var(--color-text-subtle)"}}>Color</p>
            <div className="flex gap-2">
              {COLORS.map(c => <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c, borderColor: form.color === c ? "white" : "transparent" }} />)}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="text-sm px-3 py-2" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
            <button onClick={createSaving} disabled={!form.name}
              className="flex items-center gap-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" /> Crear
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savings.map(s => {
          const pct = s.target_amount ? Math.min((s.current_amount / s.target_amount) * 100, 100) : null;
          return (
            <button key={s.id} onClick={() => openSaving(s)}
              className="bg-surface-card border rounded-xl p-4 text-left hover:shadow-md transition-all"
              style={{ borderColor: s.color + "30" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: s.color + "20" }}>{s.icon}</div>
                <div>
                  <p className="text-sm font-semibold" style={{color:"var(--color-text)"}}>{s.name}</p>
                  <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>{TYPES[s.type]}</p>
                </div>
              </div>
              <p className="text-lg font-bold" style={{ color: s.color }}>{COP(parseFloat(s.current_amount))}</p>
              {pct !== null && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                  <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>{pct.toFixed(0)}% · Meta: {COP(s.target_amount)}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detalle ahorro seleccionado */}
      {selected && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selected.icon}</span>
              <h2 className="font-semibold" style={{color:"var(--color-text)"}}>{selected.name}</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setMov({ amount: "", note: "", type: "deposit" }); setShowMov(true); }}
                className="flex items-center gap-1 text-xs bg-success/10 text-success border border-success/20 px-2.5 py-1.5 rounded-lg">
                <TrendingUp className="w-3.5 h-3.5" /> Depositar
              </button>
              <button onClick={() => { setMov({ amount: "", note: "", type: "withdraw" }); setShowMov(true); }}
                className="flex items-center gap-1 text-xs bg-danger/10 text-danger border border-danger/20 px-2.5 py-1.5 rounded-lg">
                <TrendingDown className="w-3.5 h-3.5" /> Retirar
              </button>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg" style={{color:"var(--color-text-subtle)"}}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showMov && (
            <div className="bg-surface border border-surface-border rounded-xl p-3 mb-4 space-y-2">
              <div className="flex gap-2">
                <input type="number" placeholder="Monto *" value={mov.amount} onChange={e => setMov(m => ({...m, amount: e.target.value}))}
                  className="flex-1 bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
                <input placeholder="Nota (opcional)" value={mov.note} onChange={e => setMov(m => ({...m, note: e.target.value}))}
                  className="flex-1 bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMov(false)} className="text-xs px-3 py-1.5" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
                <button onClick={addMovement} disabled={!mov.amount}
                  className={clsx("flex items-center gap-1 text-xs text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-40",
                    mov.type === "deposit" ? "bg-success hover:bg-success/80" : "bg-danger hover:bg-danger/80")}>
                  <Check className="w-3.5 h-3.5" /> {mov.type === "deposit" ? "Depositar" : "Retirar"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {movements.length === 0 && <p className="text-xs text-center py-4" style={{color:"var(--color-text-subtle)"}}>Sin movimientos aún</p>}
            {movements.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <p style={{color:"var(--color-text)"}}>{m.note || (parseFloat(m.amount) > 0 ? "Depósito" : "Retiro")}</p>
                  <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>{m.movement_date}</p>
                </div>
                <p className={parseFloat(m.amount) > 0 ? "text-success font-medium" : "text-danger font-medium"}>
                  {parseFloat(m.amount) > 0 ? "+" : ""}{COP(parseFloat(m.amount))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
