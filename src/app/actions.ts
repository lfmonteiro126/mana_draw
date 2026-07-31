"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  allowDemoAuth,
  createSession,
  currentUser,
  DEMO_ADMIN,
  demoUserFor,
  generateEmailVerifyToken,
  hashPassword,
  signOut,
  verifyEmailVerifyToken,
  verifyPassword
} from "@/lib/auth";
import {
  buylistCustomerUrl,
  canTransitionBuylistStatus,
  generateAcceptToken,
  isOfferExpired,
  isValidBuylistStatus,
  normalizeBuylistStatus,
  offerExpiryDate,
  siteOrigin,
  verifyAcceptToken
} from "@/lib/buylist-flow";
import {
  ensureBuylistSchema,
  ensureOrderColumns,
  ensureSealedColumns,
  ensureUserEmailSchema,
  getBuylistAcceptTokenHash,
  getBuylistSubmissionById,
  getSql,
  hasDatabase,
  mapUser
} from "@/lib/db";
import { hasEmailProvider, sendBuylistOfferEmail, sendEmailVerification } from "@/lib/email";
import { createCheckoutPreference, hasMercadoPago } from "@/lib/payments/mercadopago";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";
import { isValidSealedType, sealedTypeLabel } from "@/lib/sealed";
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

function adminInventoryPath(formData: FormData, flash: { notice?: string; error?: string }) {
  const params = new URLSearchParams({ tab: adminTabFrom(formData, "inventory") });
  const page = readString(formData, "inv_page");
  const query = readString(formData, "inv_query");
  const game = readString(formData, "inv_game");
  const stock = readString(formData, "inv_stock");
  if (page && page !== "1") params.set("page", page);
  if (query) params.set("query", query);
  if (game && game !== "Todos") params.set("game", game);
  if (stock && stock !== "all") params.set("stock", stock);
  if (flash.notice) params.set("notice", flash.notice);
  if (flash.error) params.set("error", flash.error);
  return `/admin?${params.toString()}`;
}

