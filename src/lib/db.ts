import { neon } from "@neondatabase/serverless";
import { normalizeBuylistStatus } from "./buylist-flow";
import { cards as fallbackCards } from "./mock-data";
import type {
  AdminCustomer,
  BuylistInboundMethod,
  BuylistLine,
  BuylistLineStatus,
  BuylistSubmission,
  CardCondition,
  CardSuggestion,
  FilterGame,
  Game,
  OrderLineItem,
  OrderSummary,
  ProductKind,
  SortMode,
  StoreUser,
  TcgCard
} from "./types";
import type { SealedType } from "./sealed";

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
  back_image_url: string | null;
  is_double_sided: boolean;
  layout: string | null;
  tags: string[];
  finish: TcgCard["finish"];
  product_kind?: string | null;
  sealed_type?: string | null;
};

type DbUser = {
  id: string;
  name: string;
  email: string;
  role: StoreUser["role"];
  email_verified_at?: string | null;
};

type DbOrder = {
  id: string;
  status: string;
  subtotal_cents: number;
  shipping_cents?: number | null;
  total_cents?: number | null;
  shipping_method?: string | null;
  shipping_service_name?: string | null;
  shipping_company?: string | null;
  shipping_days?: number | null;
  shipping_postal_code?: string | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  payment_id?: string | null;
  created_at: string;
  item_count: number;
  customer_email?: string;
  items?: unknown;
};

function mapOrderItems(raw: unknown): OrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: OrderLineItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const name = String(item.name ?? "").trim();
    const imageUrl = String(item.imageUrl ?? item.image_url ?? "").trim();
    const quantity = Number(item.quantity ?? 0);
    const unitPriceCents = Number(item.unitPriceCents ?? item.unit_price_cents ?? 0);
    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
    items.push({
      name,
      imageUrl: imageUrl || "/card-backs/magic-back.png",
      quantity,
      unitPriceCents: Number.isFinite(unitPriceCents) ? unitPriceCents : 0,
      condition: item.condition == null ? null : String(item.condition),
      game: item.game == null ? null : String(item.game)
    });
  }
  return items;
}

function mapOrder(order: DbOrder): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents ?? 0,
    totalCents: order.total_cents ?? order.subtotal_cents,
    shippingMethod: order.shipping_method,
    shippingServiceName: order.shipping_service_name,
    shippingCompany: order.shipping_company,
    shippingDays: order.shipping_days,
    shippingPostalCode: order.shipping_postal_code,
    paymentProvider: order.payment_provider,
    paymentStatus: order.payment_status,
    paymentId: order.payment_id,
    createdAt: order.created_at,
    itemCount: order.item_count,
    customerEmail: order.customer_email,
    items: mapOrderItems(order.items)
  };
}

type DbBuylistSubmission = {
  id: string;
  customer_name: string;
  email: string;
  game: Game;
  status: string;
  notes: string | null;
  photo_count: number;
  offer_cents: number | null;
  offer_note?: string | null;
  offer_expires_at?: string | null;
  payout_cents?: number | null;
  inbound_method?: string | null;
  tracking_code?: string | null;
  pickup_at?: string | null;
  customer_accepted_at?: string | null;
  customer_declined_at?: string | null;
  received_at?: string | null;
  stocked_at?: string | null;
  paid_at?: string | null;
  user_id?: string | null;
  accept_token_hash?: string | null;
  accept_token_expires_at?: string | null;
  photo_urls: string[] | null;
  created_at: string;
};

type DbBuylistLine = {
  id: string;
  submission_id: string;
  name: string;
  game: Game;
  set_name: string | null;
  condition_expected: string | null;
  condition_received: string | null;
  qty_offered: number;
  qty_accepted: number;
  unit_offer_cents: number;
  line_status: string;
  card_id: string | null;
  external_id: string | null;
  notes: string | null;
};

