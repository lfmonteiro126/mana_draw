import { CheckCircle2, PackageCheck, RotateCcw, ShoppingBag } from "lucide-react";
import Link from "next/link";

const copy: Record<
  string,
  {
    title: string;
    text: string;
    tone: "success" | "pending" | "failure";
  }
> = {
  success: {
    title: "Pagamento confirmado",
    text: "Recebemos seu pedido. Acompanhe o status e o envio na sua conta.",
    tone: "success"
  },
  pending: {
    title: "Pagamento em análise",
    text: "Assim que o Mercado Pago confirmar, atualizamos o pedido automaticamente.",
    tone: "pending"
  },
  failure: {
    title: "Pagamento não concluído",
    text: "Nenhuma cobrança foi finalizada. Volte ao catálogo e tente de novo pelo carrinho.",
    tone: "failure"
  }
};

export default async function OrderReturnPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && copy[params.status] ? params.status : "pending";
  const content = copy[status];

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <div
          className={`mb-6 grid h-14 w-14 place-items-center rounded-[var(--radius-card)] ${
            content.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : content.tone === "failure"
                ? "bg-rose-50 text-rose-700"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          {content.tone === "success" ? (
            <CheckCircle2 size={28} />
          ) : content.tone === "failure" ? (
            <RotateCcw size={28} />
          ) : (
            <PackageCheck size={28} />
          )}
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Mana Draw
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)]">
          {content.title}
        </h1>
        <p className="mt-3 text-[var(--muted)] leading-7">{content.text}</p>

        <ul className="mt-6 space-y-2 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]/80 px-4 py-4 text-sm text-[var(--muted)]">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            Pix e cartão processados pelo Mercado Pago
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            Pedidos e status ficam salvos na sua conta
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            Dúvidas? Responda o e-mail de confirmação quando disponível
          </li>
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/conta"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            <PackageCheck size={16} />
            Ver pedidos
          </Link>
          <Link
            href="/#catalogo"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
          >
            <ShoppingBag size={16} />
            Continuar comprando
          </Link>
        </div>
      </div>
    </main>
  );
}