function withNotice(path: string, key: string, value: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}${key}=${encodeURIComponent(value)}`;
}

const offerLinkFlashCookie = "mana_draw_offer_link";

async function setOfferLinkFlash(url: string) {
  const cookieStore = await cookies();
  cookieStore.set(offerLinkFlashCookie, url, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 120,
    secure: process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true"
  });
}

export async function consumeOfferLinkFlash() {
  const cookieStore = await cookies();
  return cookieStore.get(offerLinkFlashCookie)?.value ?? "";
}

async function assertBuylistCustomerAccess(submissionId: string, token: string) {
  const user = await currentUser();
  const submission = await getBuylistSubmissionById(submissionId);
  if (!submission) return { ok: false as const, reason: "not-found" as const, submission: null };

  // Session access only when the submission is linked to this account — never by email alone.
  if (user && submission.userId && submission.userId === user.id) {
    return { ok: true as const, submission, via: "session" as const };
  }

  if (!token) return { ok: false as const, reason: "unauthorized" as const, submission };

  const meta = await getBuylistAcceptTokenHash(submissionId);
  if (!meta?.hash) return { ok: false as const, reason: "unauthorized" as const, submission };
  if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const, submission };
  }
  if (!verifyAcceptToken(token, meta.hash)) {
    return { ok: false as const, reason: "unauthorized" as const, submission };
  }

  // Claim submission for a verified matching account (so it appears in /conta).
  if (user?.emailVerified && user.email.toLowerCase() === submission.email.toLowerCase()) {
    const sql = getSql();
    if (sql && !submission.userId) {
      try {
        await sql`
          update buylist_submissions
          set user_id = ${user.id}, updated_at = now()
          where id = ${submissionId}
            and user_id is null
        `;
      } catch {
        // best-effort
      }
    }
  }

  return { ok: true as const, submission, via: "token" as const };
}

async function authClientKey(prefix: string) {
  const h = await headers();
  return clientKeyFromHeaders(h, prefix);
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const limited = rateLimit(await authClientKey("register"), 8, 15 * 60_000);
    if (!limited.ok) {
      return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }

    const name = readString(formData, "name");
    const email = readString(formData, "email").toLowerCase();
    const password = readString(formData, "password");

    if (!name || !email || password.length < 8) {
      return { ok: false, message: "Informe nome, email e senha com pelo menos 8 caracteres." };
    }

    if (!hasDatabase()) {
      if (!allowDemoAuth()) {
        return { ok: false, message: "Cadastro indisponivel. Configure DATABASE_URL." };
      }
      await createSession(demoUserFor(email, name));
      revalidatePath("/");
      return { ok: true, message: "Conta demo criada. Configure o Neon para persistir usuarios." };
    }

    const sql = getSql();
    if (!sql) return { ok: false, message: "Banco indisponivel." };
    await ensureUserEmailSchema(sql);

    const existing = await sql`select id from users where email = ${email} limit 1`;
    if (existing.length > 0) {
      return { ok: false, message: "Nao foi possivel criar a conta com estes dados." };
    }

    const verify = generateEmailVerifyToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    // Without email provider (local/dev), auto-verify so the app stays usable.
    const autoVerify = !hasEmailProvider();

    const rows = await sql`
      insert into users (
        name,
        email,
        password_hash,
        role,
        email_verified_at,
        email_verify_token_hash,
        email_verify_expires_at
      )
      values (
        ${name},
        ${email},
        ${hashPassword(password)},
        'customer',
        ${autoVerify ? new Date().toISOString() : null},
        ${autoVerify ? null : verify.hash},
        ${autoVerify ? null : expiresAt}
      )
      returning id, name, email, role, email_verified_at
    `;

    const created = mapUser(rows[0] as Parameters<typeof mapUser>[0]);
    await createSession(created);

    if (!autoVerify) {
      const sent = await sendEmailVerification({
        to: email,
        name,
        verifyUrl: `${siteOrigin()}/verificar-email?uid=${encodeURIComponent(created.id)}&token=${encodeURIComponent(verify.token)}`
      });
      if (!sent.ok) {
        return {
          ok: true,
          message:
            "Conta criada, mas nao foi possivel enviar o e-mail de verificacao. Use reenviar em /conta."
        };
      }
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/conta");
    return {
      ok: true,
      message: autoVerify
        ? "Conta criada com sucesso."
        : "Conta criada. Confirme seu e-mail para vincular cotações de buylist."
    };
  } catch (error) {
    return {
      ok: false,
      message: authErrorMessage(error)
    };
  }
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const limited = rateLimit(await authClientKey("login"), 20, 15 * 60_000);
    if (!limited.ok) {
      return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
    }

    const email = readString(formData, "email").toLowerCase();
    const password = readString(formData, "password");

    if (!email || !password) return { ok: false, message: "Informe email e senha." };

    if (!hasDatabase()) {
      if (!allowDemoAuth()) {
        return { ok: false, message: "Login indisponivel. Configure DATABASE_URL." };
      }
      if (email === DEMO_ADMIN.email && password !== DEMO_ADMIN.password) {
        return { ok: false, message: "Email ou senha invalidos." };
      }
      await createSession(demoUserFor(email));
      revalidatePath("/");
      revalidatePath("/admin");
      revalidatePath("/conta");
      return { ok: true, message: "Login demo ativo. Configure o Neon para persistir sessoes." };
    }

    const sql = getSql();
    if (!sql) return { ok: false, message: "Banco indisponivel." };
    await ensureUserEmailSchema(sql);

    const rows = await sql`
      select id, name, email, role, password_hash, email_verified_at
      from users
      where email = ${email}
      limit 1
    `;

    const [row] = rows as Array<{
      id: string;
      name: string;
      email: string;
      role: StoreUser["role"];
      password_hash: string;
      email_verified_at: string | null;
    }>;
    if (!row || !verifyPassword(password, row.password_hash)) {
      return { ok: false, message: "Email ou senha invalidos." };
    }

    await createSession(mapUser(row));
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

export async function resendVerificationAction(
  _prev: ActionState,
  _formData?: FormData
): Promise<ActionState> {
  const limited = rateLimit(await authClientKey("resend-verify"), 5, 15 * 60_000);
  if (!limited.ok) {
    return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." };
  }

  const user = await currentUser();
  if (!user) return { ok: false, message: "Entre na conta para reenviar a verificacao." };
  if (user.emailVerified) return { ok: true, message: "E-mail ja verificado." };
  if (!hasEmailProvider()) {
    return { ok: false, message: "Envio de e-mail nao configurado (RESEND_API_KEY)." };
  }

  const sql = getSql();
  if (!sql) return { ok: false, message: "Banco indisponivel." };
  await ensureUserEmailSchema(sql);

  const verify = generateEmailVerifyToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  await sql`
    update users
    set
      email_verify_token_hash = ${verify.hash},
      email_verify_expires_at = ${expiresAt}
    where id = ${user.id}
  `;

  const sent = await sendEmailVerification({
    to: user.email,
    name: user.name,
    verifyUrl: `${siteOrigin()}/verificar-email?uid=${encodeURIComponent(user.id)}&token=${encodeURIComponent(verify.token)}`
  });

  if (!sent.ok) return { ok: false, message: "Nao foi possivel enviar o e-mail agora." };
  return { ok: true, message: "Enviamos um novo link de verificacao." };
}

export async function verifyEmailAction(
  userId: string,
  token: string
): Promise<{ ok: boolean; message: string }> {
  if (!userId || !token) return { ok: false, message: "Link invalido." };
  if (!hasDatabase()) return { ok: false, message: "Banco indisponivel." };

  const sql = getSql();
  if (!sql) return { ok: false, message: "Banco indisponivel." };
  await ensureUserEmailSchema(sql);

  const rows = await sql`
    select id, email_verify_token_hash, email_verify_expires_at::text, email_verified_at::text
    from users
    where id = ${userId}
    limit 1
  `;

  const [row] = rows as Array<{
    id: string;
    email_verify_token_hash: string | null;
    email_verify_expires_at: string | null;
    email_verified_at: string | null;
  }>;

  if (!row) return { ok: false, message: "Link invalido." };
  if (row.email_verified_at) return { ok: true, message: "E-mail ja verificado." };
  if (!row.email_verify_token_hash || !verifyEmailVerifyToken(token, row.email_verify_token_hash)) {
    return { ok: false, message: "Link invalido ou ja usado." };
  }
  if (row.email_verify_expires_at && new Date(row.email_verify_expires_at).getTime() < Date.now()) {
    return { ok: false, message: "Link expirado. Reenvie a verificacao em /conta." };
  }

  await sql`
    update users
    set
      email_verified_at = now(),
      email_verify_token_hash = null,
      email_verify_expires_at = null
    where id = ${row.id}
  `;

  await sql`
    update buylist_submissions
    set user_id = ${row.id}, updated_at = now()
    from users
    where users.id = ${row.id}
      and lower(buylist_submissions.email) = lower(users.email)
      and buylist_submissions.user_id is null
  `;

  revalidatePath("/conta");
  revalidatePath("/");
  return { ok: true, message: "E-mail verificado com sucesso." };
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

  const reserved: Array<{ cardId: string; quantity: number }> = [];
  try {
    for (const line of cleanCart) {
      const card = inventory.get(line.cardId);
      if (!card) throw new Error("Carta indisponível.");

      await sql`
        insert into order_items (order_id, card_id, quantity, unit_price_cents)
        values (${orderId}, ${line.cardId}, ${line.quantity}, ${card.price_cents})
      `;

      const updated = await sql`
        update cards
        set stock = stock - ${line.quantity}, updated_at = now()
        where id = ${line.cardId}
          and stock >= ${line.quantity}
        returning id
      `;
      if (updated.length === 0) {
        throw new Error("Uma carta do carrinho ficou indisponível.");
      }
      reserved.push({ cardId: line.cardId, quantity: line.quantity });
    }
  } catch (error) {
    for (const item of reserved) {
      await sql`
        update cards
        set stock = stock + ${item.quantity}, updated_at = now()
        where id = ${item.cardId}
      `;
    }
    await sql`delete from order_items where order_id = ${orderId}`;
    await sql`delete from orders where id = ${orderId}`;
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível reservar o estoque."
    };
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
    for (const item of reserved) {
      await sql`
        update cards
        set stock = stock + ${item.quantity}, updated_at = now()
        where id = ${item.cardId}
      `;
    }
    await sql`
      update orders
      set status = 'cancelled', updated_at = now()
      where id = ${orderId}
    `;
    revalidatePath("/");
    revalidatePath("/conta");
    revalidatePath("/admin");
    return {
      ok: false,
      message: "Não foi possível abrir o checkout. O estoque foi liberado — tente novamente."
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

  if (!id || !Number.isFinite(priceCents) || !Number.isInteger(stock)) {
    redirect(adminInventoryPath(formData, { error: "invalid-card" }));
  }

  if (!hasDatabase()) redirect(adminInventoryPath(formData, { notice: "demo-no-db" }));

  const sql = getSql();
  if (!sql) redirect(adminInventoryPath(formData, { error: "no-db" }));

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
  redirect(adminInventoryPath(formData, { notice: "card-updated" }));
}

export async function deleteCardAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const id = readString(formData, "id");

  if (!id) redirect(adminInventoryPath(formData, { error: "invalid-card" }));
  if (!hasDatabase()) redirect(adminInventoryPath(formData, { notice: "demo-no-db" }));

  const sql = getSql();
  if (!sql) redirect(adminInventoryPath(formData, { error: "no-db" }));

  await sql`
    update cards
    set active = false, stock = 0, updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(adminInventoryPath(formData, { notice: "card-deleted" }));
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