function mapBuylistLine(line: DbBuylistLine): BuylistLine {
  return {
    id: line.id,
    submissionId: line.submission_id,
    name: line.name,
    game: line.game,
    setName: line.set_name,
    conditionExpected: (line.condition_expected as CardCondition | null) ?? null,
    conditionReceived: (line.condition_received as CardCondition | null) ?? null,
    qtyOffered: line.qty_offered,
    qtyAccepted: line.qty_accepted,
    unitOfferCents: line.unit_offer_cents,
    lineStatus: (line.line_status as BuylistLineStatus) || "pending",
    cardId: line.card_id,
    externalId: line.external_id,
    notes: line.notes
  };
}

function mapBuylistSubmission(
  submission: DbBuylistSubmission,
  lines: BuylistLine[] = []
): BuylistSubmission {
  return {
    id: submission.id,
    customerName: submission.customer_name,
    email: submission.email,
    game: submission.game,
    status: normalizeBuylistStatus(submission.status),
    notes: submission.notes ?? "",
    photoCount: submission.photo_count,
    offerCents: submission.offer_cents,
    offerNote: submission.offer_note ?? null,
    offerExpiresAt: submission.offer_expires_at ?? null,
    payoutCents: submission.payout_cents ?? null,
    inboundMethod: (submission.inbound_method as BuylistInboundMethod | null) ?? null,
    trackingCode: submission.tracking_code ?? null,
    pickupAt: submission.pickup_at ?? null,
    customerAcceptedAt: submission.customer_accepted_at ?? null,
    customerDeclinedAt: submission.customer_declined_at ?? null,
    receivedAt: submission.received_at ?? null,
    stockedAt: submission.stocked_at ?? null,
    paidAt: submission.paid_at ?? null,
    userId: submission.user_id ?? null,
    hasAcceptToken: Boolean(submission.accept_token_hash),
    acceptTokenExpiresAt: submission.accept_token_expires_at ?? null,
    photoUrls: submission.photo_urls ?? [],
    lines,
    createdAt: submission.created_at
  };
}

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
  const productKind: ProductKind =
    card.product_kind === "sealed" ? "sealed" : "single";

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
    backImageUrl: card.back_image_url ?? undefined,
    isDoubleSided: card.is_double_sided,
    layout: card.layout ?? undefined,
    tags: card.tags,
    finish: card.finish,
    productKind,
    sealedType: (card.sealed_type as SealedType | null | undefined) ?? null
  };
}

export function mapUser(user: DbUser): StoreUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.email_verified_at)
  };
}

export async function getCatalogCards({
  query = "",
  game = "Todos",
  sort = "relevance",
  kind = "single"
}: {
  query?: string;
  game?: FilterGame;
  sort?: SortMode;
  kind?: ProductKind | "all";
} = {}): Promise<TcgCard[]> {
  const normalizedQuery = query.trim();

  if (!hasDatabase()) {
    const visible = fallbackCards.filter((card) => {
      const isAvailable = card.stock > 0;
      const matchesGame = game === "Todos" || card.game === game;
      const matchesKind = kind === "all" || card.productKind === kind;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          card.name,
          card.setName,
          card.rarity,
          card.game,
          card.productKind,
          card.sealedType ?? "",
          ...card.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery.toLowerCase());

      return isAvailable && matchesGame && matchesKind && matchesQuery;
    });

    return sortCards(visible, sort);
  }

  const sql = getSql();
  if (!sql) return fallbackCards;

  try {
    await ensureSealedColumns(sql);
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
        back_image_url,
        is_double_sided,
        layout,
        tags,
        finish,
        product_kind,
        sealed_type
      from cards
      where
        active = true
        and stock > 0
        and (${game} = 'Todos' or game::text = ${game})
        and (${kind} = 'all' or coalesce(product_kind, 'single') = ${kind})
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

    return (rows as DbCard[]).map(mapCard);
  } catch (error) {
    if (isMissingSealedColumns(error)) {
      if (kind === "sealed") return [];
      return getCatalogCardsWithoutSealed({ game, normalizedQuery, sort });
    }
    if (!isMissingDoubleSideColumns(error)) throw error;
    if (kind === "sealed") return [];
    return getLegacyCatalogCards({ game, normalizedQuery, sort });
  }
}

export async function getFeaturedCards(): Promise<TcgCard[]> {
  return getCatalogCards();
}

