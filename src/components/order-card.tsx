import { Check, CreditCard, MapPin, Package, Truck } from "lucide-react";
import Image from "next/image";
import { formatCurrency } from "@/lib/format";
import {
  formatOrderDate,
  formatPostalCode,
  orderStatusLabels,
  orderStatusSteps,
  orderStatusStyles,
  paymentLabel
} from "@/lib/orders-ui";
import type { OrderSummary } from "@/lib/types";

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        orderStatusStyles[status] ?? "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)]"
      }`}
    >
      {orderStatusLabels[status] ?? status}
    </span>
  );
}

function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <p className="text-sm text-rose-700">Pedido cancelado — estoque pode ser reaberto no admin.</p>
    );
  }

  const currentIndex = orderStatusSteps.indexOf(status as (typeof orderStatusSteps)[number]);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <ol className="grid grid-cols-4 gap-2">
      {orderStatusSteps.map((step, index) => {
        const done = index <= activeIndex;
        return (
          <li key={step} className="min-w-0">
            <div
              className={`mb-1.5 h-1.5 rounded-full ${
                done ? "bg-[var(--accent)]" : "bg-[var(--surface-hover)]"
              }`}
            />
            <p
              className={`truncate text-[11px] font-medium ${
                done ? "text-[var(--ink)]" : "text-[var(--muted)]"
              }`}
            >
              {orderStatusLabels[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderCard({
  order,
  showCustomer = false,
  footer
}: {
  order: OrderSummary;
  showCustomer?: boolean;
  footer?: React.ReactNode;
}) {
  const shippingLabel =
    order.shippingMethod === "pickup" || order.shippingServiceName?.toLowerCase().includes("retirada")
      ? order.shippingServiceName || "Retirada na loja"
      : [order.shippingCompany, order.shippingServiceName].filter(Boolean).join(" · ") || "Frete";
  const postal = formatPostalCode(order.shippingPostalCode);
  const payment = paymentLabel(order.paymentProvider, order.paymentStatus);
  const previewItems = order.items.slice(0, 4);
  const extraItems = Math.max(0, order.items.length - previewItems.length);

  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-soft)]/70 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-[var(--ink)]">
              Pedido {order.id.slice(0, 8).toUpperCase()}
            </h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{formatOrderDate(order.createdAt)}</p>
          {showCustomer && order.customerEmail ? (
            <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{order.customerEmail}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tracking-tight text-[var(--ink)]">
            {formatCurrency(order.totalCents || order.subtotalCents)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {order.itemCount} {order.itemCount === 1 ? "item" : "itens"}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <OrderProgress status={order.status} />

        {order.items.length > 0 ? (
          <div className="space-y-2.5">
            {previewItems.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="grid grid-cols-[48px_1fr_auto] items-center gap-3"
              >
                <div className="relative aspect-[5/7] overflow-hidden rounded-md border border-[var(--line)] bg-slate-100">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    unoptimized
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {[item.game, item.condition, `×${item.quantity}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  {formatCurrency(item.unitPriceCents * item.quantity)}
                </p>
              </div>
            ))}
            {extraItems > 0 ? (
              <p className="text-xs font-medium text-[var(--muted)]">+{extraItems} carta(s) neste pedido</p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm text-[var(--muted)]">
            <Package size={16} />
            {order.itemCount} {order.itemCount === 1 ? "item" : "itens"} no pedido
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Truck size={13} />
              Entrega
            </p>
            <p className="text-sm font-medium text-[var(--ink)]">{shippingLabel}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {order.shippingMethod === "pickup" || shippingLabel.toLowerCase().includes("retirada")
                ? "Sem frete"
                : order.shippingDays != null
                  ? `Prazo estimado: ${order.shippingDays} dia(s)`
                  : order.shippingCents > 0
                    ? formatCurrency(order.shippingCents)
                    : "Frete a confirmar"}
              {postal ? ` · CEP ${postal}` : ""}
            </p>
          </div>
          <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <CreditCard size={13} />
              Pagamento
            </p>
            <p className="text-sm font-medium text-[var(--ink)]">{payment ?? "Aguardando"}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Itens {formatCurrency(order.subtotalCents)}
              {order.shippingCents > 0 ? ` + frete ${formatCurrency(order.shippingCents)}` : ""}
            </p>
          </div>
        </div>

        {postal ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <MapPin size={13} />
            Destino {postal}
          </p>
        ) : null}

        {order.status === "paid" || order.status === "shipped" || order.status === "delivered" ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent-strong)]">
            <Check size={13} />
            {order.status === "delivered"
              ? "Pedido concluído"
              : order.status === "shipped"
                ? "Em transporte"
                : "Pagamento confirmado"}
          </p>
        ) : null}

        {footer ? <div className="border-t border-[var(--line)] pt-4">{footer}</div> : null}
      </div>
    </article>
  );
}
