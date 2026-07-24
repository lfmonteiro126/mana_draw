import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { deriveScryfallBackUrl, isDoubleSidedLayout } from "@/lib/card-images";
import {
  getCachedCardSuggestions,
  setCachedCardSuggestions
} from "@/lib/db";
import type { CardSuggestion, Game, TcgCard } from "@/lib/types";

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  set_name?: string;
  set?: string;
  collector_number?: string;
  released_at?: string;
  rarity?: string;
  lang?: string;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
  };
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  finishes?: string[];
  layout?: string;
  type_line?: string;
};

type PokemonCard = {
  id: string;
  name: string;
  set?: { name?: string };
  rarity?: string;
  images?: { large?: string; small?: string };
  number?: string;
  types?: string[];
  supertype?: string;
  subtypes?: string[];
  tcgplayer?: {
    prices?: Record<string, { market?: number; mid?: number; low?: number } | undefined>;
  };
  cardmarket?: {
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      average?: number;
      low?: number;
    };
  };
};

type YgoCard = {
  id: number;
  name: string;
  type?: string;
  race?: string;
  archetype?: string;
  card_images?: Array<{ image_url?: string; image_url_small?: string }>;
  card_sets?: Array<{
    set_name?: string;
    set_code?: string;
    set_rarity?: string;
    set_price?: string;
  }>;
  card_prices?: Array<{
    cardmarket_price?: string;
    tcgplayer_price?: string;
    ebay_price?: string;
    amazon_price?: string;
    coolstuffinc_price?: string;
  }>;
};

const validGames: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const CACHE_PREFIX = "prints:v4:";

export async function GET(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ suggestions: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const game = searchParams.get("game") as Game | null;
  const query = searchParams.get("query")?.trim() ?? "";

  if (!game || !validGames.includes(game) || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const cacheKey = `${CACHE_PREFIX}${normalizeQuery(query)}`;
  const cached = await getCachedCardSuggestions({ game, query: cacheKey });
  if (cached) return NextResponse.json({ suggestions: cached });

  try {
    const suggestions = await lookupCards(game, query);
    await setCachedCardSuggestions({ game, query: cacheKey, suggestions });
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}

async function lookupCards(game: Game, query: string): Promise<CardSuggestion[]> {
  if (game === "Magic") return lookupMagic(query);
  if (game === "Pokemon") return lookupPokemon(query);
  return lookupYugioh(query);
}

async function lookupMagic(query: string): Promise<CardSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    unique: "prints",
    order: "released",
    dir: "desc"
  });
  const response = await fetch(`https://api.scryfall.com/cards/search?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ManaDrawTCG/1.0"
    },
    next: { revalidate: 60 * 60 * 6 }
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: ScryfallCard[] };
  const prints = payload.data ?? [];
  const fallbackByOracle = buildScryfallOracleFallback(prints);
  const topPrints = prints.slice(0, 12);

  const missingOracleIds = [
    ...new Set(
      topPrints
        .filter((card) => {
          const preferFoil = isFoilOnly(card);
          const local = scryfallMarketPrice(card, preferFoil);
          return local <= 0 && Boolean(card.oracle_id) && !fallbackByOracle.has(card.oracle_id!);
        })
        .map((card) => card.oracle_id!)
    )
  ].slice(0, 5);

  if (missingOracleIds.length > 0) {
    const englishPrices = await Promise.all(
      missingOracleIds.map((oracleId) => fetchScryfallEnglishPrice(oracleId))
    );
    englishPrices.forEach((price, index) => {
      if (price > 0) fallbackByOracle.set(missingOracleIds[index], price);
    });
  }

  return topPrints
    .map((card) => {
      const preferFoil = isFoilOnly(card);
      let price = scryfallMarketPrice(card, preferFoil);
      if (price <= 0 && card.oracle_id) {
        price = fallbackByOracle.get(card.oracle_id) ?? 0;
      }

      const frontImageUrl =
        card.image_uris?.normal ??
        card.image_uris?.large ??
        card.card_faces?.[0]?.image_uris?.normal ??
        card.card_faces?.[0]?.image_uris?.large ??
        "";
      const faceBackUrl =
        card.card_faces?.[1]?.image_uris?.normal ??
        card.card_faces?.[1]?.image_uris?.large ??
        "";
      const backImageUrl =
        faceBackUrl ||
        (isDoubleSidedLayout(card.layout) ? deriveScryfallBackUrl(frontImageUrl) : "") ||
        "";
      const printLabel = compact([
        card.set?.toUpperCase(),
        card.collector_number,
        card.released_at
      ]).join(" · ");

      return {
        externalId: card.id,
        name: card.name,
        game: "Magic",
        setName: card.set_name ?? "Magic",
        printLabel,
        rarity: titleCase(card.rarity ?? "Unknown"),
        language: mapLanguage(card.lang),
        marketPriceCents: cents(price),
        imageUrl: frontImageUrl,
        backImageUrl: backImageUrl || undefined,
        isDoubleSided: Boolean(backImageUrl) || isDoubleSidedLayout(card.layout),
        layout: card.layout,
        tags: compact(["Magic", card.set, card.collector_number, card.type_line, card.rarity, card.layout]),
        finish: preferFoil || card.finishes?.includes("foil") ? "Foil" : "Normal",
        source: "Scryfall"
      } satisfies CardSuggestion;
    })
    .filter((card) => card.imageUrl);
}

async function lookupPokemon(query: string): Promise<CardSuggestion[]> {
  const params = new URLSearchParams({
    q: `name:${escapePokemonQuery(query)}*`,
    pageSize: "8",
    orderBy: "-set.releaseDate",
    select: "id,name,set,rarity,images,types,supertype,subtypes,tcgplayer,cardmarket"
  });
  const response = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 }
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: PokemonCard[] };

  return (payload.data ?? []).map((card) => {
    const price = bestPokemonPrice(card);
    const rarity = card.rarity ?? "Unknown";

    return {
      externalId: card.id,
      name: card.name,
      game: "Pokemon",
      setName: card.set?.name ?? "Pokemon",
      printLabel: card.number ? `#${card.number}` : card.id,
      rarity,
      language: "EN",
      marketPriceCents: cents(price),
      imageUrl: card.images?.large ?? card.images?.small ?? "",
      tags: compact(["Pokemon", card.number, card.supertype, ...(card.types ?? []), ...(card.subtypes ?? [])]),
      finish: rarity.toLowerCase().includes("holo") ? "Holo" : "Normal",
      source: "Pokemon TCG"
    } satisfies CardSuggestion;
  }).filter((card) => card.imageUrl);
}

