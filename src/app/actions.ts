"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSession,
  currentUser,
  demoUserFor,
  hashPassword,
  signOut,
  verifyPassword
} from "@/lib/auth";
import {
  buylistCustomerUrl,
  canTransitionBuylistStatus,
  generateAcceptToken,
  hashAcceptToken,
  isOfferExpired,
  isValidBuylistStatus,
  normalizeBuylistStatus,
  offerExpiryDate
} from "@/lib/buylist-flow";
import {
  ensureBuylistSchema,
  ensureOrderColumns,
  getBuylistAcceptTokenHash,
  getBuylistSubmissionById,
  getSql,
  hasDatabase
} from "@/lib/db";
import { sendBuylistOfferEmail } from "@/lib/email";
import { createCheckoutPreference, hasMercadoPago } from "@/lib/payments/mercadopago";
import { findQuoteById, normalizePostalCode, quoteShipping } from "@/lib/shipping";
import { storeBuylistPhoto } from "@/lib/storage/blob";
import type { CardCondition, Game, StoreUser } from "@/lib/types";

type ActionState = {
  ok: boolean;
  message: string;
  checkoutUrl?: string | null;
};

const validGames = ["Magic", "Yu-Gi-Oh!", "Pokemon"] as const;
const validConditions = ["NM", "SP", "MP", "HP"] as const;
const validLanguages = ["PT", "EN", "JP"] as const;
const validFinishes = ["Normal", "Foil", "Holo", "Secret"] as const;
const validCardSources = ["Scryfall", "Pokemon TCG", "YGOPRODeck"] as const;
const validBuylistStatuses = [
  "new",
  "reviewing",
  "offered",
  "declined",
  "awaiting_shipment",
  "in_transit",
  "received",
  "checking",
  "stocked",
  "paid",
  "cancelled",
  "approved"
] as const;
const validOrderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;

type CartPayload = Array<{
  cardId: string;
  quantity: number;
}>;

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readMoneyCents(formData: FormData, key: string) {
  const raw = readString(formData, key);
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Math.round(Number(normalized) * 100);
}

function adminTabFrom(formData: FormData, fallback: string) {
  const tab = readString(formData, "tab");
  return ["inventory", "new-card", "buylists", "orders", "pendencias"].includes(tab) ? tab : fallback;
}