export async function getCardById(id: string): Promise<TcgCard | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  if (!hasDatabase()) {
    return fallbackCards.find((card) => card.id === normalizedId) ?? null;
  }

  const sql = getSql();
  if (!sql) return fallbackCards.find((card) => card.id === normalizedId) ?? null;

  try {
    await ensureSealedColumns(sql);
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
        back_image_url,
        is_double_sided,
        layout,
        tags,
        finish,
        product_kind,
        sealed_type
      from cards
      where id = ${normalizedId}
        and active = true
      limit 1
    `;
    const [row] = rows as DbCard[];
    return row ? mapCard(row) : null;
  } catch (error) {
    if (isMissingSealedColumns(error) || isMissingDoubleSideColumns(error)) {
      try {
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
          where id = ${normalizedId}
            and active = true
          limit 1
        `;
        const [row] = rows as Array<Omit<DbCard, "back_image_url" | "is_double_sided" | "layout">>;
        return row ? mapCard(withoutDoubleSideColumns(row)) : null;
      } catch {
        return null;
      }
    }
    throw error;
  }
}

export async function getRelatedCatalogCards(card: TcgCard, limit = 4): Promise<TcgCard[]> {
  const related = await getCatalogCards({
    game: card.game,
    sort: "relevance",
    kind: card.productKind === "sealed" ? "sealed" : "single"
  });
  return related.filter((item) => item.id !== card.id).slice(0, limit);
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
        [
          card.name,
          card.setName,
          card.rarity,
          card.game,
          card.productKind,
          card.sealedType ?? "",
          ...card.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery.toLowerCase());

      return matchesGame && matchesStock && matchesQuery;
    });
  }
  const sql = getSql();
  if (!sql) return fallbackCards;

  try {
    await ensureSealedColumns(sql);
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
        back_image_url,
        is_double_sided,
        layout,
        tags,
        finish,
        product_kind,
        sealed_type
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

    return dedupeCards((rows as DbCard[]).map(mapCard));
  } catch (error) {
    if (isMissingSealedColumns(error)) {
      return getAdminCardsWithoutSealed({
        game,
        normalizedLimit,
        normalizedQuery,
        stock
      });
    }
    if (!isMissingDoubleSideColumns(error)) throw error;
    return getLegacyAdminCards({ game, normalizedLimit, normalizedQuery, stock });
  }
}

async function getCatalogCardsWithoutSealed({
  game,
  normalizedQuery,
  sort
}: {
  game: FilterGame;
  normalizedQuery: string;
  sort: SortMode;
}) {
  const sql = getSql();
  if (!sql) return fallbackCards;

  try {
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
        back_image_url,
        is_double_sided,
        layout,
        tags,
        finish
      from cards
      where
        active = true
        and stock > 0
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

    return (rows as DbCard[]).map(mapCard);
  } catch (error) {
    if (!isMissingDoubleSideColumns(error)) throw error;
    return getLegacyCatalogCards({ game, normalizedQuery, sort });
  }
}

async function getAdminCardsWithoutSealed({
  game,
  normalizedLimit,
  normalizedQuery,
  stock
}: {
  game: FilterGame;
  normalizedLimit: number;
  normalizedQuery: string;
  stock: "all" | "low" | "out";
}) {
  const sql = getSql();
  if (!sql) return fallbackCards;

  try {
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
        back_image_url,
        is_double_sided,
        layout,
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

    return dedupeCards((rows as DbCard[]).map(mapCard));
  } catch (error) {
    if (!isMissingDoubleSideColumns(error)) throw error;
    return getLegacyAdminCards({ game, normalizedLimit, normalizedQuery, stock });
  }
}

async function getLegacyCatalogCards({
  game,
  normalizedQuery,
  sort
}: {
  game: FilterGame;
  normalizedQuery: string;
  sort: SortMode;
}) {
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
      and stock > 0
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

  return (rows as Array<Omit<DbCard, "back_image_url" | "is_double_sided" | "layout">>)
    .map(withoutDoubleSideColumns)
    .map(mapCard);
}

