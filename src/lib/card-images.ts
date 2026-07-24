const DOUBLE_SIDED_LAYOUTS = new Set([
  "transform",
  "modal_dfc",
  "double_faced_token",
  "art_series",
  "reversible_card"
]);

export function isDoubleSidedLayout(layout?: string | null) {
  if (!layout) return false;
  return DOUBLE_SIDED_LAYOUTS.has(layout.toLowerCase());
}

/** Scryfall front/back URLs mirror each other under /front/ and /back/. */
export function deriveScryfallBackUrl(frontUrl?: string | null) {
  if (!frontUrl) return undefined;
  if (!frontUrl.includes("/front/")) return undefined;
  return frontUrl.replace("/front/", "/back/");
}

export function resolveCardBackImageUrl(card: {
  imageUrl: string;
  backImageUrl?: string | null;
  isDoubleSided?: boolean | null;
  layout?: string | null;
  tags?: string[];
}) {
  if (card.backImageUrl) return card.backImageUrl;

  const layoutHint =
    isDoubleSidedLayout(card.layout) ||
    Boolean(card.isDoubleSided) ||
    (card.tags ?? []).some((tag) => isDoubleSidedLayout(tag));

  if (!layoutHint) return undefined;
  return deriveScryfallBackUrl(card.imageUrl);
}

export function cardHasSecondFace(card: {
  imageUrl: string;
  backImageUrl?: string | null;
  isDoubleSided?: boolean | null;
  layout?: string | null;
  tags?: string[];
}) {
  return Boolean(resolveCardBackImageUrl(card));
}
