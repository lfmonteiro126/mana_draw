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
import { ensureOrderColumns, getSql, hasDatabase } from "@/lib/db";
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
const validBuylistStatuses = ["new", "reviewing", "approved", "declined", "paid"] as const;
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
  const offerCents = offerInput ? readMoneyCents(formData, "offer") : null;
  const tab = adminTabFrom(formData, "buylists");

  if (
    !id ||
    !validBuylistStatuses.includes(status as (typeof validBuylistStatuses)[number]) ||
    (offerCents !== null && (!Number.isFinite(offerCents) || offerCents < 0))
  ) {
    redirect(`/admin?tab=${tab}&error=invalid-buylist`);
  }

  if (!hasDatabase()) redirect(`/admin?tab=${tab}&notice=demo-no-db`);

  const sql = getSql();
  if (!sql) redirect(`/admin?tab=${tab}&error=no-db`);

  await sql`
    update buylist_submissions
    set status = ${status}, offer_cents = ${offerCents}, updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&notice=buylist-updated`);
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

  const rows = await sql`
    insert into buylist_submissions (customer_name, email, game, notes)
    values (${customerName}, ${email}, ${game}, ${notes})
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