async function getLegacyAdminCards({
  game,
  normalizedLimit,
  normalizedQuery,
  stock
}: {
  game: FilterGame;
  normalizedLimit: number;
  normalizedQuery: string;
  stock: "all" | "low" | "out";
}) {
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

  const cards = (rows as Array<Omit<DbCard, "back_image_url" | "is_double_sided" | "layout">>)
    .map(withoutDoubleSideColumns)
    .map(mapCard);
  return dedupeCards(cards);
}

function withoutDoubleSideColumns(
  card: Omit<DbCard, "back_image_url" | "is_double_sided" | "layout">
): DbCard {
  return {
    ...card,
    back_image_url: null,
    is_double_sided: false,
    layout: null
  };
}

function isMissingDoubleSideColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("back_image_url") ||
    message.includes("is_double_sided") ||
    message.includes("layout")
  );
}

function isMissingSealedColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("product_kind") || message.includes("sealed_type");
}

let sealedColumnsEnsured = false;

export async function ensureSealedColumns(sql: NeonSql) {
  if (sealedColumnsEnsured) return;
  await sql`
    alter table cards
      add column if not exists product_kind text not null default 'single',
      add column if not exists sealed_type text
  `;
  sealedColumnsEnsured = true;
}

let externalIdColumnEnsured = false;

export async function ensureExternalIdColumn(sql: NeonSql) {
  if (externalIdColumnEnsured) return;
  await sql`
    alter table cards
      add column if not exists external_id text
  `;
  await sql`
    create index if not exists cards_external_id_idx
      on cards (game, external_id)
      where external_id is not null
  `;
  try {
    await sql`
      create unique index if not exists cards_external_variant_uidx
        on cards (game, external_id, condition, language, finish)
        where external_id is not null
          and product_kind = 'single'
          and active = true
    `;
  } catch (error) {
    // Duplicates legacy may block the unique index; non-unique lookup still works.
    console.warn("cards_external_variant_uidx not created", error);
  }
  externalIdColumnEnsured = true;
}