function withNotice(path: string, key: string, value: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${key}=${encodeURIComponent(value)}`;
}

async function assertBuylistCustomerAccess(submissionId: string, token: string) {
  const user = await currentUser();
  const submission = await getBuylistSubmissionById(submissionId);
  if (!submission) return { ok: false as const, reason: "not-found" as const, submission: null };

  if (user && user.email.toLowerCase() === submission.email.toLowerCase()) {
    return { ok: true as const, submission, via: "session" as const };
  }

  if (!token) return { ok: false as const, reason: "unauthorized" as const, submission };

  const meta = await getBuylistAcceptTokenHash(submissionId);
  if (!meta?.hash) return { ok: false as const, reason: "unauthorized" as const, submission };
  if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const, submission };
  }
  if (hashAcceptToken(token) !== meta.hash) {
    return { ok: false as const, reason: "unauthorized" as const, submission };
  }
  return { ok: true as const, submission, via: "token" as const };
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const name = readString(formData, "name");
    const email = readString(formData, "email").toLowerCase();
    const password = readString(formData, "password");

    if (!name || !email || password.length < 6) {
      return { ok: false, message: "Informe nome, email e senha com pelo menos 6 caracteres." };
    }

    if (!hasDatabase()) {
      await createSession(demoUserFor(email, name));
      revalidatePath("/");
      return { ok: true, message: "Conta demo criada. Configure o Neon para persistir usuarios." };
    }

    const sql = getSql();
    if (!sql) return { ok: false, message: "Banco indisponivel." };

    const existing = await sql`select id from users where email = ${email} limit 1`;
    if (existing.length > 0) return { ok: false, message: "Este email ja esta cadastrado." };

    const role = email === process.env.ADMIN_EMAIL?.toLowerCase() ? "admin" : "customer";
    const rows = await sql`
      insert into users (name, email, password_hash, role)
      values (${name}, ${email}, ${hashPassword(password)}, ${role})
      returning id, name, email, role
    `;

    await createSession(rows[0] as StoreUser);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/conta");
    return { ok: true, message: "Conta criada com sucesso." };
  } catch (error) {
    return {
      ok: false,
      message: authErrorMessage(error)
    };
  }
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const email = readString(formData, "email").toLowerCase();
    const password = readString(formData, "password");

    if (!email || !password) return { ok: false, message: "Informe email e senha." };

    if (!hasDatabase()) {
      if (email === "admin@manadraw.local" && password !== "admin123") {
        return { ok: false, message: "Senha demo do admin: admin123." };
      }
      await createSession(demoUserFor(email));
      revalidatePath("/");
      revalidatePath("/admin");
      revalidatePath("/conta");
      return { ok: true, message: "Login demo ativo. Configure o Neon para persistir sessoes." };
    }

    const sql = getSql();
    if (!sql) return { ok: false, message: "Banco indisponivel." };

    const rows = await sql`
      select id, name, email, role, password_hash
      from users
      where email = ${email}
      limit 1
    `;

    const [user] = rows as Array<StoreUser & { password_hash: string }>;
    if (!user || !verifyPassword(password, user.password_hash)) {
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

      if (!user && adminEmail && email === adminEmail && password.length >= 6) {
        const existingAdmins = await sql`
          select id
          from users
          where role = 'admin'
          limit 1
        `;

        if (existingAdmins.length === 0) {
          const created = await sql`
            insert into users (name, email, password_hash, role)
            values ('Admin Mana Draw', ${email}, ${hashPassword(password)}, 'admin')
            returning id, name, email, role
          `;

          await createSession(created[0] as StoreUser);
          revalidatePath("/");
          revalidatePath("/admin");
          revalidatePath("/conta");
          return { ok: true, message: "Admin inicial criado e login realizado." };
        }
      }

      return { ok: false, message: "Email ou senha invalidos." };
    }

    await createSession(user);
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/conta");
    return { ok: true, message: "Login realizado." };
  } catch (error) {
    return {
      ok: false,
      message: authErrorMessage(error)
    };
  }
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("relation") && message.includes("users")) {
    return "Tabela de usuarios nao encontrada. Execute database/schema.sql no Neon.";
  }

  if (message.includes("relation") && message.includes("sessions")) {
    return "Tabela de sessoes nao encontrada. Execute database/schema.sql no Neon.";
  }

  if (message.includes("password_hash")) {
    return "Schema de usuarios incompleto. Atualize o Neon com database/schema.sql.";
  }

  return "Nao foi possivel autenticar agora. Verifique o Neon e tente novamente.";
}

export async function logoutAction() {
  await signOut();
  revalidatePath("/");
  redirect("/");
}

export async function createOrderAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Entre na sua conta para finalizar o pedido." };

  const rawCart = readString(formData, "cart");
  const shippingQuoteId = readString(formData, "shippingQuoteId");
  const postalCodeRaw = readString(formData, "postalCode");
  let cart: CartPayload = [];

  try {
    cart = JSON.parse(rawCart) as CartPayload;
  } catch {
    return { ok: false, message: "Carrinho inválido." };
  }

  const cleanCart = cart.filter((line) => line.cardId && line.quantity > 0);
  if (cleanCart.length === 0) return { ok: false, message: "Adicione cartas ao carrinho." };
  if (!shippingQuoteId) return { ok: false, message: "Escolha uma opção de frete." };

  const postalCode =
    shippingQuoteId === "pickup" ? normalizePostalCode(postalCodeRaw) || "00000000" : normalizePostalCode(postalCodeRaw);
  if (shippingQuoteId !== "pickup" && !postalCode) {
    return { ok: false, message: "Informe um CEP válido com 8 dígitos." };
  }

  if (!hasDatabase()) {
    return {
      ok: true,
      message: "Pedido demo criado. Configure Neon, Mercado Pago e Melhor Envio para checkout real."
    };
  }

  const sql = getSql();
  if (!sql) return { ok: false, message: "Banco indisponível." };

  const ids = cleanCart.map((line) => line.cardId);
  const rows = await sql`
    select id, name, price_cents, stock
    from cards
    where id = any(${ids})
      and active = true
  `;

  const inventory = new Map(
    (rows as Array<{ id: string; name: string; price_cents: number; stock: number }>).map((card) => [
      card.id,
      card
    ])
  );

  let subtotal = 0;
  const itemCount = cleanCart.reduce((sum, line) => sum + line.quantity, 0);
  for (const line of cleanCart) {
    const card = inventory.get(line.cardId);
    if (!card || card.stock < line.quantity) {
      return { ok: false, message: "Uma carta do carrinho ficou indisponível." };
    }
    subtotal += card.price_cents * line.quantity;
  }

  let shipping;
  try {
    const quotes = await quoteShipping({
      postalCode: postalCode === "00000000" ? process.env.MELHOR_ENVIO_FROM_POSTAL_CODE || "01310100" : postalCode!,
      itemCount,
      insuranceCents: subtotal
    });
    shipping = findQuoteById(quotes, shippingQuoteId);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível validar o frete."
    };
  }

  if (!shipping) {
    return { ok: false, message: "Opção de frete inválida. Recalcule o CEP." };
  }

  const shippingCents = shipping.priceCents;
  const totalCents = subtotal + shippingCents;
  const shipPostal = shipping.kind === "pickup" ? null : postalCode;

  const insertOrder = () => sql`
    insert into orders (
      user_id,
      customer_email,
      status,
      subtotal_cents,
      shipping_cents,
      total_cents,
      shipping_method,
      shipping_service_name,
      shipping_company,
      shipping_days,
      shipping_postal_code,
      payment_provider
    )
    values (
      ${user.id},
      ${user.email},
      'pending',
      ${subtotal},
      ${shippingCents},
      ${totalCents},
      ${shipping.id},
      ${shipping.service},
      ${shipping.company},
      ${shipping.days},
      ${shipPostal},
      ${hasMercadoPago() ? "mercadopago" : null}
    )
    returning id
  `;

  let orderRows;
  try {
    orderRows = await insertOrder();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("orders") || !message.includes("column")) throw error;
    await ensureOrderColumns(sql);
    orderRows = await insertOrder();
  }
  const orderId = String(orderRows[0].id);

  for (const line of cleanCart) {
    const card = inventory.get(line.cardId);
    if (!card) continue;

    await sql`
      insert into order_items (order_id, card_id, quantity, unit_price_cents)
      values (${orderId}, ${line.cardId}, ${line.quantity}, ${card.price_cents})
    `;
    await sql`
      update cards
      set stock = stock - ${line.quantity}, updated_at = now()
      where id = ${line.cardId}
    `;
  }

  revalidatePath("/");
  revalidatePath("/conta");
  revalidatePath("/admin");

  if (!hasMercadoPago()) {
    return {
      ok: true,
      message: `Pedido ${orderId.slice(0, 8)} criado. Configure MERCADOPAGO_ACCESS_TOKEN para cobrar Pix/cartão.`
    };
  }

  try {
    const preference = await createCheckoutPreference({
      orderId,
      email: user.email,
      name: user.name,
      lines: cleanCart.map((line) => {
        const card = inventory.get(line.cardId)!;
        return {
          id: card.id,
          title: card.name,
          quantity: line.quantity,
          unitPriceCents: card.price_cents
        };
      }),
      shippingCents,
      shippingLabel: `${shipping.company} · ${shipping.service}`
    });

    await sql`
      update orders
      set payment_preference_id = ${preference.preferenceId}, updated_at = now()
      where id = ${orderId}
    `;

    return {
      ok: true,
      message: "Redirecionando para o Mercado Pago...",
      checkoutUrl: preference.checkoutUrl
    };
  } catch (error) {
    console.error("Mercado Pago preference failed", error);
    return {
      ok: true,
      message: `Pedido ${orderId.slice(0, 8)} criado, mas o checkout Mercado Pago falhou. Tente de novo ou pague com o admin.`
    };
  }
}

export async function updateCardAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const priceCents = readMoneyCents(formData, "price");
  const stock = Number(readString(formData, "stock"));
  const condition = readString(formData, "condition") as CardCondition;
  const tab = adminTabFrom(formData, "inventory");

  if (!id || !Number.isFinite(priceCents) || !Number.isInteger(stock)) {
    redirect(`/admin?tab=${tab}&error=invalid-card`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);

  await sql`
    update cards
    set
      price_cents = ${priceCents},
      stock = ${stock},
      condition = ${condition},
      updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=card-updated`);
}

export async function deleteCardAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const tab = adminTabFrom(formData, "inventory");

  if (!id) redirect(`/admin?tab=${tab}&error=invalid-card`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);

  await sql`
    update cards
    set active = false, stock = 0, updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=card-deleted`);
}

export async function createCardAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const name = readString(formData, "name");
  const game = readString(formData, "game") as Game;
  const setName = readString(formData, "setName");
  const rarity = readString(formData, "rarity");
  const condition = readString(formData, "condition");
  const language = readString(formData, "language");
  const finish = readString(formData, "finish");
  const imageUrl = readString(formData, "imageUrl");
  const backImageUrl = readString(formData, "backImageUrl");
  const isDoubleSided = readString(formData, "isDoubleSided") === "true" || Boolean(backImageUrl);
  const layout = readString(formData, "layout");
  const tags = readString(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const priceCents = readMoneyCents(formData, "price");
  const marketPriceCents = readMoneyCents(formData, "marketPrice");
  const stock = Number(readString(formData, "stock"));
  const externalId = readString(formData, "externalId");
  const source = readString(formData, "source");
  const featured = formData.get("featured") === "on";
  const tab = adminTabFrom(formData, "new-card");

  const hasInvalidEnum =
    !validGames.includes(game) ||
    !validConditions.includes(condition as (typeof validConditions)[number]) ||
    !validLanguages.includes(language as (typeof validLanguages)[number]) ||
    !validFinishes.includes(finish as (typeof validFinishes)[number]);

  if (
    !name ||
    !setName ||
    !rarity ||
    !imageUrl ||
    !externalId ||
    !validCardSources.includes(source as (typeof validCardSources)[number]) ||
    hasInvalidEnum ||
    !Number.isFinite(priceCents) ||
    !Number.isFinite(marketPriceCents) ||
    !Number.isInteger(stock) ||
    priceCents < 0 ||
    marketPriceCents < 0 ||
    stock < 0
  ) {
    redirect(`/admin?tab=${tab}&error=invalid-new-card`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);

  const existing = await sql`
    select id
    from cards
    where game = ${game}
      and active = true
      and lower(name) = lower(${name})
      and lower(set_name) = lower(${setName})
      and lower(rarity) = lower(${rarity})
      and condition = ${condition}
      and language = ${language}
      and finish = ${finish}
      and image_url = ${imageUrl}
    limit 1
  `;

  if (existing.length > 0) {
    try {
      await sql`
        update cards
        set
          stock = stock + ${stock},
          price_cents = ${priceCents},
          market_price_cents = ${marketPriceCents},
          back_image_url = ${backImageUrl || null},
          is_double_sided = ${isDoubleSided},
          layout = ${layout || null},
          tags = ${tags},
          featured = ${featured},
          active = true,
          updated_at = now()
        where id = ${(existing[0] as { id: string }).id}
      `;
    } catch (error) {
      if (!isMissingDoubleSideColumns(error)) throw error;
      await sql`
        update cards
        set
          stock = stock + ${stock},
          price_cents = ${priceCents},
          market_price_cents = ${marketPriceCents},
          tags = ${tags},
          featured = ${featured},
          active = true,
          updated_at = now()
        where id = ${(existing[0] as { id: string }).id}
      `;
    }
  } else {
    try {
      await sql`
        insert into cards (
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
          featured
        )
        values (
          ${name},
          ${game},
          ${setName},
          ${rarity},
          ${condition},
          ${language},
          ${priceCents},
          ${marketPriceCents},
          ${stock},
          ${imageUrl},
          ${backImageUrl || null},
          ${isDoubleSided},
          ${layout || null},
          ${tags},
          ${finish},
          ${featured}
        )
      `;
    } catch (error) {
      if (!isMissingDoubleSideColumns(error)) throw error;
      await sql`
        insert into cards (
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
          finish,
          featured
        )
        values (
          ${name},
          ${game},
          ${setName},
          ${rarity},
          ${condition},
          ${language},
          ${priceCents},
          ${marketPriceCents},
          ${stock},
          ${imageUrl},
          ${tags},
          ${finish},
          ${featured}
        )
      `;
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=card-created`);
}

function isMissingDoubleSideColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("back_image_url") ||
    message.includes("is_double_sided") ||
    message.includes("layout")
  );
}

export async function updateBuylistAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const status = readString(formData, "status");
  const offerInput = readString(formData, "offer");
  const offerNote = readString(formData, "offerNote");
  const offerCents = offerInput ? readMoneyCents(formData, "offer") : null;
  const tab = adminTabFrom(formData, "buylists");

  if (
    !id ||
    !isValidBuylistStatus(status) ||
    !(validBuylistStatuses as readonly string[]).includes(status) ||
    (offerCents !== null && (!Number.isFinite(offerCents) || offerCents < 0))
  ) {
    redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  }

  const normalizedStatus = status === "approved" ? "offered" : status;

  if (normalizedStatus === "offered" && (offerCents === null || offerCents <= 0)) {
    redirect(`/admin?tab=${tab}&error=buylist-offer-required`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  const existing = await getBuylistSubmissionById(id);
  if (!existing) redirect(`/admin?tab=${tab}&error=invalid-buylist`);

  if (!canTransitionBuylistStatus(existing.status, normalizedStatus) && existing.status !== normalizedStatus) {
    redirect(`/admin?tab=${tab}&error=invalid-buylist-transition`);
  }

  const shouldIssueToken = normalizedStatus === "offered";
  const tokenBundle = shouldIssueToken ? generateAcceptToken() : null;
  const expiresAt = normalizedStatus === "offered" ? offerExpiryDate(14).toISOString() : existing.offerExpiresAt;
  const payoutCents =
    normalizedStatus === "offered" && offerCents !== null
      ? offerCents
      : existing.payoutCents ?? offerCents;

  const receivedAt =
    normalizedStatus === "received" && !existing.receivedAt ? new Date().toISOString() : existing.receivedAt;
  const stockedAt =
    normalizedStatus === "stocked" && !existing.stockedAt ? new Date().toISOString() : existing.stockedAt;
  const paidAt = normalizedStatus === "paid" && !existing.paidAt ? new Date().toISOString() : existing.paidAt;

  if (tokenBundle) {
    await sql`
      update buylist_submissions
      set
        status = ${normalizedStatus},
        offer_cents = ${offerCents},
        offer_note = ${offerNote || null},
        offer_expires_at = ${expiresAt},
        payout_cents = ${payoutCents},
        accept_token_hash = ${tokenBundle.hash},
        accept_token_expires_at = ${expiresAt},
        received_at = ${receivedAt},
        stocked_at = ${stockedAt},
        paid_at = ${paidAt},
        updated_at = now()
      where id = ${id}
    `;

    // Vincula à conta do mesmo e-mail, se existir (para aparecer em /conta).
    try {
      await sql`
        update buylist_submissions
        set user_id = users.id
        from users
        where buylist_submissions.id = ${id}
          and lower(users.email) = lower(buylist_submissions.email)
          and buylist_submissions.user_id is null
      `;
    } catch {
      // best-effort
    }
  } else {
    await sql`
      update buylist_submissions
      set
        status = ${normalizedStatus},
        offer_cents = ${offerCents},
        offer_note = ${offerNote || null},
        offer_expires_at = ${normalizedStatus === "offered" ? expiresAt : existing.offerExpiresAt},
        payout_cents = ${payoutCents},
        received_at = ${receivedAt},
        stocked_at = ${stockedAt},
        paid_at = ${paidAt},
        updated_at = now()
      where id = ${id}
    `;
  }

  revalidatePath("/admin");
  revalidatePath("/conta");
  revalidatePath(`/buylist/${id}`);

  if (tokenBundle && offerCents !== null) {
    const url = buylistCustomerUrl(id, tokenBundle.token);
    const emailResult = await sendBuylistOfferEmail({
      to: existing.email,
      customerName: existing.customerName,
      game: existing.game,
      offerCents,
      offerNote: offerNote || existing.offerNote,
      offerUrl: url,
      expiresAt
    });

    const notice =
      emailResult.ok
        ? "buylist-offered-email"
        : emailResult.reason === "not-configured"
          ? "buylist-offered-manual"
          : "buylist-offered-email-failed";

    redirect(
      `/admin?tab=${tab}&notice=${notice}&tokenUrl=${encodeURIComponent(url)}&focus=${encodeURIComponent(id)}`
    );
  }

  redirect(`/admin?tab=${tab}&notice=buylist-updated&focus=${encodeURIComponent(id)}`);
}

export async function regenerateBuylistTokenAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const tab = adminTabFrom(formData, "buylists");
  if (!id) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  const existing = await getBuylistSubmissionById(id);
  if (!existing) redirect(`/admin?tab=${tab}&error=invalid-buylist`);

  const tokenBundle = generateAcceptToken();
  const expiresAt = existing.offerExpiresAt ?? offerExpiryDate(14).toISOString();

  await sql`
    update buylist_submissions
    set
      accept_token_hash = ${tokenBundle.hash},
      accept_token_expires_at = ${expiresAt},
      updated_at = now()
    where id = ${id}
  `;

  const url = buylistCustomerUrl(id, tokenBundle.token);
  const sendEmail = readString(formData, "sendEmail") === "1";
  let notice = "buylist-token";

  if (sendEmail && existing.offerCents != null) {
    const emailResult = await sendBuylistOfferEmail({
      to: existing.email,
      customerName: existing.customerName,
      game: existing.game,
      offerCents: existing.offerCents,
      offerNote: existing.offerNote,
      offerUrl: url,
      expiresAt
    });
    notice = emailResult.ok
      ? "buylist-offered-email"
      : emailResult.reason === "not-configured"
        ? "buylist-offered-manual"
        : "buylist-offered-email-failed";
  }

  revalidatePath("/admin");
  redirect(
    `/admin?tab=${tab}&notice=${notice}&tokenUrl=${encodeURIComponent(url)}&focus=${encodeURIComponent(id)}`
  );
}

