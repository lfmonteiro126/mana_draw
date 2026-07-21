import { neon } from "@neondatabase/serverless";
import { cards as fallbackCards } from "./mock-data";
import type {
  AdminCustomer,
  BuylistSubmission,
  CardSuggestion,
  FilterGame,
  OrderSummary,
  SortMode,
  StoreUser,
  TcgCard
} from "./types";

type DbCard = {
  id: string;
  name: string;
  game: TcgCard["game"];
  set_name: string;
  rarity: string;
  condition: TcgCard["condition"];
  language: TcgCard["language"];
  price_cents: number;
  market_price_cents: number;
  stock: number;
  image_url: string;
  tags: string[];
  finish: TcgCard["finish"];
};

type DbUser = {
  id: string;
  name: string;
  email: string;
  role: StoreUser["role"];
};

type DbOrder = {
  id: string;
  status: string;
  subtotal_cents: number;
  created_at: string;
  item_count: number;
  customer_email?: string;
};

type DbBuylistSubmission = {
  id: string;
  customer_name: string;
  email: string;
  game: BuylistSubmission["game"];
  status: string;
  notes: string | null;
  photo_count: number;
  offer_cents: number | null;
  photo_urls: string[] | null;
  created_at: string;
};

type DbAdminCustomer = {
  id: string;
  name: string;
  email: string;
  role: StoreUser["role"];
  order_count: number;
  total_spent_cents: number;
  buylist_count: number;
  last_order_at: string | null;
  created_at: string;
};

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
}

export function mapCard(card: DbCard): TcgCard {
  return {
    id: card.id,
    name: card.name,
    game: card.game,
    setName: card.set_name,
    rarity: card.rarity,
    condition: card.condition,
    language: card.language,
    priceCents: card.price_cents,
    marketPriceCents: card.market_price_cents,
    stock: card.stock,
    imageUrl: card.image_url,
    tags: card.tags,
    finish: card.finish
  };
}

export function mapUser(user: DbUser): StoreUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export async function getCatalogCards({
  query = "",
  game = "Todos",
  sort = "relevance"
}: {
  query?: string;
  game?: FilterGame;
  sort?: SortMode;
} = {}): Promise<TcgCard[]> {
  const normalizedQuery = query.trim();

  if (!hasDatabase()) {
    const visible = fallbackCards.filter((card) => {
      const matchesGame = game === "Todos" || card.game === game;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [card.name, card.setName, card.rarity, card.game, ...card.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery.toLowerCase());

      return matchesGame && matchesQuery;
    });

    return sortCards(visible, sort);
  }

  const sql = getSql();
  if (!sql) return fallbackCards;

  const rows = await sql`
    select
      id,
      name,
      game,
      set_name,
      rarity,
      condition,
      language,
      price_cents,
      market_price_cents,
      stock,
      image_url,
      tags,
      finish
    from cards
    where
      active = true
      and (${game} = 'Todos' or game::text = ${game})
      and (
        ${normalizedQuery} = ''
        or search_vector @@ websearch_to_tsquery('simple', ${normalizedQuery})
      )
    order by
      case when ${sort} = 'price-asc' then price_cents end asc,
      case when ${sort} = 'price-desc' then price_cents end desc,
      case when ${sort} = 'relevance' and ${normalizedQuery} <> ''
        then ts_rank(
          search_vector,
          websearch_to_tsquery('simple', ${normalizedQuery})
        )
      end desc,
      featured desc,
      updated_at desc
    limit 24
  `;

  const cards = (rows as DbCard[]).map(mapCard);
  if (cards.length === 0 && normalizedQuery === "" && game === "Todos") {
    return sortCards(fallbackCards, sort);
  }

  return cards;
}

export async function getFeaturedCards(): Promise<TcgCard[]> {
  return getCatalogCards();
}