function dedupeCards(cards: TcgCard[]) {
  const merged = new Map<string, TcgCard>();

  for (const card of cards) {
    const key = [
      card.productKind,
      card.sealedType ?? "",
      card.game,
      card.name.trim().toLowerCase(),
      card.setName.trim().toLowerCase(),
      card.rarity.trim().toLowerCase(),
      card.condition,
      card.language,
      card.finish,
      card.imageUrl,
      card.backImageUrl ?? ""
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

type NeonSql = NonNullable<ReturnType<typeof getSql>>;

function isMissingOrderColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("shipping_cents") ||
    message.includes("total_cents") ||
    message.includes("shipping_service_name") ||
    message.includes("shipping_company") ||
    message.includes("shipping_method") ||
    message.includes("shipping_days") ||
    message.includes("shipping_postal_code") ||
    message.includes("payment_provider") ||
    message.includes("payment_preference_id") ||
    message.includes("payment_id") ||
    message.includes("payment_status") ||
    (message.includes("orders") && message.includes("updated_at"))
  );
}

let orderColumnsEnsured = false;

export async function ensureOrderColumns(sql: NeonSql) {
  if (orderColumnsEnsured) return;
  await sql`
    alter table orders
      add column if not exists shipping_cents integer not null default 0,
      add column if not exists total_cents integer not null default 0,
      add column if not exists shipping_method text,
      add column if not exists shipping_service_name text,
      add column if not exists shipping_company text,
      add column if not exists shipping_days integer,
      add column if not exists shipping_postal_code text,
      add column if not exists payment_provider text,
      add column if not exists payment_preference_id text,
      add column if not exists payment_id text,
      add column if not exists payment_status text,
      add column if not exists updated_at timestamptz not null default now()
  `;
  orderColumnsEnsured = true;
}

let userEmailColumnsEnsured = false;

export async function ensureUserEmailSchema(sql: NeonSql) {
  if (userEmailColumnsEnsured) return;
  await sql`
    alter table users
      add column if not exists email_verified_at timestamptz,
      add column if not exists email_verify_token_hash text,
      add column if not exists email_verify_expires_at timestamptz
  `;
  await sql`
    update users
    set email_verified_at = coalesce(email_verified_at, created_at)
    where email_verified_at is null
      and email_verify_token_hash is null
  `;
  userEmailColumnsEnsured = true;
}

export async function getAdminOrders(): Promise<OrderSummary[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const run = () => sql`
    select
      orders.id,
      orders.customer_email,
      orders.status,
      orders.subtotal_cents,
      coalesce(orders.shipping_cents, 0)::int as shipping_cents,
      coalesce(orders.total_cents, orders.subtotal_cents)::int as total_cents,
      orders.shipping_method,
      orders.shipping_service_name,
      orders.shipping_company,
      orders.shipping_days,
      orders.shipping_postal_code,
      orders.payment_provider,
      orders.payment_status,
      orders.payment_id,
      orders.created_at::text,
      coalesce(sum(order_items.quantity), 0)::int as item_count,
      coalesce(
        json_agg(
          json_build_object(
            'name', cards.name,
            'imageUrl', cards.image_url,
            'quantity', order_items.quantity,
            'unitPriceCents', order_items.unit_price_cents,
            'condition', cards.condition,
            'game', cards.game
          )
          order by cards.name
        ) filter (where order_items.id is not null),
        '[]'::json
      ) as items
    from orders
    left join order_items on order_items.order_id = orders.id
    left join cards on cards.id = order_items.card_id
    group by orders.id
    order by orders.created_at desc
    limit 30
  `;

  let rows;
  try {
    rows = await run();
  } catch (error) {
    if (!isMissingOrderColumns(error)) throw error;
    await ensureOrderColumns(sql);
    rows = await run();
  }

  return (rows as DbOrder[]).map(mapOrder);
}

export async function getOrdersForUser(userId: string): Promise<OrderSummary[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const run = () => sql`
    select
      orders.id,
      orders.status,
      orders.subtotal_cents,
      coalesce(orders.shipping_cents, 0)::int as shipping_cents,
      coalesce(orders.total_cents, orders.subtotal_cents)::int as total_cents,
      orders.shipping_method,
      orders.shipping_service_name,
      orders.shipping_company,
      orders.shipping_days,
      orders.shipping_postal_code,
      orders.payment_provider,
      orders.payment_status,
      orders.payment_id,
      orders.created_at::text,
      coalesce(sum(order_items.quantity), 0)::int as item_count,
      coalesce(
        json_agg(
          json_build_object(
            'name', cards.name,
            'imageUrl', cards.image_url,
            'quantity', order_items.quantity,
            'unitPriceCents', order_items.unit_price_cents,
            'condition', cards.condition,
            'game', cards.game
          )
          order by cards.name
        ) filter (where order_items.id is not null),
        '[]'::json
      ) as items
    from orders
    left join order_items on order_items.order_id = orders.id
    left join cards on cards.id = order_items.card_id
    where orders.user_id = ${userId}
    group by orders.id
    order by orders.created_at desc
    limit 20
  `;

  let rows;
  try {
    rows = await run();
  } catch (error) {
    if (!isMissingOrderColumns(error)) throw error;
    await ensureOrderColumns(sql);
    rows = await run();
  }

  return (rows as DbOrder[]).map(mapOrder);
}

let buylistSchemaEnsured = false;

function isMissingBuylistColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("offer_note") ||
    message.includes("offer_expires_at") ||
    message.includes("payout_cents") ||
    message.includes("inbound_method") ||
    message.includes("tracking_code") ||
    message.includes("pickup_at") ||
    message.includes("customer_accepted_at") ||
    message.includes("customer_declined_at") ||
    message.includes("received_at") ||
    message.includes("stocked_at") ||
    message.includes("paid_at") ||
    message.includes("accept_token_hash") ||
    message.includes("accept_token_expires_at") ||
    message.includes("user_id") ||
    message.includes("buylist_lines")
  );
}

