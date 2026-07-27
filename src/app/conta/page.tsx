import { Camera, PackageCheck } from "lucide-react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { StatusBadge } from "@/components/admin/ui";
import { OrderCard } from "@/components/order-card";
import { currentUser } from "@/lib/auth";
import { buylistStatusLabels, buylistStatusStyles } from "@/lib/buylist-ui";
import { getBuylistSubmissionsForEmail, getOrdersForUser } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

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
    getBuylistSubmissionsForEmail(user.email)
  ]);
  const openCount = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const spentCents = orders
    .filter((order) => !["cancelled", "pending"].includes(order.status))
    .reduce((sum, order) => sum + (order.totalCents || order.subtotalCents), 0);
  const openBuylists = buylists.filter((item) =>
    ["offered", "awaiting_shipment", "in_transit", "received", "checking", "stocked"].includes(item.status)
  );

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

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pedidos</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">{orders.length}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Em andamento</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">{openCount}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Total pago</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {formatCurrency(spentCents)}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">Cotações de buylist</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Aceite ofertas e informe o envio do lote.
            </p>
          </div>
          <span className="text-sm font-semibold text-[var(--muted)]">{openBuylists.length} ativas</span>
        </div>
        {buylists.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
            <Camera className="mx-auto mb-3 text-[var(--muted)]" size={34} />
            <p className="font-semibold text-[var(--ink)]">Nenhuma cotação ainda</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Envie um lote pela buylist da loja.</p>
            <Link
              href="/#venda"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
            >
              Ir para buylist
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {buylists.map((submission) => (
              <Link
                key={submission.id}
                href={`/buylist/${submission.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--accent)]/40"
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
                    {submission.offerCents != null ? ` · ${formatCurrency(submission.offerCents)}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--accent)]">Ver oferta</span>
              </Link>
            ))}
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