export async function getAdminCards({
  query = "",
  game = "Todos",
  stock = "all",
  limit = 100
}: {
  query?: string;
  game?: FilterGame;
  stock?: "all" | "low" | "out";
  limit?: number;
} = {}): Promise<TcgCard[]> {
  const normalizedQuery = query.trim();
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 10000);

  if (!hasDatabase()) {
    return fallbackCards.filter((card) => {
      const matchesGame = game === "Todos" || card.game === game;
      const matchesStock =
        stock === "all" ||
        (stock === "low" && card.stock > 0 && card.stock <= 3) ||
        (stock === "out" && card.stock === 0);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [card.name, card.setName, card.rarity, card.game, ...card.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery.toLowerCase());

      return matchesGame && matchesStock && matchesQuery;
    });
  }
  const sql = getSql();
  if (!sql) return fallbackCards;

  const rows = await sql`
    select
      id,
      name,
      game,
      set_name,
      rarity,
      condition,
      language,
      price_cents,
      market_price_cents,
      stock,
      image_url,
      tags,
      finish
    from cards
    where
      active = true
      and
      (${game} = 'Todos' or game::text = ${game})
      and (
        ${stock} = 'all'
        or (${stock} = 'low' and stock > 0 and stock <= 3)
        or (${stock} = 'out' and stock = 0)
      )
      and (
        ${normalizedQuery} = ''
        or search_vector @@ websearch_to_tsquery('simple', ${normalizedQuery})
      )
    order by updated_at desc
    limit ${normalizedLimit}
  `;

  const cards = dedupeCards((rows as DbCard[]).map(mapCard));
  if (cards.length === 0 && normalizedQuery === "" && game === "Todos" && stock === "all") {
    return fallbackCards;
  }

  return cards;
}

function dedupeCards(cards: TcgCard[]) {
  const merged = new Map<string, TcgCard>();

  for (const card of cards) {
    const key = [
      card.game,
      card.name.trim().toLowerCase(),
      card.setName.trim().toLowerCase(),
      card.rarity.trim().toLowerCase(),
      card.condition,
      card.language,
      card.finish,
      card.imageUrl
    ].join("|");
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, {
        ...existing,
        stock: existing.stock + card.stock,
        priceCents: card.priceCents,
        marketPriceCents: card.marketPriceCents,
        tags: Array.from(new Set([...existing.tags, ...card.tags]))
      });
    } else {
      merged.set(key, card);
    }
  }

  return Array.from(merged.values());
}

export async function getAdminOrders(): Promise<OrderSummary[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    select
      orders.id,
      orders.customer_email,
      orders.status,
      orders.subtotal_cents,
      orders.created_at::text,
      coalesce(sum(order_items.quantity), 0)::int as item_count
    from orders
    left join order_items on order_items.order_id = orders.id
    group by orders.id
    order by orders.created_at desc
    limit 30
  `;

  return (rows as DbOrder[]).map((order) => ({
    id: order.id,
    status: order.status,
    subtotalCents: order.subtotal_cents,
    createdAt: order.created_at,
    itemCount: order.item_count,
    customerEmail: order.customer_email
  }));
}

export async function getOrdersForUser(userId: string): Promise<OrderSummary[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    select
      orders.id,
      orders.status,
      orders.subtotal_cents,
      orders.created_at::text,
      coalesce(sum(order_items.quantity), 0)::int as item_count
    from orders
    left join order_items on order_items.order_id = orders.id
    where orders.user_id = ${userId}
    group by orders.id
    order by orders.created_at desc
    limit 20
  `;

  return (rows as DbOrder[]).map((order) => ({
    id: order.id,
    status: order.status,
    subtotalCents: order.subtotal_cents,
    createdAt: order.created_at,
    itemCount: order.item_count
  }));
}