export async function ensureBuylistSchema(sql: NeonSql) {
  if (buylistSchemaEnsured) return;
  await sql`
    alter table buylist_submissions
      add column if not exists offer_note text,
      add column if not exists offer_expires_at timestamptz,
      add column if not exists payout_cents integer,
      add column if not exists inbound_method text,
      add column if not exists tracking_code text,
      add column if not exists pickup_at timestamptz,
      add column if not exists customer_accepted_at timestamptz,
      add column if not exists customer_declined_at timestamptz,
      add column if not exists received_at timestamptz,
      add column if not exists stocked_at timestamptz,
      add column if not exists paid_at timestamptz,
      add column if not exists accept_token_hash text,
      add column if not exists accept_token_expires_at timestamptz,
      add column if not exists user_id text
  `;
  await sql`
    create table if not exists buylist_lines (
      id text primary key default gen_random_uuid()::text,
      submission_id text not null references buylist_submissions (id) on delete cascade,
      name text not null,
      game text not null,
      set_name text,
      condition_expected text,
      condition_received text,
      qty_offered integer not null default 1,
      qty_accepted integer not null default 0,
      unit_offer_cents integer not null default 0,
      line_status text not null default 'pending',
      card_id text,
      external_id text,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  buylistSchemaEnsured = true;
}

async function loadBuylistLines(sql: NeonSql, submissionIds: string[]) {
  if (submissionIds.length === 0) return new Map<string, BuylistLine[]>();
  const rows = await sql`
    select
      id,
      submission_id,
      name,
      game,
      set_name,
      condition_expected,
      condition_received,
      qty_offered,
      qty_accepted,
      unit_offer_cents,
      line_status,
      card_id,
      external_id,
      notes
    from buylist_lines
    where submission_id = any(${submissionIds})
    order by created_at asc
  `;
  const map = new Map<string, BuylistLine[]>();
  for (const row of rows as DbBuylistLine[]) {
    const list = map.get(row.submission_id) ?? [];
    list.push(mapBuylistLine(row));
    map.set(row.submission_id, list);
  }
  return map;
}

export async function getBuylistSubmissions(): Promise<BuylistSubmission[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];

  const run = async () => {
    const rows = await sql`
      select
        buylist_submissions.id,
        buylist_submissions.customer_name,
        buylist_submissions.email,
        buylist_submissions.game,
        buylist_submissions.status,
        buylist_submissions.notes,
        buylist_submissions.offer_cents,
        buylist_submissions.offer_note,
        buylist_submissions.offer_expires_at::text,
        buylist_submissions.payout_cents,
        buylist_submissions.inbound_method,
        buylist_submissions.tracking_code,
        buylist_submissions.pickup_at::text,
        buylist_submissions.customer_accepted_at::text,
        buylist_submissions.customer_declined_at::text,
        buylist_submissions.received_at::text,
        buylist_submissions.stocked_at::text,
        buylist_submissions.paid_at::text,
        buylist_submissions.user_id,
        buylist_submissions.accept_token_hash,
        buylist_submissions.accept_token_expires_at::text,
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
    const submissions = rows as DbBuylistSubmission[];
    const linesMap = await loadBuylistLines(
      sql,
      submissions.map((item) => item.id)
    );
    return submissions.map((item) => mapBuylistSubmission(item, linesMap.get(item.id) ?? []));
  };

  try {
    return await run();
  } catch (error) {
    if (!isMissingBuylistColumns(error)) throw error;
    await ensureBuylistSchema(sql);
    return run();
  }
}

