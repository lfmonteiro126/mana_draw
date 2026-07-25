import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { OrderCard } from "@/components/order-card";
import { currentUser } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/db";
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

  const orders = await getOrdersForUser(user.id);
  const openCount = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const spentCents = orders
    .filter((order) => !["cancelled", "pending"].includes(order.status))
    .reduce((sum, order) => sum + (order.totalCents || order.subtotalCents), 0);

  return (
    <AccountChrome>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Conta</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--ink)]">Seus pedidos</h1>
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

      {orders.length > 0 ? (
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
      ) : null}

      <section className="mt-6 grid gap-4">
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
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </section>
    </AccountChrome>
  );
}
