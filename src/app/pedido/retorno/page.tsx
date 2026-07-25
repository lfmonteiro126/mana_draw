import Link from "next/link";

const copy: Record<string, { title: string; text: string }> = {
  success: {
    title: "Pagamento confirmado",
    text: "Recebemos seu pedido. Você pode acompanhar o status na sua conta."
  },
  pending: {
    title: "Pagamento em análise",
    text: "Assim que o Mercado Pago confirmar, atualizamos o pedido automaticamente."
  },
  failure: {
    title: "Pagamento não concluído",
    text: "Nenhuma cobrança foi finalizada. Você pode tentar de novo pelo carrinho."
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
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Mana Draw</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink)]">{content.title}</h1>
        <p className="mt-3 text-[var(--muted)]">{content.text}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/conta"
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Ver pedidos
          </Link>
          <Link
            href="/#catalogo"
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}