async function lookupYugioh(query: string): Promise<CardSuggestion[]> {
  const params = new URLSearchParams({
    fname: query,
    num: "8",
    offset: "0"
  });
  const response = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 }
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: YgoCard[] };

  return (payload.data ?? []).flatMap((card) => {
    const sets = card.card_sets?.length ? card.card_sets : [{}];
    const cardLevelFallback = ygoCardLevelPrice(card);

    return sets.map((set) => {
      const rarity = set.set_rarity ?? "Unknown";
      const setPrice = Number(set.set_price ?? 0);
      const price = setPrice > 0 ? setPrice : cardLevelFallback;

      return {
        externalId: `${card.id}-${set.set_code ?? set.set_name ?? "unknown"}`,
        name: card.name,
        game: "Yu-Gi-Oh!",
        setName: set.set_name ?? "Yu-Gi-Oh!",
        printLabel: set.set_code ?? "Sem codigo",
        rarity,
        language: "EN",
        marketPriceCents: cents(price),
        imageUrl: card.card_images?.[0]?.image_url ?? card.card_images?.[0]?.image_url_small ?? "",
        tags: compact(["Yu-Gi-Oh!", set.set_code, card.type, card.race, card.archetype]),
        finish: rarity.toLowerCase().includes("secret") ? "Secret" : "Normal",
        source: "YGOPRODeck"
      } satisfies CardSuggestion;
    });
  }).filter((card) => card.imageUrl).slice(0, 12);
}

function isFoilOnly(card: ScryfallCard) {
  return Boolean(card.finishes?.includes("foil") && !card.finishes?.includes("nonfoil"));
}

function scryfallMarketPrice(card: ScryfallCard, preferFoil: boolean) {
  const prices = card.prices ?? {};
  const ordered = preferFoil
    ? [prices.usd_foil, prices.usd, prices.usd_etched, prices.eur_foil, prices.eur]
    : [prices.usd, prices.usd_foil, prices.usd_etched, prices.eur, prices.eur_foil];

  for (const value of ordered) {
    const price = Number(value);
    if (Number.isFinite(price) && price > 0) return price;
  }

  return 0;
}

function buildScryfallOracleFallback(prints: ScryfallCard[]) {
  const fallback = new Map<string, number>();

  for (const card of prints) {
    if (!card.oracle_id) continue;
    const price = scryfallMarketPrice(card, false);
    if (price <= 0) continue;

    const current = fallback.get(card.oracle_id);
    if (current === undefined || price < current) {
      fallback.set(card.oracle_id, price);
    }
  }

  return fallback;
}

async function fetchScryfallEnglishPrice(oracleId: string) {
  const params = new URLSearchParams({
    q: `oracleid:${oracleId} lang:en`,
    unique: "prints",
    order: "usd",
    dir: "asc"
  });

  try {
    const response = await fetch(`https://api.scryfall.com/cards/search?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ManaDrawTCG/1.0"
      },
      next: { revalidate: 60 * 60 * 6 }
    });
    if (!response.ok) return 0;

    const payload = (await response.json()) as { data?: ScryfallCard[] };
    for (const card of payload.data ?? []) {
      const price = scryfallMarketPrice(card, false);
      if (price > 0) return price;
    }
  } catch {
    return 0;
  }

  return 0;
}

function bestPokemonPrice(card: PokemonCard) {
  const variants = Object.entries(card.tcgplayer?.prices ?? {});
  const preferredOrder = [
    "normal",
    "holofoil",
    "reverseHolofoil",
    "1stEditionHolofoil",
    "1stEditionNormal",
    "unlimitedHolofoil"
  ];

  const ranked = [...variants].sort(([left], [right]) => {
    const leftRank = preferredOrder.indexOf(left);
    const rightRank = preferredOrder.indexOf(right);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });

  for (const [, price] of ranked) {
    const market = price?.market ?? price?.mid ?? price?.low ?? 0;
    if (market > 0) return market;
  }

  const cardmarket = card.cardmarket?.prices;
  const marketFallbacks = [
    cardmarket?.averageSellPrice,
    cardmarket?.trendPrice,
    cardmarket?.average,
    cardmarket?.low
  ];

  for (const value of marketFallbacks) {
    if (typeof value === "number" && value > 0) return value;
  }

  return 0;
}

function ygoCardLevelPrice(card: YgoCard) {
  const prices = card.card_prices?.[0];
  if (!prices) return 0;

  for (const key of [
    "tcgplayer_price",
    "cardmarket_price",
    "coolstuffinc_price",
    "ebay_price",
    "amazon_price"
  ] as const) {
    const value = Number(prices[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function cents(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function compact(values: Array<string | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapLanguage(lang?: string): TcgCard["language"] {
  if (lang === "pt") return "PT";
  if (lang === "ja") return "JP";
  return "EN";
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function escapePokemonQuery(value: string) {
  return value.replace(/["\\]/g, "").trim();
}
