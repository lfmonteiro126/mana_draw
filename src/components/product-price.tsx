import { discountPercent, formatCurrency, hasMarketSavings } from "@/lib/format";

type Props = {
  priceCents: number;
  marketPriceCents?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showMarketHint?: boolean;
};

const priceSize = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl"
} as const;

const marketSize = {
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm"
} as const;

export function ProductPrice({
  priceCents,
  marketPriceCents = 0,
  size = "md",
  className = "",
  showMarketHint = true
}: Props) {
  const savings = hasMarketSavings(priceCents, marketPriceCents);
  const percent = discountPercent(priceCents, marketPriceCents);

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={`${priceSize[size]} font-semibold tracking-tight text-[var(--ink)]`}>
          {formatCurrency(priceCents)}
        </p>
        {savings ? (
          <>
            <span className={`${marketSize[size]} text-[var(--muted)] line-through`}>
              {formatCurrency(marketPriceCents)}
            </span>
            <span className="rounded-[0.4rem] bg-[var(--accent)]/12 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--accent-strong)]">
              −{percent}%
            </span>
          </>
        ) : null}
      </div>
      {savings && showMarketHint ? (
        <p className={`mt-0.5 ${marketSize[size]} text-[var(--muted)]`}>vs. referência de mercado</p>
      ) : null}
    </div>
  );
}