export async function getBuylistSubmissions(): Promise<BuylistSubmission[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    select
      buylist_submissions.id,
      buylist_submissions.customer_name,
      buylist_submissions.email,
      buylist_submissions.game,
      buylist_submissions.status,
      buylist_submissions.notes,
      buylist_submissions.offer_cents,
      count(buylist_photos.id)::int as photo_count,
      coalesce(
        array_remove(array_agg(buylist_photos.data_url order by buylist_photos.created_at), null),
        '{}'
      ) as photo_urls,
      buylist_submissions.created_at::text
    from buylist_submissions
    left join buylist_photos on buylist_photos.submission_id = buylist_submissions.id
    group by buylist_submissions.id
    order by buylist_submissions.created_at desc
    limit 50
  `;

  return (rows as DbBuylistSubmission[]).map((submission) => ({
    id: submission.id,
    customerName: submission.customer_name,
    email: submission.email,
    game: submission.game,
    status: submission.status,
    notes: submission.notes ?? "",
    photoCount: submission.photo_count,
    offerCents: submission.offer_cents,
    photoUrls: submission.photo_urls ?? [],
    createdAt: submission.created_at
  }));
}

export async function getAdminCustomers(): Promise<AdminCustomer[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    select
      users.id,
      users.name,
      users.email,
      users.role,
      users.created_at::text,
      coalesce(order_stats.order_count, 0)::int as order_count,
      coalesce(order_stats.total_spent_cents, 0)::int as total_spent_cents,
      coalesce(buylist_stats.buylist_count, 0)::int as buylist_count,
      order_stats.last_order_at::text
    from users
    left join (
      select
        customer_email,
        count(*)::int as order_count,
        coalesce(sum(subtotal_cents), 0)::int as total_spent_cents,
        max(created_at) as last_order_at
      from orders
      group by customer_email
    ) order_stats on order_stats.customer_email = users.email
    left join (
      select
        email,
        count(*)::int as buylist_count
      from buylist_submissions
      group by email
    ) buylist_stats on buylist_stats.email = users.email
    order by
      coalesce(order_stats.last_order_at, users.created_at) desc,
      users.created_at desc
    limit 80
  `;

  return (rows as DbAdminCustomer[]).map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    role: customer.role,
    orderCount: customer.order_count,
    totalSpentCents: customer.total_spent_cents,
    buylistCount: customer.buylist_count,
    lastOrderAt: customer.last_order_at,
    createdAt: customer.created_at
  }));
}

export async function getCachedCardSuggestions({
  game,
  query
}: {
  game: TcgCard["game"];
  query: string;
}): Promise<CardSuggestion[] | null> {
  if (!hasDatabase()) return null;
  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      select payload
      from external_card_cache
      where game = ${game}
        and query = ${query}
        and expires_at > now()
      limit 1
    `;

    const [cached] = rows as Array<{ payload: CardSuggestion[] }>;
    return cached?.payload ?? null;
  } catch {
    // The cache table is optional; lookup should keep working while schema is being rolled out.
    return null;
  }
}

export async function setCachedCardSuggestions({
  game,
  query,
  suggestions
}: {
  game: TcgCard["game"];
  query: string;
  suggestions: CardSuggestion[];
}) {
  if (!hasDatabase()) return;
  const sql = getSql();
  if (!sql) return;

  try {
    await sql`
      insert into external_card_cache (game, query, payload, expires_at)
      values (${game}, ${query}, ${JSON.stringify(suggestions)}::jsonb, now() + interval '7 days')
      on conflict (game, query) do update
      set payload = excluded.payload,
          expires_at = excluded.expires_at,
          updated_at = now()
    `;
  } catch {
    // External lookup should not fail when cache writes are unavailable.
  }
}

function sortCards(cards: TcgCard[], sort: SortMode) {
  return [...cards].sort((a, b) => {
    if (sort === "price-asc") return a.priceCents - b.priceCents;
    if (sort === "price-desc") return b.priceCents - a.priceCents;
    return b.marketPriceCents - b.priceCents - (a.marketPriceCents - a.priceCents);
  });
}
