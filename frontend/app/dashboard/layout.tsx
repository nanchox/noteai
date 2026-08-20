"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { remindersApi, chatApi } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import {
  LayoutDashboard, FileText, CheckSquare, LogOut, Sparkles,
  Bell, FolderOpen, Kanban, Search, AlarmClock, ChevronLeft,
  ChevronRight, Send, X, Minimize2, Bot, User
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard",           label: "Inicio",    icon: LayoutDashboard },
  { href: "/dashboard/projects",  label: "Proyectos", icon: FolderOpen },
  { href: "/dashboard/notes",     label: "Notas",     icon: FileText },
  { href: "/dashboard/tasks",     label: "Tareas",    icon: CheckSquare },
  { href: "/dashboard/kanban",    label: "Kanban",    icon: Kanban },
  { href: "/dashboard/search",    label: "Buscar",    icon: Search },
  { href: "/dashboard/reminders", label: "Alertas",   icon: AlarmClock },
];

// ── Chat flotante ────────────────────────────────────────────
function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cargar historial solo al abrir por primera vez
  useEffect(() => {
    if (open && !loaded) {
      chatApi.history(10).then(h => {
        setMessages(h);
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [open, loaded]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const { reply, actions } = await chatApi.send(text) as any;
      setMessages(prev => [...prev, {
        role: "assistant", content: reply,
        actions: actions || [],
        created_at: new Date().toISOString()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant", content: "Error al responder. Intenta de nuevo.",
        created_at: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Panel del chat */}
      <div className={clsx(
        "fixed bottom-20 right-4 z-50 flex flex-col bg-surface-card border border-surface-border rounded-2xl shadow-2xl transition-all duration-300 origin-bottom-right",
        open
          ? "w-80 md:w-96 h-[520px] opacity-100 scale-100"
          : "w-0 h-0 opacity-0 scale-90 pointer-events-none"
      )}>
        {/* Header del chat */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border rounded-t-2xl bg-surface-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Asistente IA</p>
              <p className="text-xs text-gray-500 mt-0.5">Puedo crear notas y tareas</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-surface-hover rounded-lg transition-colors">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {!loaded && (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {loaded && messages.length === 0 && (
            <div className="text-center py-6 space-y-3">
              <p className="text-xs text-gray-500">Escríbeme algo o pídeme que cree una nota o tarea.</p>
              <div className="space-y-1.5">
                {["¿Qué tareas tengo hoy?", "Crea una nota rápida", "Muéstrame mis pendientes"].map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="w-full text-left text-xs bg-surface border border-surface-border text-gray-400 hover:text-white hover:border-primary/30 px-3 py-2 rounded-lg transition-colors">
                    {s}
                  </button>
                ))}
              </div>
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
                <div className={clsx(
                  "rounded-xl px-3 py-2 text-xs",
                  msg.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-surface border border-surface-border text-gray-200 rounded-tl-sm"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-invert prose-xs max-w-none [&>*]:my-0.5 [&>p]:text-xs [&>ul]:text-xs [&>ol]:text-xs">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
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
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 shrink-0">
          <div className="flex gap-2 items-end bg-surface border border-surface-border rounded-xl px-3 py-2 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe aquí..."
              rows={1}
              className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none resize-none max-h-20 py-0.5"
              style={{ minHeight: "24px" }}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-6 h-6 bg-primary hover:bg-primary-dark rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 shrink-0">
              <Send className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "fixed bottom-4 right-4 z-50 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300",
          open
            ? "bg-surface-card border border-surface-border text-gray-400 hover:text-danger rotate-0"
            : "bg-gradient-to-br from-primary to-accent text-white hover:scale-110 hover:shadow-primary/30"
        )}
        title={open ? "Cerrar asistente" : "Abrir asistente IA"}
      >
        {open
          ? <X className="w-5 h-5" />
          : <Bot className="w-6 h-6" />
        }
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-surface animate-pulse" />
        )}
      </button>
    </>
  );
}

// ── Layout principal ─────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/"); return; }
      setUser(data.user);
    });
  }, [router]);

  const checkReminders = useCallback(async () => {
    try {
      const pending = await remindersApi.pending();
      if (pending.length > 0) setReminders(pending);
    } catch {}
  }, []);

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, 60_000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const dismissReminder = async (id: string) => {
    await remindersApi.dismiss(id);
    setReminders(r => r.filter(x => x.id !== id));
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">

      {/* ── Sidebar desktop ── */}
      <aside className={clsx(
        "hidden md:flex flex-col bg-surface-card border-r border-surface-border shrink-0 transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-56"
      )}>
        {/* Logo + toggle */}
        <div className={clsx(
          "flex items-center border-b border-surface-border p-4 shrink-0",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-light shrink-0" />
              <span className="font-bold text-white">HaIA</span>
            </div>
          )}
          {sidebarCollapsed && <Sparkles className="w-5 h-5 text-primary-light" />}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className={clsx(
              "p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-surface-hover transition-colors",
              sidebarCollapsed && "mt-0"
            )}
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {sidebarCollapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />
            }
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                title={sidebarCollapsed ? label : undefined}
                className={clsx(
                  "flex items-center rounded-lg text-sm font-medium transition-colors group",
                  sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-primary/20 text-primary-light"
                    : "text-gray-400 hover:text-white hover:bg-surface-hover"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="border-t border-surface-border p-3 shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 px-2 mb-2">
              {user?.user_metadata?.avatar_url && (
                <img src={user.user_metadata.avatar_url} alt=""
                  className="w-7 h-7 rounded-full shrink-0" />
              )}
              <span className="text-xs text-gray-400 truncate">
                {user?.user_metadata?.full_name?.split(" ")[0] || user?.email}
              </span>
            </div>
          )}
          <button onClick={handleLogout}
            title={sidebarCollapsed ? "Salir" : undefined}
            className={clsx(
              "flex items-center rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-surface-hover transition-colors w-full",
              sidebarCollapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2"
            )}>
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && "Salir"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Reminder banners */}
        {reminders.map(r => (
          <div key={r.id}
            className="flex items-center justify-between bg-warning/10 border-b border-warning/30 px-4 py-2.5 text-sm text-warning animate-slide-up shrink-0">
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 shrink-0" />
              {r.message}
            </span>
            <button onClick={() => dismissReminder(r.id)}
              className="ml-4 text-xs opacity-60 hover:opacity-100 shrink-0">
              Descartar
            </button>
          </div>
        ))}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom nav — mobile (sin el chat, está en el botón flotante) */}
        <nav className="md:hidden flex border-t border-surface-border bg-surface-card shrink-0 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-w-[48px]",
                pathname === href ? "text-primary-light" : "text-gray-500"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="hidden xs:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Chat flotante persistente ── */}
      <FloatingChat />
    </div>
  );
}