export async function acceptBuylistOfferAction(formData: FormData) {
  const id = readString(formData, "id");
  const token = readString(formData, "token");
  const access = await assertBuylistCustomerAccess(id, token);
  const back = token ? `/buylist/${id}?token=${encodeURIComponent(token)}` : `/buylist/${id}`;

  if (!access.ok || !access.submission) {
    redirect(withNotice(back, "error", access.reason === "expired" ? "offer-expired" : "unauthorized"));
  }

  const submission = access.submission;
  const status = normalizeBuylistStatus(submission.status);
  if (status !== "offered") redirect(withNotice(back, "error", "invalid-buylist-transition"));
  if (isOfferExpired(submission.offerExpiresAt)) redirect(withNotice(back, "error", "offer-expired"));
  if (!submission.offerCents || submission.offerCents <= 0) redirect(withNotice(back, "error", "invalid-buylist"));

  if (!hasDatabase()) redirect(withNotice(back, "notice", "demo-no-db"));
  const sql = getSql();
  if (!sql) redirect(withNotice(back, "error", "no-db"));
  await ensureBuylistSchema(sql);

  await sql`
    update buylist_submissions
    set
      status = 'awaiting_shipment',
      customer_accepted_at = now(),
      updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  revalidatePath("/conta");
  revalidatePath(`/buylist/${id}`);
  redirect(withNotice(back, "notice", "offer-accepted"));
}

export async function declineBuylistOfferAction(formData: FormData) {
  const id = readString(formData, "id");
  const token = readString(formData, "token");
  const access = await assertBuylistCustomerAccess(id, token);
  const back = token ? `/buylist/${id}?token=${encodeURIComponent(token)}` : `/buylist/${id}`;

  if (!access.ok || !access.submission) {
    redirect(withNotice(back, "error", access.reason === "expired" ? "offer-expired" : "unauthorized"));
  }

  const status = normalizeBuylistStatus(access.submission.status);
  if (status !== "offered") redirect(withNotice(back, "error", "invalid-buylist-transition"));

  if (!hasDatabase()) redirect(withNotice(back, "notice", "demo-no-db"));
  const sql = getSql();
  if (!sql) redirect(withNotice(back, "error", "no-db"));
  await ensureBuylistSchema(sql);

  await sql`
    update buylist_submissions
    set
      status = 'declined',
      customer_declined_at = now(),
      updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  revalidatePath("/conta");
  revalidatePath(`/buylist/${id}`);
  redirect(withNotice(back, "notice", "offer-declined"));
}

