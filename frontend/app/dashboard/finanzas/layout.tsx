"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, TrendingDown, TrendingUp, RefreshCw, PieChart, PiggyBank, History, Tag } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { href: "/dashboard/finanzas",              label: "Resumen",    icon: LayoutDashboard,  short: "Inicio" },
  { href: "/dashboard/finanzas/gastos",       label: "Gastos",     icon: TrendingDown,     short: "Gastos" },
  { href: "/dashboard/finanzas/ingresos",     label: "Ingresos",   icon: TrendingUp,       short: "Ingresos" },
  { href: "/dashboard/finanzas/gastos-fijos", label: "Fijos",      icon: RefreshCw,        short: "Fijos" },
  { href: "/dashboard/finanzas/presupuestos", label: "Presupuesto",icon: PieChart,         short: "Presup." },
  { href: "/dashboard/finanzas/ahorros",      label: "Ahorros",    icon: PiggyBank,        short: "Ahorros" },
  { href: "/dashboard/finanzas/historial",    label: "Historial",  icon: History,          short: "Historial" },
];

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar horizontal — siempre visible */}
      <div className="shrink-0 border-b border-surface-border overflow-x-auto" style={{backgroundColor:"var(--color-surface-card)"}}>
        <div className="flex min-w-max">
          {TABS.map(({ href, label, icon: Icon, short }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={clsx(
                  "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-primary-light"
                    : "border-transparent hover:text-white"
                )}
                style={!active ? {color:"var(--color-text-subtle)"} : {}}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido de la sección */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
