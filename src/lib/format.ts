export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

/** Centavos de dólar (ex.: Scryfall USD * 100). */
export function formatUsd(valueInCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(valueInCents / 100);
}

export function formatStock(stock: number) {
  if (stock === 1) return "1 disponível";
  return `${stock} disponíveis`;
}

/** True when store price is meaningfully below market reference. */
export function hasMarketSavings(priceCents: number, marketPriceCents: number) {
  return marketPriceCents > 0 && marketPriceCents > priceCents;
}

export function discountPercent(priceCents: number, marketPriceCents: number) {
  if (!hasMarketSavings(priceCents, marketPriceCents)) return 0;
  return Math.max(1, Math.round(((marketPriceCents - priceCents) / marketPriceCents) * 100));
}