export async function updateBuylistInboundAction(formData: FormData) {
  const id = readString(formData, "id");
  const token = readString(formData, "token");
  const method = readString(formData, "inboundMethod");
  const trackingCode = readString(formData, "trackingCode");
  const pickupAt = readString(formData, "pickupAt");
  const access = await assertBuylistCustomerAccess(id, token);
  const back = token ? `/buylist/${id}?token=${encodeURIComponent(token)}` : `/buylist/${id}`;

  if (!access.ok || !access.submission) {
    redirect(withNotice(back, "error", "unauthorized"));
  }

  const status = normalizeBuylistStatus(access.submission.status);
  if (status !== "awaiting_shipment" && status !== "in_transit") {
    redirect(withNotice(back, "error", "invalid-buylist-transition"));
  }
  if (method !== "mail" && method !== "pickup") {
    redirect(withNotice(back, "error", "invalid-buylist"));
  }
  if (method === "mail" && !trackingCode) {
    redirect(withNotice(back, "error", "tracking-required"));
  }
  if (method === "pickup" && !pickupAt) {
    redirect(withNotice(back, "error", "pickup-required"));
  }

  if (!hasDatabase()) redirect(withNotice(back, "notice", "demo-no-db"));
  const sql = getSql();
  if (!sql) redirect(withNotice(back, "error", "no-db"));
  await ensureBuylistSchema(sql);

  const pickupValue = method === "pickup" ? new Date(pickupAt).toISOString() : null;

  await sql`
    update buylist_submissions
    set
      status = 'in_transit',
      inbound_method = ${method},
      tracking_code = ${method === "mail" ? trackingCode : null},
      pickup_at = ${pickupValue},
      updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  revalidatePath("/conta");
  revalidatePath(`/buylist/${id}`);
  redirect(withNotice(back, "notice", "inbound-saved"));
}

export async function markBuylistReceivedAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const tab = adminTabFrom(formData, "pendencias");
  if (!id) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  const existing = await getBuylistSubmissionById(id);
  if (!existing) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!canTransitionBuylistStatus(existing.status, "received")) {
    redirect(`/admin?tab=${tab}&error=invalid-buylist-transition`);
  }

  await sql`
    update buylist_submissions
    set status = 'received', received_at = now(), updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-received&focus=${encodeURIComponent(id)}`);
}

export async function startBuylistCheckingAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const tab = adminTabFrom(formData, "pendencias");
  if (!id) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  const existing = await getBuylistSubmissionById(id);
  if (!existing) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!canTransitionBuylistStatus(existing.status, "checking") && existing.status !== "checking") {
    redirect(`/admin?tab=${tab}&error=invalid-buylist-transition`);
  }

  await sql`
    update buylist_submissions
    set status = 'checking', updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-checking&focus=${encodeURIComponent(id)}`);
}

export async function upsertBuylistLineAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const submissionId = readString(formData, "submissionId");
  const lineId = readString(formData, "lineId");
  const name = readString(formData, "name");
  const game = readString(formData, "game") as Game;
  const setName = readString(formData, "setName");
  const conditionReceived = readString(formData, "conditionReceived") as CardCondition;
  const qtyAccepted = Math.max(0, Math.trunc(Number(readString(formData, "qtyAccepted") || "0")));
  const unitOfferCents = readMoneyCents(formData, "unitOffer");
  const lineStatus = readString(formData, "lineStatus") || "accepted";
  const notes = readString(formData, "notes");
  const tab = adminTabFrom(formData, "pendencias");

  if (
    !submissionId ||
    !name ||
    !validGames.includes(game as (typeof validGames)[number]) ||
    !validConditions.includes(conditionReceived as (typeof validConditions)[number]) ||
    !["pending", "accepted", "rejected", "adjusted"].includes(lineStatus) ||
    !Number.isFinite(unitOfferCents) ||
    unitOfferCents < 0
  ) {
    redirect(`/admin?tab=${tab}&error=invalid-buylist-line`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);
  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  if (lineId) {
    await sql`
      update buylist_lines
      set
        name = ${name},
        game = ${game},
        set_name = ${setName || null},
        condition_received = ${conditionReceived},
        qty_accepted = ${qtyAccepted},
        qty_offered = ${Math.max(qtyAccepted, 1)},
        unit_offer_cents = ${unitOfferCents},
        line_status = ${lineStatus},
        notes = ${notes || null},
        updated_at = now()
      where id = ${lineId} and submission_id = ${submissionId}
    `;
  } else {
    await sql`
      insert into buylist_lines (
        submission_id, name, game, set_name, condition_received,
        qty_offered, qty_accepted, unit_offer_cents, line_status, notes
      )
      values (
        ${submissionId}, ${name}, ${game}, ${setName || null}, ${conditionReceived},
        ${Math.max(qtyAccepted, 1)}, ${qtyAccepted}, ${unitOfferCents}, ${lineStatus}, ${notes || null}
      )
    `;
  }

  const submission = await getBuylistSubmissionById(submissionId);
  if (submission) {
    const payout = submission.lines
      .filter((line) => line.lineStatus === "accepted" || line.lineStatus === "adjusted")
      .reduce((sum, line) => sum + line.qtyAccepted * line.unitOfferCents, 0);
    await sql`
      update buylist_submissions
      set payout_cents = ${payout}, updated_at = now()
      where id = ${submissionId}
    `;
  }

  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-line-saved&focus=${encodeURIComponent(submissionId)}`);
}

