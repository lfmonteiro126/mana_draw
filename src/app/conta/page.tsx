import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { currentUser } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

function AccountChrome({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group" aria-label="Mana Draw">
            <span className="block text-lg font-semibold tracking-tight text-[var(--ink)] transition group-hover:text-[var(--accent)]">
              Mana Draw
            </span>
            <span className="text-xs text-[var(--muted)]">Voltar para a loja</span>
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
          <p className="mt-2 text-[var(--muted)]">
            Entre para acompanhar pedidos e cotações.
          </p>
          <div className="mt-6">
            <AuthPanel redirectTo="/conta" />
          </div>
        </section>
      </AccountChrome>
    );
  }

  const orders = await getOrdersForUser(user.id);

  return (
    <AccountChrome>
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">Histórico de pedidos</h1>
          <p className="mt-2 text-[var(--muted)]">
            {user.name} · {user.email}
          </p>
        </div>
        {user.role === "admin" && (
          <Link
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            href="/admin"
          >
            Abrir admin
          </Link>
        )}
      </div>

      <section className="mt-6 grid gap-3">
        {orders.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
            <PackageCheck className="mx-auto mb-3 text-[var(--muted)]" size={34} />
            <p className="font-semibold text-[var(--ink)]">Nenhum pedido ainda</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Seus pedidos finalizados aparecem aqui quando o Neon estiver conectado.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div>
                <p className="font-semibold text-[var(--ink)]">Pedido {order.id.slice(0, 8)}</p>
                <p className="text-sm text-[var(--muted)]">
                  {new Date(order.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="rounded-md bg-[var(--surface-hover)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                {order.status}
              </span>
              <div className="text-left sm:text-right">
                <p className="font-semibold text-[var(--ink)]">{formatCurrency(order.subtotalCents)}</p>
                <p className="text-sm text-[var(--muted)]">{order.itemCount} itens</p>
              </div>
            </article>
          ))
        )}
      </section>
    </AccountChrome>
  );
}
