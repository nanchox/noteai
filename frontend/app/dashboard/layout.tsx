"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { remindersApi } from "@/lib/api";
import {
  LayoutDashboard, FileText, CheckSquare, MessageSquare,
  LogOut, Sparkles, Bell, FolderOpen
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Proyectos", icon: FolderOpen },
  { href: "/dashboard/notes", label: "Notas", icon: FileText },
  { href: "/dashboard/tasks", label: "Tareas", icon: CheckSquare },
  { href: "/dashboard/chat", label: "IA", icon: MessageSquare },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/"); return; }
      setUser(data.user);
    });
  }, [router]);

  // Polling de recordatorios cada 60s (workaround para iOS 15)
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
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-surface-card border-r border-surface-border p-4 shrink-0">
        <div className="flex items-center gap-2 mb-8 px-2">
          <Sparkles className="w-5 h-5 text-primary-light" />
          <span className="font-bold text-white">NoteAI</span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/20 text-primary-light"
                  : "text-gray-400 hover:text-white hover:bg-surface-hover"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-surface-border pt-4 mt-4">
          <div className="flex items-center gap-2 px-2 mb-3">
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" />
            )}
            <span className="text-xs text-gray-400 truncate">
              {user?.user_metadata?.full_name || user?.email}
            </span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-surface-hover transition-colors">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Reminder banners */}
        {reminders.map(r => (
          <div key={r.id}
            className="flex items-center justify-between bg-warning/10 border-b border-warning/30 px-4 py-2.5 text-sm text-warning animate-slide-up">
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 shrink-0" />
              {r.message}
            </span>
            <button onClick={() => dismissReminder(r.id)} className="ml-4 text-xs opacity-60 hover:opacity-100">
              Descartar
            </button>
          </div>
        ))}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom nav — mobile */}
        <nav className="md:hidden flex border-t border-surface-border bg-surface-card">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                pathname === href ? "text-primary-light" : "text-gray-500"
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
