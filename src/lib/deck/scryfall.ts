import type { ScryfallCardData } from "./types";

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ManaDrawTCG/1.0 (Commander Deck Analyzer)",
  "Content-Type": "application/json"
};

type CollectionNotFound = { name?: string };

type CollectionResponse = {
  data?: ScryfallCardData[];
  not_found?: CollectionNotFound[];
};

export async function fetchScryfallCollection(names: string[]) {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const found = new Map<string, ScryfallCardData>();
  const unresolved: string[] = [];

  for (const chunk of chunkArray(unique, 75)) {
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: SCRYFALL_HEADERS,
      body: JSON.stringify({
        identifiers: chunk.map((name) => ({ name }))
      }),
      next: { revalidate: 60 * 60 * 12 }
    });

    if (!response.ok) {
      unresolved.push(...chunk);
      continue;
    }

    const payload = (await response.json()) as CollectionResponse;
    for (const card of payload.data ?? []) {
      found.set(normalizeName(card.name), card);
      // Faces compostas: "A // B" também deve responder a buscas pelo nome frontal.
      const front = card.name.split(" // ")[0]?.trim();
      if (front) found.set(normalizeName(front), card);
    }
    for (const missing of payload.not_found ?? []) {
      if (missing.name) unresolved.push(missing.name);
    }

    // Scryfall pede ~50–100ms entre requests.
    await sleep(80);
  }

  // Retry fuzzy para não encontrados (nomes PT / typos leves via named endpoint é caro;
  // tentamos exact front-face apenas).
  const stillMissing = unresolved.filter((name) => !found.has(normalizeName(name)));
  for (const name of stillMissing.slice(0, 12)) {
    const card = await fetchScryfallNamed(name);
    if (card) {
      found.set(normalizeName(name), card);
      found.set(normalizeName(card.name), card);
    }
    await sleep(100);
  }

  const finalUnresolved = unique.filter((name) => !found.has(normalizeName(name)));
  return { found, unresolved: finalUnresolved };
}

async function fetchScryfallNamed(name: string) {
  const params = new URLSearchParams({ fuzzy: name });
  const response = await fetch(`https://api.scryfall.com/cards/named?${params}`, {
    headers: SCRYFALL_HEADERS,
    next: { revalidate: 60 * 60 * 12 }
  });
  if (!response.ok) return null;
  return (await response.json()) as ScryfallCardData;
}

export async function fetchScryfallCardByName(name: string) {
  return fetchScryfallNamed(name.trim());
}

export function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cardOracleText(card: ScryfallCardData) {
  if (card.oracle_text) return card.oracle_text;
  return (card.card_faces ?? [])
    .map((face) => face.oracle_text ?? "")
    .filter(Boolean)
    .join("\n");
}

export function cardImageUrl(card: ScryfallCardData) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small ??
    ""
  );
}

export function cardArtCropUrl(card: ScryfallCardData) {
  const direct =
    card.image_uris?.art_crop ??
    card.card_faces?.[0]?.image_uris?.art_crop ??
    "";
  if (direct) return direct;

  const fallback = cardImageUrl(card);
  if (!fallback) return "";
  return fallback
    .replace("/normal/", "/art_crop/")
    .replace("/large/", "/art_crop/")
    .replace("/small/", "/art_crop/");
}

export function cardTypeLine(card: ScryfallCardData) {
  if (card.type_line) return card.type_line;
  return (card.card_faces ?? []).map((face) => face.type_line ?? "").filter(Boolean).join(" // ");
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