export async function deleteBuylistLineAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const submissionId = readString(formData, "submissionId");
  const lineId = readString(formData, "lineId");
  const tab = adminTabFrom(formData, "pendencias");
  if (!submissionId || !lineId) redirect(`/admin?tab=${tab}&error=invalid-buylist-line`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  await sql`delete from buylist_lines where id = ${lineId} and submission_id = ${submissionId}`;

  const refreshed = await getBuylistSubmissionById(submissionId);
  if (refreshed) {
    const payout = refreshed.lines
      .filter((line) => line.lineStatus === "accepted" || line.lineStatus === "adjusted")
      .reduce((sum, line) => sum + line.qtyAccepted * line.unitOfferCents, 0);
    await sql`
      update buylist_submissions
      set payout_cents = ${payout}, updated_at = now()
      where id = ${submissionId}
    `;
  }

  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-line-deleted&focus=${encodeURIComponent(submissionId)}`);
}

export async function updateBuylistPayoutAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const payoutCents = readMoneyCents(formData, "payout");
  const tab = adminTabFrom(formData, "pendencias");
  if (!id || !Number.isFinite(payoutCents) || payoutCents < 0) {
    redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  }
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  await sql`
    update buylist_submissions
    set payout_cents = ${payoutCents}, updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-payout-saved&focus=${encodeURIComponent(id)}`);
}

export async function stockBuylistAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const tab = adminTabFrom(formData, "pendencias");
  if (!id) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  const submission = await getBuylistSubmissionById(id);
  if (!submission) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (submission.status === "stocked" || submission.status === "paid") {
    redirect(`/admin?tab=${tab}&notice=buylist-already-stocked&focus=${encodeURIComponent(id)}`);
  }
  if (submission.status !== "checking" && submission.status !== "received") {
    redirect(`/admin?tab=${tab}&error=invalid-buylist-transition`);
  }

  const acceptedLines = submission.lines.filter(
    (line) => (line.lineStatus === "accepted" || line.lineStatus === "adjusted") && line.qtyAccepted > 0
  );
  if (acceptedLines.length === 0) {
    redirect(`/admin?tab=${tab}&error=buylist-no-lines`);
  }

  for (const line of acceptedLines) {
    if (line.cardId) {
      await sql`
        update cards
        set stock = stock + ${line.qtyAccepted}, active = true, updated_at = now()
        where id = ${line.cardId}
      `;
      continue;
    }

    const name = line.name;
    const game = line.game;
    const setName = line.setName || "Buylist";
    const condition = line.conditionReceived || "NM";
    const priceCents = Math.max(line.unitOfferCents, 0);
    const existing = await sql`
      select id from cards
      where name = ${name}
        and game = ${game}
        and set_name = ${setName}
        and condition = ${condition}
        and language = 'PT'
        and finish = 'Normal'
      limit 1
    `;

    if (existing.length > 0) {
      const cardId = String((existing[0] as { id: string }).id);
      await sql`
        update cards
        set stock = stock + ${line.qtyAccepted}, active = true, updated_at = now()
        where id = ${cardId}
      `;
      await sql`
        update buylist_lines
        set card_id = ${cardId}, updated_at = now()
        where id = ${line.id}
      `;
    } else {
      const inserted = await sql`
        insert into cards (
          name, game, set_name, rarity, condition, language,
          price_cents, market_price_cents, stock, image_url, tags, finish, featured
        )
        values (
          ${name}, ${game}, ${setName}, 'Buylist', ${condition}, 'PT',
          ${priceCents}, ${priceCents}, ${line.qtyAccepted},
          ${"/card-backs/magic-back.png"}, ${["buylist"]}, 'Normal', false
        )
        returning id
      `;
      const cardId = String((inserted[0] as { id: string }).id);
      await sql`
        update buylist_lines
        set card_id = ${cardId}, updated_at = now()
        where id = ${line.id}
      `;
    }
  }

  const payout =
    submission.payoutCents ??
    acceptedLines.reduce((sum, line) => sum + line.qtyAccepted * line.unitOfferCents, 0);

  await sql`
    update buylist_submissions
    set
      status = 'stocked',
      stocked_at = now(),
      payout_cents = ${payout},
      updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-stocked&focus=${encodeURIComponent(id)}`);
}

export async function markBuylistPaidAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const tab = adminTabFrom(formData, "pendencias");
  if (!id) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);
  await ensureBuylistSchema(sql);

  const existing = await getBuylistSubmissionById(id);
  if (!existing) redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  if (existing.status !== "stocked") {
    redirect(`/admin?tab=${tab}&error=invalid-buylist-transition`);
  }

  await sql`
    update buylist_submissions
    set status = 'paid', paid_at = now(), updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  revalidatePath("/conta");
  redirect(`/admin?tab=${tab}&notice=buylist-paid&focus=${encodeURIComponent(id)}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");
  const status = readString(formData, "status");
  const tab = adminTabFrom(formData, "orders");

  if (!id || !validOrderStatuses.includes(status as (typeof validOrderStatuses)[number])) {
    redirect(`/admin?tab=${tab}&error=invalid-order`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);

  await sql`
    update orders
    set status = ${status}
    where id = ${id}
  `;

  revalidatePath("/admin");
  revalidatePath("/conta");
  redirect(`/admin?tab=${tab}&notice=order-updated`);
}

export async function createBuylistAction(
  _: ActionState,
  formData: FormData
): Promise<ActionState> {
  const customerName = readString(formData, "customerName");
  const email = readString(formData, "email").toLowerCase();
  const game = readString(formData, "game") as Game;
  const notes = readString(formData, "notes");
  const files = formData.getAll("photos").filter((entry) => entry instanceof File) as File[];

  if (!customerName || !email || !game || !notes) {
    return { ok: false, message: "Preencha nome, email, jogo e detalhes do lote." };
  }

  const photos = files
    .filter((file) => file.size > 0)
    .slice(0, 4);

  if (!hasDatabase()) {
    return {
      ok: true,
      message: `Cotação demo recebida com ${photos.length} foto(s). Configure o Neon para salvar.`
    };
  }

  const sql = getSql();
  if (!sql) return { ok: false, message: "Banco indisponível." };

  const sessionUser = await currentUser();

  try {
    await ensureBuylistSchema(sql);
  } catch {
    // schema heal best-effort
  }

  const rows = await sql`
    insert into buylist_submissions (customer_name, email, game, notes, user_id)
    values (${customerName}, ${email}, ${game}, ${notes}, ${sessionUser?.id ?? null})
    returning id
  `;
  const submissionId = String(rows[0].id);

  let stored = 0;
  for (const file of photos) {
    try {
      const photo = await storeBuylistPhoto(file, submissionId);
      await sql`
        insert into buylist_photos (submission_id, file_name, mime_type, size_bytes, data_url)
        values (${submissionId}, ${photo.fileName}, ${photo.mimeType}, ${photo.sizeBytes}, ${photo.url})
      `;
      stored += 1;
    } catch (error) {
      console.error("Buylist photo upload failed", error);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return {
    ok: true,
    message:
      stored > 0
        ? `Cotação enviada com ${stored} foto(s). Vamos responder por email em até 24h.`
        : "Cotação enviada. Vamos responder por email em até 24h."
  };
}
