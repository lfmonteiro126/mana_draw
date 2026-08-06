"use client";

import { Loader2, Package, Sparkles, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CardDetailsPayload, CardLegality } from "@/lib/card-details";
import { formatCurrency, formatUsd } from "@/lib/format";
import { isSealedProduct, sealedTypeLabel } from "@/lib/sealed";
import { buildSealedDescription } from "@/lib/sealed-description";
import type { TcgCard } from "@/lib/types";
import { ProductPrice } from "@/components/product-price";

type Props = {
  card: TcgCard;
  open: boolean;
  onClose: () => void;
  onAddToCart?: (card: TcgCard) => void;
};

export function CardDetailsModal({ card, open, onClose, onAddToCart }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<CardDetailsPayload | null>(null);
  const [activeImage, setActiveImage] = useState<"front" | "back">("front");
  const [apiSaysSealed, setApiSaysSealed] = useState(false);
  const sealed = apiSaysSealed || isSealedProduct(card);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    setApiSaysSealed(false);

    // Produtos selados não existem no Scryfall — usa os dados da loja.
    if (isSealedProduct(card)) {
      setLoading(false);
      setError("");
      setDetails(null);
      setActiveImage("front");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setActiveImage("front");
    setDetails(null);

    const params = new URLSearchParams({
      game: card.game,
      name: card.name,
      set: card.setName,
      imageUrl: card.imageUrl,
      priceCents: String(card.priceCents),
      marketPriceCents: String(card.marketPriceCents),
      stock: String(card.stock),
      condition: card.condition,
      productKind: card.productKind ?? "single"
    });
    if (card.sealedType) params.set("sealedType", card.sealedType);
    if (card.tags?.length) params.set("tags", card.tags.join(","));

    fetch(`/api/card-details?${params}`)
      .then(async (response) => {
        const payload = (await response.json()) as
          | { ok: true; details: CardDetailsPayload }
          | { ok: false; message: string; code?: string };
        if (cancelled) return;
        if (!payload.ok) {
          if (payload.code === "sealed_product") {
            setApiSaysSealed(true);
            setError("");
            setDetails(null);
            return;
          }
          setError(payload.message);
          setDetails(null);
          return;
        }
        setDetails(payload.details);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os detalhes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, card]);

  if (!mounted || !open) return null;

  const imageUrl =
    activeImage === "back" && details?.backImageUrl
      ? details.backImageUrl
      : details?.imageUrl || card.imageUrl;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        aria-label="Fechar detalhes"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[min(94vh,920px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--surface-soft)] shadow-[var(--shadow-lift)] animate-slide-up sm:rounded-2xl sm:animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${card.name}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{card.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">
              {sealed
                ? `${card.setName} · ${sealedTypeLabel(card.game, card.sealedType)} · ${formatCurrency(card.priceCents)}`
                : `${card.setName} · ${card.condition} · ${formatCurrency(card.priceCents)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/carta/${card.id}`}
              className="hidden h-9 items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:inline-flex"
              onClick={onClose}
            >
              Página do produto
            </Link>
            {onAddToCart ? (
              <button
                type="button"
                disabled={card.stock <= 0}
                onClick={() => onAddToCart(card)}
                className="hidden h-9 items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-40 sm:inline-flex"
              >
                Adicionar
              </button>
            ) : null}
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)]"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-5">
          {sealed ? (
            <SealedProductDetails card={card} onClose={onClose} onAddToCart={onAddToCart} />
          ) : loading ? (
            <div className="grid min-h-[320px] place-items-center text-[var(--muted)]">
              <p className="inline-flex items-center gap-2 text-sm">
                <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
                Carregando detalhes…
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              {error}
            </div>
          ) : details ? (
            <SingleCardDetails
              card={card}
              details={details}
              imageUrl={imageUrl}
              activeImage={activeImage}
              onActiveImage={setActiveImage}
            />
          ) : null}
        </div>

        {onAddToCart ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-[var(--line)] bg-white/95 px-4 py-3 backdrop-blur-md sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--muted)]">Preço</span>
              <strong className="text-base text-[var(--ink)]">{formatCurrency(card.priceCents)}</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                disabled={card.stock <= 0}
                onClick={() => onAddToCart(card)}
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-40"
              >
                {card.stock <= 0 ? "Sem estoque" : "Adicionar ao carrinho"}
              </button>
              <Link
                href={`/carta/${card.id}`}
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)]"
              >
                Ver
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function SealedProductDetails({
  card,
  onClose,
  onAddToCart
}: {
  card: TcgCard;
  onClose: () => void;
  onAddToCart?: (card: TcgCard) => void;
}) {
  const typeLabel = sealedTypeLabel(card.game, card.sealedType);
  const description = buildSealedDescription(card);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] lg:items-start">
      <section className="mx-auto w-full max-w-[300px]">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            unoptimized
            priority
            sizes="300px"
            className="object-contain p-4"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <div className="bg-[var(--accent)] px-4 py-3 text-white">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Package size={15} />
            Produto selado
          </p>
          <p className="mt-1 text-xs text-teal-50/90">
            {[card.game, typeLabel, card.language, card.setName].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">{card.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{card.setName}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Descrição
            </p>
            <p className="mt-1.5 text-sm leading-6 text-[var(--ink)]">{description}</p>
          </div>

          <ProductPrice
            priceCents={card.priceCents}
            marketPriceCents={card.marketPriceCents}
            size="lg"
          />

          <dl className="grid gap-2 sm:grid-cols-2">
            <DetailChip label="Tipo" value={typeLabel} />
            <DetailChip label="Jogo" value={card.game} />
            <DetailChip label="Idioma" value={card.language} />
            <DetailChip
              label="Estoque"
              value={card.stock <= 0 ? "Indisponível" : `${card.stock} disponível${card.stock === 1 ? "" : "is"}`}
            />
          </dl>

          {card.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
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

          <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
            {onAddToCart ? (
              <button
                type="button"
                disabled={card.stock <= 0}
                onClick={() => onAddToCart(card)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-40 sm:flex-none"
              >
                {card.stock <= 0 ? "Sem estoque" : "Adicionar ao carrinho"}
              </button>
            ) : null}
            <Link
              href={`/carta/${card.id}`}
              onClick={onClose}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:flex-none"
            >
              Página do produto
            </Link>
          </div>

          <p className="text-xs leading-5 text-[var(--muted)]">
            Produto fechado de fábrica — Pix e cartão via Mercado Pago, frete rastreado ou retirada.
          </p>
        </div>
      </section>
    </div>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function SingleCardDetails({
  card,
  details,
  imageUrl,
  activeImage,
  onActiveImage
}: {
  card: TcgCard;
  details: CardDetailsPayload;
  imageUrl: string;
  activeImage: "front" | "back";
  onActiveImage: (value: "front" | "back") => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1.1fr)_minmax(260px,0.95fr)] lg:items-start">
      <section className="mx-auto w-full max-w-[280px]">
        <div className="relative aspect-[5/7] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
          <Image
            src={imageUrl}
            alt={details.name}
            fill
            unoptimized
            priority
            sizes="280px"
            className="object-cover"
          />
        </div>
        {details.backImageUrl ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onActiveImage("front")}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                activeImage === "front"
                  ? "border-[var(--accent)] bg-teal-50 text-teal-800"
                  : "border-[var(--line)] bg-white text-[var(--muted)]"
              }`}
            >
              Face 1
            </button>
            <button
              type="button"
              onClick={() => onActiveImage("back")}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                activeImage === "back"
                  ? "border-[var(--accent)] bg-teal-50 text-teal-800"
                  : "border-[var(--line)] bg-white text-[var(--muted)]"
              }`}
            >
              Face 2
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <div className="border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--ink)]">{details.name}</h2>
            {details.manaCost ? <ManaCostPips cost={details.manaCost} /> : null}
          </div>
          {details.typeLine ? (
            <p className="mt-2 border-t border-[var(--line)] pt-2 text-sm font-medium text-[var(--ink)]">
              {details.typeLine}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 px-4 py-4 text-sm leading-6 text-[var(--ink)]">
          {details.oracleText ? (
            <p className="whitespace-pre-wrap">{details.oracleText}</p>
          ) : (
            <p className="text-[var(--muted)]">Sem texto de regras disponível.</p>
          )}
          {details.flavorText ? (
            <p className="border-t border-[var(--line)] pt-3 italic text-[var(--muted)]">
              {details.flavorText}
            </p>
          ) : null}
          {details.artist ? (
            <p className="text-xs text-[var(--muted)]">Illustrated by {details.artist}</p>
          ) : null}
        </div>

        {details.legalities.length > 0 ? (
          <div className="border-t border-[var(--line)] px-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {details.legalities.map((row) => (
                <div key={row.format} className="flex items-center gap-2 text-sm">
                  <LegalityBadge status={row.status} />
                  <span className="text-[var(--ink)]">{row.format}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <div className="bg-[var(--accent)] px-4 py-3 text-white">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} />
            {details.setName}
            {details.setCode ? ` (${details.setCode})` : ""}
          </p>
          <p className="mt-1 text-xs text-teal-50/90">
            {[
              details.collectorNumber ? `#${details.collectorNumber}` : null,
              details.rarity,
              details.language,
              details.finishes.length ? details.finishes.map(titleFinish).join("/") : null
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {details.languages.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-3 py-3">
            {details.languages.map((lang) => (
              <span
                key={lang}
                className={`grid h-8 min-w-8 place-items-center rounded-md px-2 text-xs font-bold ${
                  lang === details.language
                    ? "bg-[var(--accent)] text-white"
                    : "bg-teal-50 text-teal-900"
                }`}
              >
                {lang}
              </span>
            ))}
          </div>
        ) : null}

        {details.store || details.marketUsdCents ? (
          <div className="border-b border-[var(--line)] px-4 py-3">
            {details.marketUsdCents ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Mercado Scryfall (este print)
                </p>
                <p className="mt-1 text-lg font-semibold text-sky-700">
                  {formatUsd(details.marketUsdCents)}
                </p>
              </>
            ) : null}
            {details.store ? (
              <>
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] ${details.marketUsdCents ? "mt-3" : ""}`}
                >
                  Na Mana Draw
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
                  {formatCurrency(details.store.priceCents)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {details.store.condition} · {details.store.stock} em estoque
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {details.prints.length > 0 ? (
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_52px_52px_44px] gap-2 bg-[var(--ink)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white">
              <span>Prints</span>
              <span className="text-right">USD</span>
              <span className="text-right">EUR</span>
              <span className="text-right">TIX</span>
            </div>
            <ul className="max-h-[340px] overflow-y-auto">
              {details.prints.map((print) => (
                <li
                  key={print.id}
                  className={`grid grid-cols-[minmax(0,1fr)_52px_52px_44px] gap-2 border-b border-[var(--line)] px-3 py-2.5 text-xs ${
                    print.selected ? "bg-teal-50" : "bg-white"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--ink)]">
                      {print.setName}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {print.setCode}
                      {print.collectorNumber ? ` #${print.collectorNumber}` : ""} · {print.rarity}
                    </span>
                  </span>
                  <span className="text-right font-semibold text-sky-700">
                    {print.usd ? `$${print.usd}` : "—"}
                  </span>
                  <span className="text-right font-semibold text-sky-700">
                    {print.eur ? `€${print.eur}` : "—"}
                  </span>
                  <span className="text-right font-semibold text-orange-600">
                    {print.tix ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-[var(--muted)]">
            Sem tabela de prints para este jogo.
          </div>
        )}

        <div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
          Single em estoque: {card.condition} · {card.finish} · {card.language}
        </div>
      </section>
    </div>
  );
}

function LegalityBadge({ status }: { status: CardLegality["status"] }) {
  if (status === "legal") {
    return (
      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Legal
      </span>
    );
  }
  if (status === "banned") {
    return (
      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Banido
      </span>
    );
  }
  if (status === "restricted") {
    return (
      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Restrito
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Não legal
    </span>
  );
}

function ManaCostPips({ cost }: { cost: string }) {
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  if (!symbols.length) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {symbols.map((symbol, index) => (
        <ManaPip key={`${symbol}-${index}`} symbol={symbol} />
      ))}
    </span>
  );
}

function ManaPip({ symbol }: { symbol: string }) {
  const key = symbol.toUpperCase();
  const hybrid = key.includes("/");
  const bg = hybrid
    ? `linear-gradient(135deg, ${PIP_FILL[key.split("/")[0]] ?? "#94a3b8"} 50%, ${
        PIP_FILL[key.split("/")[1]] ?? "#94a3b8"
      } 50%)`
    : PIP_FILL[key] ?? "#cbd5e1";
  const label = hybrid ? key.replace("/", "") : GENERIC_PIP_LABEL[key] ?? key;
  const darkText =
    !hybrid && (key === "W" || /^\d+$/.test(key) || key === "X" || key === "Y" || key === "Z");

  return (
    <span
      className={`inline-grid h-6 min-w-6 place-items-center rounded-full border border-black/40 text-[11px] font-bold leading-none shadow-sm ${
        darkText ? "text-slate-900" : "text-white"
      }`}
      style={{ background: bg }}
      title={symbol}
    >
      {label.length > 2 ? label.slice(0, 2) : label}
    </span>
  );
}

function titleFinish(value: string) {
  if (value === "nonfoil") return "Nonfoil";
  if (value === "foil") return "Foil";
  return value;
}

const PIP_FILL: Record<string, string> = {
  W: "#f8f1d4",
  U: "#0e68ab",
  B: "#3b3b3b",
  R: "#d3202a",
  G: "#00733e",
  C: "#cbc5bb",
  S: "#9e8f72"
};

const GENERIC_PIP_LABEL: Record<string, string> = {
  W: "W",
  U: "U",
  B: "B",
  R: "R",
  G: "G",
  C: "C"
};