export async function createSealedProductAction(formData: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin?error=unauthorized");

  const name = readString(formData, "name");
  const game = readString(formData, "game") as Game;
  const setName = readString(formData, "setName");
  const sealedType = readString(formData, "sealedType");
  const language = readString(formData, "language");
  const imageUrl = readString(formData, "imageUrl");
  const tags = readString(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const priceCents = readMoneyCents(formData, "price");
  const marketRaw = readString(formData, "marketPrice");
  const marketPriceCents = marketRaw ? readMoneyCents(formData, "marketPrice") : 0;
  const stock = Number(readString(formData, "stock"));
  const featured = formData.get("featured") === "on";
  const tab = adminTabFrom(formData, "new-card");

  const hasInvalidEnum =
    !validGames.includes(game) ||
    !isValidSealedType(game, sealedType) ||
    !validLanguages.includes(language as (typeof validLanguages)[number]);

  if (
    !name ||
    !setName ||
    !imageUrl ||
    hasInvalidEnum ||
    !Number.isFinite(priceCents) ||
    !Number.isFinite(marketPriceCents) ||
    !Number.isInteger(stock) ||
    priceCents < 0 ||
    marketPriceCents < 0 ||
    stock < 0
  ) {
    redirect(`/admin?tab=${tab}&error=invalid-new-sealed`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);

  await ensureSealedColumns(sql);

  const rarity = sealedTypeLabel(game, sealedType);
  const mergedTags = Array.from(new Set(["Selado", rarity, ...tags]));

  const existing = await sql`
    select id
    from cards
    where game = ${game}
      and active = true
      and coalesce(product_kind, 'single') = 'sealed'
      and lower(name) = lower(${name})
      and lower(set_name) = lower(${setName})
      and language = ${language}
      and sealed_type = ${sealedType}
      and image_url = ${imageUrl}
    limit 1
  `;

  if (existing.length > 0) {
    await sql`
      update cards
      set
        stock = stock + ${stock},
        price_cents = ${priceCents},
        market_price_cents = ${marketPriceCents},
        rarity = ${rarity},
        tags = ${mergedTags},
        featured = ${featured},
        active = true,
        updated_at = now()
      where id = ${(existing[0] as { id: string }).id}
    `;
  } else {
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
        featured,
        product_kind,
        sealed_type
      )
      values (
        ${name},
        ${game},
        ${setName},
        ${rarity},
        ${"NM"},
        ${language},
        ${priceCents},
        ${marketPriceCents},
        ${stock},
        ${imageUrl},
        ${mergedTags},
        ${"Normal"},
        ${featured},
        ${"sealed"},
        ${sealedType}
      )
    `;
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=sealed-created`);
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

    // Vincula à conta verificada do mesmo e-mail, se existir (para aparecer em /conta).
    try {
      await sql`
        update buylist_submissions
        set user_id = users.id
        from users
        where buylist_submissions.id = ${id}
          and lower(users.email) = lower(buylist_submissions.email)
          and users.email_verified_at is not null
          and buylist_submissions.user_id is null
      `;
    } catch {
      // best-effort — column may be missing until ensureUserEmailSchema runs
      try {
        await ensureUserEmailSchema(sql);
      } catch {
        // ignore
      }
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

    await setOfferLinkFlash(url);
    redirect(`/admin?tab=${tab}&notice=${notice}&focus=${encodeURIComponent(id)}`);
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
  await setOfferLinkFlash(url);
  redirect(`/admin?tab=${tab}&notice=${notice}&focus=${encodeURIComponent(id)}`);
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
  const linkUserId =
    sessionUser?.emailVerified && sessionUser.email.toLowerCase() === email
      ? sessionUser.id
      : null;

  try {
    await ensureBuylistSchema(sql);
  } catch {
    // schema heal best-effort
  }

  const limited = rateLimit(await authClientKey("buylist-create"), 10, 60 * 60_000);
  if (!limited.ok) {
    return { ok: false, message: "Muitas cotações enviadas. Tente de novo mais tarde." };
  }

  const rows = await sql`
    insert into buylist_submissions (customer_name, email, game, notes, user_id)
    values (${customerName}, ${email}, ${game}, ${notes}, ${linkUserId})
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
