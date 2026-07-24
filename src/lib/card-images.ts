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

export function extractScryfallIdFromImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return undefined;
  const match = imageUrl.match(
    /cards\.scryfall\.io\/(?:normal|large|small|png|art_crop|border_crop)\/(?:front|back)\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})/i
  );
  if (match?.[1]) return match[1];

  // Fallback mais permissivo para URLs Scryfall com querystring/formatos extras.
  const loose = imageUrl.match(
    /scryfall\.io\/[^?\s]*\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return loose?.[1];
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
