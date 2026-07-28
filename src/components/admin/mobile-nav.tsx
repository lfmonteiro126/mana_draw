"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  ClipboardList,
  Gauge,
  Inbox,
  Layers3,
  MoreHorizontal,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
  X
} from "lucide-react";

type AdminTab =
  | "overview"
  | "pendencias"
  | "inventory"
  | "new-card"
  | "buylists"
  | "orders"
  | "customers"
  | "internal-users"
  | "reports"
  | "settings";

type NavItem = {
  tab: AdminTab;
  label: string;
  shortLabel: string;
  href: string;
  icon: ReactNode;
  badge?: number;
};

const PRIMARY_TABS: AdminTab[] = ["overview", "pendencias", "inventory", "new-card"];

export function AdminMobileNav({
  activeTab,
  alertCount
}: {
  activeTab: string;
  alertCount: number;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const items = useMemo<NavItem[]>(
    () => [
      {
        tab: "overview",
        label: "Visão geral",
        shortLabel: "Visão",
        href: "/admin?tab=overview",
        icon: <Gauge size={18} />
      },
      {
        tab: "pendencias",
        label: "Pendências",
        shortLabel: "Pendências",
        href: "/admin?tab=pendencias",
        icon: <Inbox size={18} />,
        badge: alertCount > 0 ? alertCount : undefined
      },
      {
        tab: "inventory",
        label: "Inventário",
        shortLabel: "Estoque",
        href: "/admin?tab=inventory",
        icon: <Layers3 size={18} />
      },
      {
        tab: "new-card",
        label: "Nova carta",
        shortLabel: "Nova",
        href: "/admin?tab=new-card",
        icon: <Plus size={18} />
      },
      {
        tab: "buylists",
        label: "Buylists",
        shortLabel: "Buylists",
        href: "/admin?tab=buylists",
        icon: <ClipboardList size={18} />
      },
      {
        tab: "orders",
        label: "Pedidos",
        shortLabel: "Pedidos",
        href: "/admin?tab=orders",
        icon: <ShoppingBag size={18} />
      },
      {
        tab: "customers",
        label: "Clientes",
        shortLabel: "Clientes",
        href: "/admin?tab=customers",
        icon: <UsersRound size={18} />
      },
      {
        tab: "internal-users",
        label: "Usuários internos",
        shortLabel: "Equipe",
        href: "/admin?tab=internal-users",
        icon: <ShieldCheck size={18} />
      },
      {
        tab: "reports",
        label: "Relatórios",
        shortLabel: "Relatórios",
        href: "/admin?tab=reports",
        icon: <BarChart3 size={18} />
      },
      {
        tab: "settings",
        label: "Ajustes",
        shortLabel: "Ajustes",
        href: "/admin?tab=settings",
        icon: <Settings size={18} />
      }
    ],
    [alertCount]
  );

  const primary = items.filter((item) => PRIMARY_TABS.includes(item.tab));
  const secondary = items.filter((item) => !PRIMARY_TABS.includes(item.tab));
  const moreActive = secondary.some((item) => item.tab === activeTab);

  useEffect(() => {
    setMoreOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  return (
    <div className="lg:hidden">
      {moreOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            type="button"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-[calc(4.25rem+var(--safe-bottom))] mx-3 animate-slide-up rounded-[var(--radius-sheet)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lift)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-[var(--ink)]">Mais opções</p>
              <button
                aria-label="Fechar"
                className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)]"
                type="button"
                onClick={() => setMoreOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {secondary.map((item) => {
                const active = activeTab === item.tab;
                return (
                  <Link
                    key={item.tab}
                    className={`flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--ink)]"
                        : "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)]"
                    }`}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                  >
                    <span className={active ? "text-[var(--accent)]" : ""}>{item.icon}</span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                );
              })}
              <Link
                className="col-span-2 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-3 text-sm font-semibold text-[var(--muted)]"
                href="/"
                onClick={() => setMoreOpen(false)}
              >
                <Store size={18} />
                Abrir loja
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Navegação admin"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[var(--surface)]/95 px-1 pt-1.5 backdrop-blur-xl"
        style={{ paddingBottom: "max(0.45rem, var(--safe-bottom))" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
          {primary.map((item) => {
            const active = activeTab === item.tab;
            return (
              <Link
                key={item.tab}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-1 rounded-[0.85rem] px-1 py-2 text-[10px] font-semibold transition ${
                  active ? "bg-[var(--accent)]/10 text-[var(--accent-strong)]" : "text-[var(--muted)]"
                }`}
                href={item.href}
              >
                <span className="relative">
                  {item.icon}
                  {item.badge ? (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
          <button
            aria-expanded={moreOpen}
            className={`relative flex min-w-0 flex-col items-center gap-1 rounded-[0.85rem] px-1 py-2 text-[10px] font-semibold transition ${
              moreOpen || moreActive
                ? "bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "text-[var(--muted)]"
            }`}
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
          >
            <MoreHorizontal size={18} />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
