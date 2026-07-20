import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  getCachedCardSuggestions,
  setCachedCardSuggestions
} from "@/lib/db";
import type { CardSuggestion, Game, TcgCard } from "@/lib/types";

type ScryfallCard = {
  id: string;
  name: string;
  set_name?: string;
  set?: string;
  collector_number?: string;
  released_at?: string;
  rarity?: string;
  lang?: string;
  prices?: { usd?: string | null; usd_foil?: string | null };
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  finishes?: string[];
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
    prices?: Record<string, { market?: number; mid?: number } | undefined>;
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
};

const validGames: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];

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

  const cacheKey = `prints:${normalizeQuery(query)}`;
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
      "User-Agent": "NovaManaTCG/1.0"
    },
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: ScryfallCard[] };

  return (payload.data ?? [])
    .slice(0, 12)
    .map((card) => {
      const price = Number(card.prices?.usd_foil ?? card.prices?.usd ?? 0);
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
        imageUrl:
          card.image_uris?.normal ??
          card.image_uris?.large ??
          card.card_faces?.[0]?.image_uris?.normal ??
          card.card_faces?.[0]?.image_uris?.large ??
          "",
        tags: compact(["Magic", card.set, card.collector_number, card.type_line, card.rarity]),
        finish: card.finishes?.includes("foil") ? "Foil" : "Normal",
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
    select: "id,name,set,rarity,images,types,supertype,subtypes,tcgplayer"
  });
  const response = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 }
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
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: YgoCard[] };

  return (payload.data ?? []).flatMap((card) => {
    const sets = card.card_sets?.length ? card.card_sets : [{}];

    return sets.map((set) => {
      const rarity = set.set_rarity ?? "Unknown";

      return {
        externalId: `${card.id}-${set.set_code ?? set.set_name ?? "unknown"}`,
        name: card.name,
        game: "Yu-Gi-Oh!",
        setName: set.set_name ?? "Yu-Gi-Oh!",
        printLabel: set.set_code ?? "Sem codigo",
        rarity,
        language: "EN",
        marketPriceCents: cents(Number(set.set_price ?? 0)),
        imageUrl: card.card_images?.[0]?.image_url ?? card.card_images?.[0]?.image_url_small ?? "",
        tags: compact(["Yu-Gi-Oh!", set.set_code, card.type, card.race, card.archetype]),
        finish: rarity.toLowerCase().includes("secret") ? "Secret" : "Normal",
        source: "YGOPRODeck"
      } satisfies CardSuggestion;
    });
  }).filter((card) => card.imageUrl).slice(0, 12);
}

function bestPokemonPrice(card: PokemonCard) {
  const prices = Object.values(card.tcgplayer?.prices ?? {});
  const markets = prices
    .map((price) => price?.market ?? price?.mid ?? 0)
    .filter((price) => price > 0);

  return markets[0] ?? 0;
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
