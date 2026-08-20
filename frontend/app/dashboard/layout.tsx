"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { remindersApi, chatApi, notesApi, tasksApi, projectsApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import ReactMarkdown from "react-markdown";
import {
  LayoutDashboard, FileText, CheckSquare, LogOut, Sparkles,
  Bell, FolderOpen, Search, AlarmClock, ChevronLeft, ChevronRight,
  Send, X, Minimize2, Bot, User, Mic, MicOff, Sun, Moon, Wallet, Menu
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard",           label: "Inicio",    icon: LayoutDashboard },
  { href: "/dashboard/projects",  label: "Proyectos", icon: FolderOpen },
  { href: "/dashboard/notes",     label: "Notas",     icon: FileText },
  { href: "/dashboard/tasks",     label: "Tareas",    icon: CheckSquare },
  { href: "/dashboard/finanzas",  label: "Finanzas",  icon: Wallet },
  { href: "/dashboard/reminders", label: "Alertas",   icon: AlarmClock },
];

// ── Búsqueda en sidebar ──────────────────────────────────────
function SidebarSearch({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!query.trim()) { setResults(null); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true); setOpen(true);
      try {
        const q = query.toLowerCase();
        const [notes, tasks, projects] = await Promise.all([
          notesApi.list({ search: query }),
          tasksApi.list(),
          projectsApi.list(),
        ]);
        setResults({
          notes: notes.slice(0, 4),
          tasks: tasks.filter((t: any) => t.title.toLowerCase().includes(q)).slice(0, 4),
          projects: projects.filter((p: any) => p.name.toLowerCase().includes(q)).slice(0, 2),
        });
      } finally { setLoading(false); }
    }, 400);
  }, [query]);

  const go = (href: string) => { router.push(href); setQuery(""); setResults(null); setOpen(false); };
  const total = results ? results.notes.length + results.tasks.length + results.projects.length : 0;

  if (collapsed) return (
    <button onClick={() => {}} className="flex justify-center py-2.5 w-full text-gray-500 hover:text-white hover:bg-surface-hover transition-colors" title="Buscar">
      <Search className="w-4 h-4" />
    </button>
  );

  return (
    <div className="relative px-3 mb-1">
      <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
        <Search className="w-3.5 h-3.5 shrink-0" style={{color:"var(--color-text-subtle)"}} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Escape" && (setQuery(""), setResults(null), setOpen(false))}
          placeholder="Buscar..." className="flex-1 bg-transparent text-xs focus:outline-none placeholder-gray-500 min-w-0"
          style={{color:"var(--color-text)"}} />
        {query && <button onClick={() => { setQuery(""); setResults(null); setOpen(false); }} style={{color:"var(--color-text-subtle)"}}><X className="w-3 h-3" /></button>}
      </div>
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up" style={{backgroundColor:"var(--color-surface-card)"}}>
          {loading && <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
          {!loading && total === 0 && query.trim() && <p className="text-xs text-center py-4" style={{color:"var(--color-text-subtle)"}}>Sin resultados</p>}
          {!loading && results && total > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {results.projects.length > 0 && <>
                <p className="text-xs font-semibold px-3 pt-3 pb-1" style={{color:"var(--color-text-subtle)"}}>Proyectos</p>
                {results.projects.map((p: any) => (
                  <button key={p.id} onClick={() => go(`/dashboard/notes?project_id=${p.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left">
                    <span>{p.icon}</span><span className="text-xs truncate" style={{color:"var(--color-text)"}}>{p.name}</span>
                  </button>
                ))}
              </>}
              {results.notes.length > 0 && <>
                <p className="text-xs font-semibold px-3 pt-2 pb-1" style={{color:"var(--color-text-subtle)"}}>Notas</p>
                {results.notes.map((n: any) => (
                  <button key={n.id} onClick={() => go(`/dashboard/notes?id=${n.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left">
                    <FileText className="w-3.5 h-3.5 text-primary-light shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{color:"var(--color-text)"}}>{n.title || "Sin título"}</p>
                      {n.content && <p className="text-xs truncate" style={{color:"var(--color-text-subtle)"}}>{n.content.replace(/[#*`_]/g,"").slice(0,40)}</p>}
                    </div>
                  </button>
                ))}
              </>}
              {results.tasks.length > 0 && <>
                <p className="text-xs font-semibold px-3 pt-2 pb-1" style={{color:"var(--color-text-subtle)"}}>Tareas</p>
                {results.tasks.map((t: any) => (
                  <button key={t.id} onClick={() => go("/dashboard/tasks")}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left">
                    <div className={clsx("w-3.5 h-3.5 rounded-full border-2 shrink-0", t.is_completed ? "bg-success border-success" : "border-gray-500")} />
                    <p className="text-xs truncate" style={{color:"var(--color-text)"}}>{t.title}</p>
                  </button>
                ))}
              </>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chat flotante ────────────────────────────────────────────
function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "es-CO"; rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: any) => setInput(Array.from(e.results).map((r: any) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  const toggleVoice = () => {
    const rec = recognitionRef.current; if (!rec) return;
    if (listening) { rec.stop(); setListening(false); } else { rec.start(); setListening(true); }
  };

  useEffect(() => {
    if (open && !loaded) chatApi.history(10).then(h => { setMessages(h); setLoaded(true); }).catch(() => setLoaded(true));
  }, [open, loaded]);

  useEffect(() => { if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [messages, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);

  const send = async (text?: string) => {
    const msg = (text || input).trim(); if (!msg || loading) return;
    setInput("");
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
    setMessages(prev => [...prev, { role: "user", content: msg, created_at: new Date().toISOString() }]);
    setLoading(true);
    try {
      const { reply, actions } = await chatApi.send(msg) as any;
      setMessages(prev => [...prev, { role: "assistant", content: reply, actions: actions || [], created_at: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al responder.", created_at: new Date().toISOString() }]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      {/* Panel del chat */}
      <div className={clsx(
        "fixed z-50 flex flex-col border border-surface-border rounded-2xl shadow-2xl transition-all duration-300",
        "bottom-20 right-3 md:bottom-20 md:right-4",
        open ? "w-[calc(100vw-24px)] sm:w-80 md:w-96 h-[60vh] md:h-[520px] opacity-100 scale-100 origin-bottom-right"
             : "w-0 h-0 opacity-0 scale-90 pointer-events-none origin-bottom-right"
      )} style={{backgroundColor:"var(--color-surface-card)"}}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-light" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none" style={{color:"var(--color-text)"}}>Asistente IA</p>
              <p className="text-xs mt-0.5" style={{color:"var(--color-text-subtle)"}}>Escribe o habla</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-hover" style={{color:"var(--color-text-subtle)"}}>
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {!loaded && <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
          {loaded && messages.length === 0 && (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs" style={{color:"var(--color-text-subtle)"}}>Escríbeme o usa el micrófono</p>
              {["¿Qué tareas tengo hoy?", "Crea una nota rápida", "Muéstrame mis pendientes"].map(s => (
                <button key={s} onClick={() => send(s)} className="w-full text-left text-xs bg-surface border border-surface-border px-3 py-2 rounded-lg hover:border-primary/30 transition-colors" style={{color:"var(--color-text-muted)"}}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={clsx("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-primary-light" />
                </div>
              )}
              <div className="max-w-[85%] space-y-1">
                <div className={clsx("rounded-xl px-3 py-2 text-xs",
                  msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-surface border border-surface-border rounded-tl-sm"
                )} style={msg.role !== "user" ? {color:"var(--color-text)"} : {}}>
                  {msg.role === "assistant"
                    ? <div className="prose prose-invert prose-xs max-w-none [&>*]:my-0.5"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    : <p className="whitespace-pre-wrap">{msg.content}</p>}
                </div>
                {msg.actions?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {msg.actions.map((a: any, j: number) => (
                      <span key={j} className="text-xs bg-success/10 border border-success/20 text-success px-2 py-0.5 rounded-full">
                        {a.created === "note" ? "📝" : "✅"} {a.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-gray-300" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-primary-light" />
              </div>
              <div className="bg-surface border border-surface-border rounded-xl rounded-tl-sm px-3 py-2">
                <div className="flex gap-1 items-center h-3">
                  {[0,1,2].map(i => <div key={i} className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-3 pb-3 shrink-0">
          {listening && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-danger/10 border border-danger/20 rounded-lg">
              <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
              <span className="text-xs text-danger">Escuchando...</span>
            </div>
          )}
          <div className="flex gap-2 items-end bg-surface border border-surface-border rounded-xl px-3 py-2 focus-within:border-primary/40 transition-colors">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Escribe aquí..." rows={1}
              className="flex-1 bg-transparent text-xs focus:outline-none resize-none max-h-20 py-0.5 placeholder-gray-500"
              style={{minHeight:"24px", color:"var(--color-text)"}} />
            {recognitionRef.current && (
              <button onClick={toggleVoice} className={clsx("w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0",
                listening ? "bg-danger/20 text-danger animate-pulse" : "text-gray-500 hover:text-primary-light")}>
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="w-6 h-6 bg-primary hover:bg-primary-dark rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 shrink-0">
              <Send className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Botón flotante */}
      <button onClick={() => setOpen(v => !v)}
        className={clsx(
          "fixed z-50 w-12 h-12 md:w-14 md:h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300",
          "bottom-4 right-3 md:bottom-4 md:right-4",
          open ? "bg-surface-card border border-surface-border" : "bg-gradient-to-br from-primary to-accent text-white hover:scale-105"
        )}>
        {open ? <X className="w-5 h-5" style={{color:"var(--color-text-subtle)"}} /> : <Bot className="w-5 h-5 md:w-6 md:h-6" />}
        {!open && <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-surface animate-pulse" />}
      </button>
    </>
  );
}

// ── Layout principal ─────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  // Móvil: colapsado por defecto. Desktop: expandido por defecto.
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // En desktop expandir por defecto
    if (window.innerWidth >= 768) setCollapsed(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/"); return; }
      setUser(data.user);
    });
  }, [router]);

  const checkReminders = useCallback(async () => {
    try { const p = await remindersApi.pending(); if (p.length > 0) setReminders(p); } catch {}
  }, []);

  useEffect(() => {
    checkReminders();
    const i = setInterval(checkReminders, 60_000);
    return () => clearInterval(i);
  }, [checkReminders]);

  const dismissReminder = async (id: string) => {
    await remindersApi.dismiss(id);
    setReminders(r => r.filter(x => x.id !== id));
  };

  // Cerrar sidebar móvil al navegar
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  // Sidebar unificado para móvil y desktop
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={clsx(
      "flex flex-col h-full border-r border-surface-border transition-all duration-300",
      isMobile ? "w-64" : (collapsed ? "w-16" : "w-60")
    )} style={{backgroundColor:"var(--color-surface-card)"}}>

      {/* Header */}
      <div className={clsx("flex items-center border-b border-surface-border p-3 shrink-0",
        (!isMobile && collapsed) ? "justify-center" : "justify-between")}>
        {(isMobile || !collapsed) && (
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-light shrink-0" />
            <span className="font-bold" style={{color:"var(--color-text)"}}>HaIA</span>
          </div>
        )}
        {!isMobile && collapsed && <Sparkles className="w-5 h-5 text-primary-light" />}
        <button
          onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(v => !v)}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-colors" style={{color:"var(--color-text-subtle)"}}>
          {isMobile ? <X className="w-4 h-4" /> : collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Búsqueda */}
      <div className="pt-2 pb-1">
        <SidebarSearch collapsed={!isMobile && collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          const isCol = !isMobile && collapsed;
          return (
            <Link key={href} href={href} title={isCol ? label : undefined}
              className={clsx(
                "flex items-center rounded-xl text-sm font-medium transition-colors",
                isCol ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                active ? "bg-primary/20 text-primary-light" : "hover:bg-surface-hover"
              )} style={!active ? {color:"var(--color-text-muted)"} : {}}>
              <Icon className="w-4 h-4 shrink-0" />
              {(isMobile || !collapsed) && label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-border p-2 shrink-0 space-y-0.5">
        {/* Toggle tema */}
        <button onClick={toggle} title={(!isMobile && collapsed) ? "Tema" : undefined}
          className={clsx("flex items-center rounded-xl text-sm hover:bg-surface-hover w-full transition-colors",
            (!isMobile && collapsed) ? "justify-center p-3" : "gap-3 px-3 py-2.5"
          )} style={{color:"var(--color-text-muted)"}}>
          {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {(isMobile || !collapsed) && (theme === "dark" ? "Modo claro" : "Modo oscuro")}
        </button>

        {/* Usuario */}
        {(isMobile || !collapsed) && (
          <div className="flex items-center gap-2 px-3 py-2">
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
            )}
            <span className="text-xs truncate" style={{color:"var(--color-text-subtle)"}}>
              {user?.user_metadata?.full_name?.split(" ")[0] || user?.email}
            </span>
          </div>
        )}

        {/* Logout */}
        <button onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}
          title={(!isMobile && collapsed) ? "Salir" : undefined}
          className={clsx("flex items-center rounded-xl text-sm hover:text-red-400 hover:bg-surface-hover w-full transition-colors",
            (!isMobile && collapsed) ? "justify-center p-3" : "gap-3 px-3 py-2.5"
          )} style={{color:"var(--color-text-subtle)"}}>
          <LogOut className="w-4 h-4 shrink-0" />
          {(isMobile || !collapsed) && "Salir"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{backgroundColor:"var(--color-surface)"}}>

      {/* ── Sidebar desktop (oculto en móvil) ── */}
      <div className="hidden md:flex shrink-0">
        <SidebarContent />
      </div>

      {/* ── Overlay sidebar móvil ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {/* Panel */}
          <div className="relative z-10 h-full animate-slide-up" style={{width:"264px"}}>
            <SidebarContent isMobile />
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Header móvil con hamburguesa */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-surface-border shrink-0" style={{backgroundColor:"var(--color-surface-card)"}}>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-surface-hover transition-colors -ml-1" style={{color:"var(--color-text-muted)"}}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary-light" />
            <span className="font-bold text-sm" style={{color:"var(--color-text)"}}>HaIA</span>
          </div>
          <div className="flex-1" />
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" />
          )}
        </div>

        {/* Banners de recordatorios */}
        {reminders.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-warning/10 border-b border-warning/30 px-4 py-2.5 text-sm text-warning animate-slide-up shrink-0">
            <span className="flex items-center gap-2"><Bell className="w-4 h-4 shrink-0" />{r.message}</span>
            <button onClick={() => dismissReminder(r.id)} className="ml-4 text-xs opacity-60 hover:opacity-100 shrink-0">Descartar</button>
          </div>
        ))}

        <main className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>

      <FloatingChat />
    </div>
  );
}
