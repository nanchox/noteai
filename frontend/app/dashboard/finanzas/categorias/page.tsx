"use client";
import { useEffect, useState } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Plus, Check } from "lucide-react";
import clsx from "clsx";

const COLORS = ["#22c55e","#6366f1","#f59e0b","#ef4444","#06b6d4","#ec4899","#8b5cf6","#f97316","#84cc16","#6b7280"];
const ICONS  = ["🛒","🍽️","🚗","💊","📚","🎬","💡","👕","🏠","🐾","💰","✈️","🎮","💻","🏋️","🌿","🎵","🛠️","💈","🧴"];

export default function CategoriasPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", icon: ICONS[0], color: COLORS[0] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); }); }, []);
  useEffect(() => { if (ready) finanzasApi.categories().then(setCategories); }, [ready]);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // Usamos el endpoint de categories directamente via fetch
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/finanzas/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const cat = await res.json();
      setCategories(prev => [...prev, cat]);
      setForm({ name: "", icon: ICONS[0], color: COLORS[0] });
      setShowForm(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Categorías</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>{categories.length} categorías</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Nueva
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-card border border-primary/30 rounded-xl p-4 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold" style={{color:"var(--color-text)"}}>Nueva categoría</h3>
          <input placeholder="Nombre *" value={form.name}
            onChange={e => setForm(f => ({...f, name: e.target.value}))}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
          <div>
            <p className="text-xs mb-2" style={{color:"var(--color-text-subtle)"}}>Ícono</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(i => (
                <button key={i} onClick={() => setForm(f => ({...f, icon: i}))}
                  className={clsx("w-9 h-9 rounded-lg text-lg border transition-colors",
                    form.icon === i ? "border-primary bg-primary/20" : "border-surface-border hover:border-gray-500")}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs mb-2" style={{color:"var(--color-text-subtle)"}}>Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.color === c ? "white" : "transparent" }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{color:"var(--color-text-subtle)"}}>Vista previa:</span>
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ borderColor: form.color + "40", color: form.color, backgroundColor: form.color + "15" }}>
              {form.icon} {form.name || "Mi categoría"}
            </span>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm px-3 py-2" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
            <button onClick={create} disabled={!form.name.trim() || saving}
              className="flex items-center gap-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" /> {saving ? "Guardando..." : "Crear"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.map(cat => (
          <div key={cat.id} className="bg-surface-card border rounded-xl p-4 flex items-center gap-3"
            style={{ borderColor: cat.color + "30" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: cat.color + "20" }}>
              {cat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{color:"var(--color-text)"}}>{cat.name}</p>
              {cat.is_default && (
                <span className="text-xs" style={{color:"var(--color-text-subtle)"}}>Por defecto</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
