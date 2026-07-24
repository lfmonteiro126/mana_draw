import { NextResponse } from "next/server";
import {
  deriveScryfallBackUrl,
  extractScryfallIdFromImageUrl,
  isDoubleSidedLayout
} from "@/lib/card-images";
import type { CardDetailsPayload, CardLegality, CardPrintRow } from "@/lib/card-details";
import {
  scryfallFinishFromCard,
  scryfallUsdPrice,
  usdToCents
} from "@/lib/scryfall-price";
import type { Game } from "@/lib/types";

type ScryfallCard = {
  object?: string;
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  artist?: string;
  set_name?: string;
  set?: string;
  collector_number?: string;
  rarity?: string;
  lang?: string;
  finishes?: string[];
  layout?: string;
  oracle_id?: string;
  legalities?: Record<string, string>;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  };
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    flavor_text?: string;
    artist?: string;
    image_uris?: { normal?: string; large?: string };
  }>;
  prints_search_uri?: string;
};

const LEGALITY_ORDER = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "oathbreaker",
  "alchemy",
  "historic",
  "brawl",
  "timeless",
  "pauper",
  "penny"
] as const;

const FORMAT_LABELS: Record<string, string> = {
  standard: "Standard",
  pioneer: "Pioneer",
  modern: "Modern",
  legacy: "Legacy",
  vintage: "Vintage",
  commander: "Commander",
  oathbreaker: "Oathbreaker",
  alchemy: "Alchemy",
  historic: "Historic",
  brawl: "Brawl",
  timeless: "Timeless",
  pauper: "Pauper",
  penny: "Penny"
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = (searchParams.get("game") ?? "Magic") as Game;
  const name = searchParams.get("name")?.trim() ?? "";
  const setName = searchParams.get("set")?.trim() ?? "";
  const imageUrl = searchParams.get("imageUrl")?.trim() ?? "";
  const priceCents = Number(searchParams.get("priceCents") ?? "");
  const marketPriceCents = Number(searchParams.get("marketPriceCents") ?? "");
  const stock = Number(searchParams.get("stock") ?? "");
  const condition = searchParams.get("condition")?.trim() ?? "";

  if (!name && !imageUrl) {
    return NextResponse.json({ ok: false, message: "Informe name ou imageUrl." }, { status: 400 });
  }

  try {
    if (game === "Magic") {
      const details = await fetchMagicDetails({ name, setName, imageUrl });
      if (!details) {
        return NextResponse.json({ ok: false, message: "Carta não encontrada no Scryfall." }, { status: 404 });
      }

      if (Number.isFinite(priceCents) || Number.isFinite(marketPriceCents) || Number.isFinite(stock)) {
        details.store = {
          priceCents: Number.isFinite(priceCents) ? priceCents : 0,
          marketPriceCents: Number.isFinite(marketPriceCents) ? marketPriceCents : 0,
          stock: Number.isFinite(stock) ? stock : 0,
          condition: condition || "NM"
        };
      }

      return NextResponse.json({ ok: true, details });
    }

    // Fallback genérico para Pokemon / YGO com o que a loja já tem
    const details: CardDetailsPayload = {
      game,
      name: name || "Carta",
      manaCost: "",
      typeLine: setName || game,
      oracleText: "Detalhes completos indisponíveis para este jogo neste momento.",
      flavorText: "",
      artist: "",
      imageUrl,
      setName: setName || game,
      setCode: "",
      collectorNumber: "",
      rarity: "",
      language: "EN",
      finishes: [],
      legalities: [],
      prints: [],
      languages: [],
      store: {
        priceCents: Number.isFinite(priceCents) ? priceCents : 0,
        marketPriceCents: Number.isFinite(marketPriceCents) ? marketPriceCents : 0,
        stock: Number.isFinite(stock) ? stock : 0,
        condition: condition || "NM"
      }
    };

    return NextResponse.json({ ok: true, details });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Falha ao carregar detalhes." }, { status: 500 });
  }
}

async function fetchMagicDetails(input: {
  name: string;
  setName: string;
  imageUrl: string;
}): Promise<CardDetailsPayload | null> {
  const card = await resolveScryfallCard(input);
  if (!card) return null;

  let prints: CardPrintRow[] = [];
  let languages: string[] = [(card.lang ?? "en").toUpperCase()];

  try {
    prints = await fetchPrints(card);
    languages = await collectLanguages(card);
  } catch {
    // Detalhes principais não dependem de prints/idiomas.
  }

  const face0 = card.card_faces?.[0];
  const face1 = card.card_faces?.[1];
  const frontImage =
    card.image_uris?.large ??
    card.image_uris?.normal ??
    face0?.image_uris?.large ??
    face0?.image_uris?.normal ??
    input.imageUrl;
  const backImage =
    face1?.image_uris?.large ??
    face1?.image_uris?.normal ??
    (isDoubleSidedLayout(card.layout) ? deriveScryfallBackUrl(frontImage) : undefined);

  const finishKind = scryfallFinishFromCard(card.finishes);
  const marketUsd = scryfallUsdPrice(card.prices, finishKind);

  return {
    game: "Magic",
    name: card.name,
    manaCost: card.mana_cost ?? face0?.mana_cost ?? "",
    typeLine: card.type_line ?? face0?.type_line ?? "",
    oracleText: joinFacesText(card, "oracle_text"),
    flavorText: joinFacesText(card, "flavor_text"),
    artist: card.artist ?? face0?.artist ?? "",
    imageUrl: frontImage,
    backImageUrl: backImage,
    setName: card.set_name ?? "",
    setCode: (card.set ?? "").toUpperCase(),
    collectorNumber: card.collector_number ?? "",
    rarity: titleCase(card.rarity ?? ""),
    language: (card.lang ?? "en").toUpperCase(),
    finishes: card.finishes ?? [],
    legalities: mapLegalities(card.legalities ?? {}),
    prints,
    languages: languages.length ? languages : [(card.lang ?? "en").toUpperCase()],
    marketUsdCents: usdToCents(marketUsd),
    store: undefined
  };
}

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ManaDrawTCG/1.0"
};

