"use client";
import { useEffect, useState, useRef } from "react";
import { finanzasApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Mic, MicOff, Send, Trash2, Plus, X, Check } from "lucide-react";
import clsx from "clsx";

const COP = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
const METHODS: Record<string, string> = { efectivo: "💵", debito: "💳", credito: "🪙", transferencia: "📲", otro: "🔄" };

export default function GastosPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ amount: "", description: "", category_id: "", payment_method: "efectivo", place: "" });
  const recRef = useRef<any>(null);
  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    Promise.all([finanzasApi.expenses.list({ month, year }), finanzasApi.categories()]).then(([e, c]) => {
      setExpenses(e); setCategories(c);
    });
    // Setup voz
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.lang = "es-CO"; r.continuous = false; r.interimResults = true;
      r.onresult = (e: any) => { const t = Array.from(e.results).map((x: any) => x[0].transcript).join(""); setChatInput(t); };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recRef.current = r;
    }
  }, [ready]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    setChatLoading(true); setChatResult(null);
    try {
      const r = await finanzasApi.expenses.fromChat(chatInput);
      setChatResult(r);
      setExpenses(prev => [r.expense, ...prev]);
      setChatInput("");
    } catch (e: any) {
      setChatResult({ error: e.message });
    } finally { setChatLoading(false); }
  };

  const saveManual = async () => {
    if (!manual.amount || !manual.description) return;
    const e = await finanzasApi.expenses.create({
      ...manual, amount: parseFloat(manual.amount.replace(/\./g, "").replace(",", ".")),
      category_id: manual.category_id || null,
    });
    setExpenses(prev => [e, ...prev]);
    setManual({ amount: "", description: "", category_id: "", payment_method: "efectivo", place: "" });
    setShowManual(false);
  };

  const deleteExpense = async (id: string) => {
    await finanzasApi.expenses.delete(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const toggleVoice = () => {
    if (!recRef.current) return;
    if (listening) { recRef.current.stop(); setListening(false); }
    else { recRef.current.start(); setListening(true); }
  };

  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--color-text)"}}>Gastos</h1>
          <p className="text-sm" style={{color:"var(--color-text-subtle)"}}>Total: {COP(total)}</p>
        </div>
        <button onClick={() => setShowManual(v => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Manual
        </button>
      </div>

      {/* Chat de registro */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold" style={{color:"var(--color-text-muted)"}}>💬 Registrar con lenguaje natural</p>
        <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>Ej: "Gasté 45.000 en el Éxito con débito" o "Almuerzo 25mil pesos"</p>
        {listening && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger/10 border border-danger/20 rounded-lg">
            <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
            <span className="text-xs text-danger">Escuchando...</span>
          </div>
        )}
        <div className="flex gap-2 items-end bg-surface border border-surface-border rounded-xl px-3 py-2 focus-within:border-primary/40 transition-colors">
          <textarea
            value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            placeholder="Describe el gasto..." rows={1}
            className="flex-1 bg-transparent text-sm focus:outline-none resize-none max-h-20 placeholder-gray-500"
            style={{color:"var(--color-text)"}}
          />
          {recRef.current && (
            <button onClick={toggleVoice}
              className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                listening ? "bg-danger/20 text-danger animate-pulse" : "text-gray-500 hover:text-primary-light")}>
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
            className="w-8 h-8 bg-primary hover:bg-primary-dark rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 shrink-0">
            {chatLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
        {chatResult && (
          <div className={clsx("text-sm px-3 py-2 rounded-lg border", chatResult.error ? "bg-danger/10 border-danger/20 text-danger" : "bg-success/10 border-success/20 text-success")}>
            {chatResult.error ? `❌ ${chatResult.error}` : chatResult.message}
          </div>
        )}
      </div>

      {/* Formulario manual */}
      {showManual && (
        <div className="bg-surface-card border border-primary/30 rounded-xl p-4 space-y-3 animate-slide-up">
          <h3 className="text-sm font-semibold" style={{color:"var(--color-text)"}}>Nuevo gasto manual</h3>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Monto *" value={manual.amount} onChange={e => setManual(m => ({...m, amount: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
            <input type="text" placeholder="Descripción *" value={manual.description} onChange={e => setManual(m => ({...m, description: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
            <input type="text" placeholder="Lugar (opcional)" value={manual.place} onChange={e => setManual(m => ({...m, place: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}} />
            <select value={manual.payment_method} onChange={e => setManual(m => ({...m, payment_method: e.target.value}))}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}}>
              {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
            <select value={manual.category_id} onChange={e => setManual(m => ({...m, category_id: e.target.value}))}
              className="col-span-2 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}}>
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowManual(false)} className="text-sm px-3 py-2 transition-colors" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
            <button onClick={saveManual} disabled={!manual.amount || !manual.description}
              className="flex items-center gap-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Check className="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {expenses.length === 0 && (
          <div className="text-center py-10 text-sm" style={{color:"var(--color-text-subtle)"}}>Sin gastos este mes</div>
        )}
        {expenses.map(e => {
          const cat = e.expense_categories;
          const user = e.profiles;
          return (
            <div key={e.id} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: (cat?.color || "#6b7280") + "20" }}>
                {cat?.icon || "💰"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{color:"var(--color-text)"}}>{e.description}</p>
                <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>
                  {e.place && `${e.place} · `}{METHODS[e.payment_method]} {e.payment_method}
                  {user && ` · ${user.full_name?.split(" ")[0]}`}
                  {` · ${e.expense_date}`}
                </p>
              </div>
              <p className="text-sm font-bold text-danger shrink-0">{COP(parseFloat(e.amount))}</p>
              <button onClick={() => deleteExpense(e.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-danger rounded-lg transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
