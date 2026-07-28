import { Camera, PackageCheck } from "lucide-react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { StatusBadge } from "@/components/admin/ui";
import { OrderCard } from "@/components/order-card";
import { currentUser } from "@/lib/auth";
import { isOfferExpired, normalizeBuylistStatus } from "@/lib/buylist-flow";
import { buylistStatusLabels, buylistStatusStyles } from "@/lib/buylist-ui";
import { getBuylistSubmissionsForUser, getOrdersForUser } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import type { BuylistSubmission } from "@/lib/types";

function AccountChrome({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3" aria-label="Mana Draw">
            <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white">
              MD
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight text-[var(--ink)] transition group-hover:text-[var(--accent)]">
                Mana Draw
              </span>
              <span className="text-xs text-[var(--muted)]">Voltar para a loja</span>
            </span>
          </Link>
          <Link
            href="/#catalogo"
            className="text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
          >
            Catálogo
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}

function offerCta(status: string) {
  switch (normalizeBuylistStatus(status)) {
    case "offered":
      return "Ver e responder oferta";
    case "awaiting_shipment":
      return "Informar envio";
    case "in_transit":
      return "Acompanhar envio";
    case "new":
    case "reviewing":
      return "Acompanhar cotação";
    default:
      return "Ver detalhes";
  }
}

function sortedBuylists(items: BuylistSubmission[]) {
  const rank = (status: string) => {
    const value = normalizeBuylistStatus(status);
    if (value === "offered") return 0;
    if (value === "awaiting_shipment") return 1;
    if (value === "in_transit") return 2;
    if (value === "received" || value === "checking") return 3;
    if (value === "new" || value === "reviewing") return 4;
    if (value === "stocked") return 5;
    if (value === "paid") return 6;
    return 7;
  };
  return [...items].sort((a, b) => {
    const byRank = rank(a.status) - rank(b.status);
    if (byRank !== 0) return byRank;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default async function AccountPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <AccountChrome>
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Sua conta</h1>
          <p className="mt-2 text-[var(--muted)]">Entre para acompanhar pedidos e cotações.</p>
          <div className="mt-6">
            <AuthPanel redirectTo="/conta" />
          </div>
        </section>
      </AccountChrome>
    );
  }

  const [orders, buylists] = await Promise.all([
    getOrdersForUser(user.id),
    getBuylistSubmissionsForUser({ email: user.email, userId: user.id })
  ]);
  const openCount = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const spentCents = orders
    .filter((order) => !["cancelled", "pending"].includes(order.status))
    .reduce((sum, order) => sum + (order.totalCents || order.subtotalCents), 0);
  const pendingOffers = buylists.filter((item) => normalizeBuylistStatus(item.status) === "offered");
  const activeBuylists = buylists.filter((item) =>
    ["offered", "awaiting_shipment", "in_transit", "received", "checking", "stocked", "new", "reviewing"].includes(
      normalizeBuylistStatus(item.status) as string
    )
  );
  const listed = sortedBuylists(buylists);

  return (
    <AccountChrome>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Conta</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--ink)]">Seus pedidos e cotações</h1>
          <p className="mt-2 text-[var(--muted)]">
            {user.name} · {user.email}
          </p>
        </div>
        {user.role === "admin" && (
          <Link
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            href="/admin?tab=orders"
          >
            Abrir admin
          </Link>
        )}
      </div>

      {pendingOffers.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[var(--accent)]/30 bg-[var(--accent)]/10 shadow-[var(--shadow-soft)]">
          <div className="border-b border-[var(--accent)]/20 px-5 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
              Oferta aguardando resposta
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">
              {pendingOffers.length === 1
                ? "A loja enviou uma oferta pelo seu lote"
                : `A loja enviou ${pendingOffers.length} ofertas`}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Entre na cotação para aceitar ou recusar. Depois informe o envio ou a retirada.
            </p>
          </div>
          <div className="grid gap-3 p-4 sm:p-5">
            {pendingOffers.map((submission) => {
              const expired = isOfferExpired(submission.offerExpiresAt);
              return (
                <Link
                  key={submission.id}
                  href={`/buylist/${submission.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--ink)]">{submission.game}</p>
                      <StatusBadge
                        label={buylistStatusLabels[submission.status] ?? submission.status}
                        className={buylistStatusStyles[submission.status]}
                      />
                      {expired ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          Expirada
                        </span>
                      ) : null}
                    </div>
                    {submission.offerNote ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{submission.offerNote}</p>
                    ) : (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Enviada em {new Date(submission.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                      {submission.offerCents != null ? formatCurrency(submission.offerCents) : "—"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--accent)]">Responder agora</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pedidos</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">{orders.length}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Em andamento</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">{openCount}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ofertas buylist</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">{pendingOffers.length}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total pago</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {formatCurrency(spentCents)}
          </p>
        </div>
      </section>

      <section className="mt-10" id="buylists">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Cotações de buylist</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              As ofertas da loja aparecem aqui no mesmo e-mail da sua conta.
            </p>
          </div>
          <span className="text-sm font-semibold text-[var(--muted)]">{activeBuylists.length} ativas</span>
        </div>
        {listed.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
            <Camera className="mx-auto mb-3 text-[var(--muted)]" size={34} />
            <p className="font-semibold text-[var(--ink)]">Nenhuma cotação ainda</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Envie um lote pela buylist usando o mesmo e-mail desta conta.
            </p>
            <Link
              href="/#venda"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
            >
              Ir para buylist
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {listed.map((submission) => {
              const status = normalizeBuylistStatus(submission.status);
              const isOffer = status === "offered";
              return (
                <Link
                  key={submission.id}
                  href={`/buylist/${submission.id}`}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--accent)]/40 ${
                    isOffer
                      ? "border-[var(--accent)]/35 bg-[var(--accent)]/5"
                      : "border-[var(--line)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--ink)]">{submission.game}</p>
                      <StatusBadge
                        label={buylistStatusLabels[submission.status] ?? submission.status}
                        className={buylistStatusStyles[submission.status]}
                      />
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--muted)]">
                      {new Date(submission.createdAt).toLocaleDateString("pt-BR")}
                      {submission.offerCents != null ? ` · Oferta ${formatCurrency(submission.offerCents)}` : " · Sem oferta ainda"}
                    </p>
                    {submission.offerNote && isOffer ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--ink)]">{submission.offerNote}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    {submission.offerCents != null ? (
                      <p className="text-lg font-semibold tracking-tight text-[var(--ink)]">
                        {formatCurrency(submission.offerCents)}
                      </p>
                    ) : null}
                    <span className="text-sm font-semibold text-[var(--accent)]">{offerCta(submission.status)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-[var(--ink)]">Pedidos</h2>
        {orders.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
            <PackageCheck className="mx-auto mb-3 text-[var(--muted)]" size={34} />
            <p className="font-semibold text-[var(--ink)]">Nenhum pedido ainda</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Explore o catálogo e finalize sua primeira compra.
            </p>
            <Link
              href="/#catalogo"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </AccountChrome>
  );
}