async function resolveScryfallCard(input: {
  name: string;
  setName: string;
  imageUrl: string;
}): Promise<ScryfallCard | null> {
  const scryfallId = extractScryfallIdFromImageUrl(input.imageUrl);

  if (scryfallId) {
    const byId = await fetchScryfallJson<ScryfallCard>(`https://api.scryfall.com/cards/${scryfallId}`);
    if (byId?.object !== "error" && byId?.id) return byId;
  }

  const namesToTry = uniqueNames([
    input.name,
    input.name.includes("//") ? input.name.split("//")[0]?.trim() : "",
    input.name.includes("//") ? input.name.split("//")[1]?.trim() : ""
  ]);

  for (const name of namesToTry) {
    // Nunca passar set_name no parâmetro `set` — Scryfall exige código (ex.: spg), não "Special Guests".
    const fuzzy = await fetchScryfallJson<ScryfallCard>(
      `https://api.scryfall.com/cards/named?${new URLSearchParams({ fuzzy: name })}`
    );
    if (fuzzy?.object !== "error" && fuzzy?.id) return fuzzy;

    const exact = await fetchScryfallJson<ScryfallCard>(
      `https://api.scryfall.com/cards/named?${new URLSearchParams({ exact: name })}`
    );
    if (exact?.object !== "error" && exact?.id) return exact;
  }

  if (input.name) {
    const search = await fetchScryfallJson<{ data?: ScryfallCard[] }>(
      `https://api.scryfall.com/cards/search?${new URLSearchParams({
        q: `!"${input.name}"`,
        unique: "prints"
      })}`
    );
    if (search?.data?.[0]) return search.data[0];

    const loose = await fetchScryfallJson<{ data?: ScryfallCard[] }>(
      `https://api.scryfall.com/cards/search?${new URLSearchParams({
        q: input.name,
        unique: "prints"
      })}`
    );
    if (loose?.data?.[0]) return loose.data[0];
  }

  return null;
}

async function fetchScryfallJson<T extends { object?: string; id?: string; data?: unknown }>(
  url: string
): Promise<(T & { object?: string }) | null> {
  try {
    const response = await fetch(url, {
      headers: SCRYFALL_HEADERS,
      next: { revalidate: 60 * 60 * 6 }
    });
    const payload = (await response.json()) as T & { object?: string };
    if (!response.ok || payload.object === "error") return null;
    return payload;
  } catch {
    return null;
  }
}

function uniqueNames(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter((value) => value.length >= 2))];
}

async function fetchPrints(card: ScryfallCard): Promise<CardPrintRow[]> {
  const uri =
    card.prints_search_uri ||
    (card.oracle_id
      ? `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracleid:${card.oracle_id}`)}&unique=prints&order=released`
      : null);

  if (!uri) return [];

  const response = await fetch(uri, {
    headers: SCRYFALL_HEADERS,
    next: { revalidate: 60 * 60 * 6 }
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: ScryfallCard[] };
  const rows = (payload.data ?? []).slice(0, 14);

  return rows.map((print) => {
    const image =
      print.image_uris?.normal ??
      print.card_faces?.[0]?.image_uris?.normal ??
      "";
    return {
      id: print.id,
      setName: print.set_name ?? "",
      setCode: (print.set ?? "").toUpperCase(),
      collectorNumber: print.collector_number ?? "",
      rarity: titleCase(print.rarity ?? ""),
      usd: print.prices?.usd ?? print.prices?.usd_foil ?? null,
      eur: print.prices?.eur ?? print.prices?.eur_foil ?? null,
      tix: print.prices?.tix ?? null,
      imageUrl: image,
      selected: print.id === card.id
    };
  });
}

async function collectLanguages(card: ScryfallCard) {
  const uri = card.prints_search_uri;
  if (!uri) return [(card.lang ?? "en").toUpperCase()];
  try {
    const response = await fetch(uri, {
      headers: SCRYFALL_HEADERS,
      next: { revalidate: 60 * 60 * 6 }
    });
    if (!response.ok) return [(card.lang ?? "en").toUpperCase()];
    const payload = (await response.json()) as { data?: Array<{ lang?: string }> };
    const codes = [
      ...new Set((payload.data ?? []).map((row) => (row.lang ?? "en").toUpperCase()))
    ];
    const preferred = ["EN", "PT", "ES", "FR", "DE", "IT", "JA", "KO", "ZH", "ZHS", "ZHT"];
    codes.sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return codes.length ? codes.slice(0, 12) : [(card.lang ?? "en").toUpperCase()];
  } catch {
    return [(card.lang ?? "en").toUpperCase()];
  }
}

function joinFacesText(card: ScryfallCard, key: "oracle_text" | "flavor_text") {
  if (card[key]) return card[key] ?? "";
  return (card.card_faces ?? [])
    .map((face) => face[key] ?? "")
    .filter(Boolean)
    .join("\n\n");
}

function mapLegalities(legalities: Record<string, string>): CardLegality[] {
  return LEGALITY_ORDER.map((format) => {
    const raw = (legalities[format] ?? "not_legal").toLowerCase();
    const status =
      raw === "legal" || raw === "restricted" || raw === "banned"
        ? (raw as CardLegality["status"])
        : raw === "not_legal"
          ? "not_legal"
          : "other";
    return {
      format: FORMAT_LABELS[format] ?? format,
      status
    };
  });
}

function titleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
