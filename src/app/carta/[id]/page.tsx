import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductBuyBox } from "@/components/product-buy-box";
import { ProductPrice } from "@/components/product-price";
import { TrustStrip } from "@/components/trust-strip";
import { getCardById, getRelatedCatalogCards } from "@/lib/db";
import { formatStock } from "@/lib/format";
import { sealedTypeLabel } from "@/lib/sealed";
import { buildSealedDescription } from "@/lib/sealed-description";
import type { TcgCard } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const card = await getCardById(id);
  if (!card) {
    return { title: "Produto | Mana Draw" };
  }
  return {
    title: `${card.name} | Mana Draw`,
    description: `${card.name} · ${card.setName} · ${card.game} na Mana Draw TCG.`
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const card = await getCardById(id);
  if (!card) notFound();

  const related = await getRelatedCatalogCards(card, 4);
  const isSealed = card.productKind === "sealed";

  return (
    <main className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/#catalogo"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} />
            Catálogo
          </Link>
          <Link href="/" className="text-sm font-semibold tracking-tight text-[var(--ink)]">
            Mana Draw
          </Link>
          <Link
            href="/conta"
            className="text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            Conta
          </Link>
        </div>
      </header>

      <TrustStrip />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
          <Link href="/" className="transition hover:text-[var(--ink)]">
            Início
          </Link>
          <span>/</span>
          <Link href={isSealed ? "/#selados" : "/#catalogo"} className="transition hover:text-[var(--ink)]">
            {isSealed ? "Selados" : "Singles"}
          </Link>
          <span>/</span>
          <span className="truncate text-[var(--ink)]">{card.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.85fr)] lg:items-start xl:gap-12">
          <div>
            <div className="surface-card overflow-hidden p-4 sm:p-6">
              <div className="relative mx-auto aspect-[5/7] w-full max-w-[360px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] sm:max-w-[400px]">
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  priority
                  unoptimized
                  sizes="(min-width: 640px) 400px, 90vw"
                  className={isSealed ? "object-contain p-4" : "object-cover"}
                />
              </div>
              {card.backImageUrl ? (
                <div className="mx-auto mt-4 grid max-w-[400px] grid-cols-2 gap-3">
                  <div className="relative aspect-[5/7] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                    <Image
                      src={card.imageUrl}
                      alt={`${card.name} face 1`}
                      fill
                      unoptimized
                      sizes="200px"
                      className="object-cover"
                    />
                  </div>
                  <div className="relative aspect-[5/7] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-soft)]">
                    <Image
                      src={card.backImageUrl}
                      alt={`${card.name} face 2`}
                      fill
                      unoptimized
                      sizes="200px"
                      className="object-cover"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <section className="mt-6 surface-card p-5 sm:p-6">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
                {card.name}
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {card.setName}
                {isSealed
                  ? ` · ${sealedTypeLabel(card.game, card.sealedType)}`
                  : ` · ${card.rarity}`}
              </p>

              {isSealed ? (
                <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Descrição do produto
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--ink)]">
                    {buildSealedDescription(card)}
                  </p>
                </div>
              ) : null}

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <DetailRow label="Jogo" value={card.game} />
                <DetailRow
                  label={isSealed ? "Tipo" : "Condição"}
                  value={
                    isSealed
                      ? sealedTypeLabel(card.game, card.sealedType)
                      : `${card.condition} · ${conditionLabel(card.condition)}`
                  }
                />
                <DetailRow label="Idioma" value={card.language} />
                <DetailRow label="Acabamento" value={card.finish} />
                <DetailRow label="Estoque" value={formatStock(card.stock)} />
                <DetailRow label="Coleção" value={card.setName} />
              </dl>

              {card.tags.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="lg:sticky lg:top-20">
            <ProductBuyBox card={card} />
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-12 border-t border-[var(--line)] pt-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
                  Você também pode gostar
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Mais {isSealed ? "selados" : "singles"} de {card.game}
                </p>
              </div>
              <Link
                href={isSealed ? "/#selados" : "/#catalogo"}
                className="hidden text-sm font-semibold text-[var(--accent)] sm:inline"
              >
                Ver catálogo
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <RelatedCard key={item.id} card={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function RelatedCard({ card }: { card: TcgCard }) {
  return (
    <Link
      href={`/carta/${card.id}`}
      className="surface-card group grid grid-cols-[72px_1fr] gap-3 p-3 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)]">
        <Image
          src={card.imageUrl}
          alt={card.name}
          fill
          unoptimized
          sizes="72px"
          className={card.productKind === "sealed" ? "object-contain p-1" : "object-cover"}
        />
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent-strong)]">
          {card.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{card.setName}</p>
        <ProductPrice
          className="mt-2"
          priceCents={card.priceCents}
          marketPriceCents={card.marketPriceCents}
          size="sm"
          showMarketHint={false}
        />
      </div>
    </Link>
  );
}

function conditionLabel(condition: TcgCard["condition"]) {
  const labels: Record<TcgCard["condition"], string> = {
    NM: "Near Mint",
    SP: "Slightly Played",
    MP: "Moderately Played",
    HP: "Heavily Played"
  };
  return labels[condition];
}
