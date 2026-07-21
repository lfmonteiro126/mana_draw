import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { currentUser } from "@/lib/auth";
import { getOrdersForUser } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

export default async function AccountPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link className="text-sm font-semibold text-[var(--accent)]" href="/">
          Voltar para loja
        </Link>
        <section className="mt-8">
          <h1 className="text-3xl font-semibold text-[var(--ink)]">Sua conta</h1>
          <p className="mt-2 text-[var(--muted)]">
            Entre para acompanhar pedidos e cotacoes.
          </p>
          <div className="mt-6">
            <AuthPanel redirectTo="/conta" />
          </div>
        </section>
      </main>
    );
  }

  const orders = await getOrdersForUser(user.id);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end">
        <div>
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/">
            Voltar para loja
          </Link>
          <h1 className="mt-6 text-3xl font-semibold text-[var(--ink)]">Historico de pedidos</h1>
          <p className="mt-2 text-[var(--muted)]">{user.name} · {user.email}</p>
        </div>
        {user.role === "admin" && (
          <Link className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white" href="/admin">
            Abrir admin
          </Link>
        )}
      </div>

      <section className="mt-6 grid gap-3">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
            <PackageCheck className="mx-auto mb-3 text-[var(--muted)]" size={34} />
            <p className="font-semibold text-[var(--ink)]">Nenhum pedido ainda</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Seus pedidos finalizados aparecem aqui quando o Neon estiver conectado.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <article key={order.id} className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-semibold text-[var(--ink)]">Pedido {order.id.slice(0, 8)}</p>
                <p className="text-sm text-[var(--muted)]">{new Date(order.createdAt).toLocaleString("pt-BR")}</p>
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
    </main>
  );
}