export async function getBuylistSubmissionsForUser({
  email,
  userId
}: {
  email: string;
  userId?: string | null;
}): Promise<BuylistSubmission[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  if (!sql) return [];
  // List only by linked account — never by email alone (IDOR after fake registration).
  if (!userId) return [];
  void email;

  const run = async () => {
    const rows = await sql`
      select
        buylist_submissions.id,
        buylist_submissions.customer_name,
        buylist_submissions.email,
        buylist_submissions.game,
        buylist_submissions.status,
        buylist_submissions.notes,
        buylist_submissions.offer_cents,
        buylist_submissions.offer_note,
        buylist_submissions.offer_expires_at::text,
        buylist_submissions.payout_cents,
        buylist_submissions.inbound_method,
        buylist_submissions.tracking_code,
        buylist_submissions.pickup_at::text,
        buylist_submissions.customer_accepted_at::text,
        buylist_submissions.customer_declined_at::text,
        buylist_submissions.received_at::text,
        buylist_submissions.stocked_at::text,
        buylist_submissions.paid_at::text,
        buylist_submissions.user_id,
        buylist_submissions.accept_token_hash,
        buylist_submissions.accept_token_expires_at::text,
        count(buylist_photos.id)::int as photo_count,
        coalesce(
          array_remove(array_agg(buylist_photos.data_url order by buylist_photos.created_at), null),
          '{}'
        ) as photo_urls,
        buylist_submissions.created_at::text
      from buylist_submissions
      left join buylist_photos on buylist_photos.submission_id = buylist_submissions.id
      where buylist_submissions.user_id = ${userId}
      group by buylist_submissions.id
      order by buylist_submissions.created_at desc
      limit 40
    `;
    const submissions = rows as DbBuylistSubmission[];
    const linesMap = await loadBuylistLines(
      sql,
      submissions.map((item) => item.id)
    );
    return submissions.map((item) => mapBuylistSubmission(item, linesMap.get(item.id) ?? []));
  };

  try {
    return await run();
  } catch (error) {
    if (!isMissingBuylistColumns(error)) throw error;
    await ensureBuylistSchema(sql);
    return run();
  }
}

/** @deprecated Prefer getBuylistSubmissionsForUser */
export async function getBuylistSubmissionsForEmail(email: string): Promise<BuylistSubmission[]> {
  return getBuylistSubmissionsForUser({ email });
}

export async function getBuylistSubmissionById(id: string): Promise<BuylistSubmission | null> {
  if (!hasDatabase()) return null;
  const sql = getSql();
  if (!sql) return null;

  const run = async () => {
    const rows = await sql`
      select
        buylist_submissions.id,
        buylist_submissions.customer_name,
        buylist_submissions.email,
        buylist_submissions.game,
        buylist_submissions.status,
        buylist_submissions.notes,
        buylist_submissions.offer_cents,
        buylist_submissions.offer_note,
        buylist_submissions.offer_expires_at::text,
        buylist_submissions.payout_cents,
        buylist_submissions.inbound_method,
        buylist_submissions.tracking_code,
        buylist_submissions.pickup_at::text,
        buylist_submissions.customer_accepted_at::text,
        buylist_submissions.customer_declined_at::text,
        buylist_submissions.received_at::text,
        buylist_submissions.stocked_at::text,
        buylist_submissions.paid_at::text,
        buylist_submissions.user_id,
        buylist_submissions.accept_token_hash,
        buylist_submissions.accept_token_expires_at::text,
        count(buylist_photos.id)::int as photo_count,
        coalesce(
          array_remove(array_agg(buylist_photos.data_url order by buylist_photos.created_at), null),
          '{}'
        ) as photo_urls,
        buylist_submissions.created_at::text
      from buylist_submissions
      left join buylist_photos on buylist_photos.submission_id = buylist_submissions.id
      where buylist_submissions.id = ${id}
      group by buylist_submissions.id
      limit 1
    `;
    const [submission] = rows as DbBuylistSubmission[];
    if (!submission) return null;
    const linesMap = await loadBuylistLines(sql, [submission.id]);
    return mapBuylistSubmission(submission, linesMap.get(submission.id) ?? []);
  };

  try {
    return await run();
  } catch (error) {
    if (!isMissingBuylistColumns(error)) throw error;
    await ensureBuylistSchema(sql);
    return run();
  }
}

export async function getBuylistAcceptTokenHash(id: string): Promise<{
  hash: string | null;
  expiresAt: string | null;
  email: string;
} | null> {
  if (!hasDatabase()) return null;
  const sql = getSql();
  if (!sql) return null;

  try {
    await ensureBuylistSchema(sql);
    const rows = await sql`
      select accept_token_hash, accept_token_expires_at::text, email
      from buylist_submissions
      where id = ${id}
      limit 1
    `;
    const [row] = rows as Array<{
      accept_token_hash: string | null;
      accept_token_expires_at: string | null;
      email: string;
    }>;
    if (!row) return null;
    return { hash: row.accept_token_hash, expiresAt: row.accept_token_expires_at, email: row.email };
  } catch {
    return null;
  }
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
