import { CreditCard, ShieldCheck, Truck } from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Condição auditada",
    copy: "NM a HP com padrão fotografável"
  },
  {
    icon: Truck,
    title: "Frete ou retirada",
    copy: "Rastreio e retirada local"
  },
  {
    icon: CreditCard,
    title: "Pix e cartão",
    copy: "Checkout via Mercado Pago"
  }
] as const;

export function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="Por que comprar na Mana Draw"
      className={`border-b border-[var(--line)] bg-[var(--surface)]/85 backdrop-blur-md ${className}`}
    >
      <div className="mx-auto grid max-w-7xl divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map(({ icon: Icon, title, copy }) => (
          <div
            key={title}
            className="trust-strip-item flex items-center gap-3 px-4 py-3.5 sm:justify-center sm:px-6 sm:py-4"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)]/10 text-[var(--accent)]">
              <Icon size={18} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
              <p className="truncate text-xs text-[var(--muted)]">{copy}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
