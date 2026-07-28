import { NextResponse } from "next/server";
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator
} from "mercadopago";
import { getSql, hasDatabase } from "@/lib/db";
import { getPayment, hasMercadoPago, mapMercadoPagoStatus } from "@/lib/payments/mercadopago";

export const runtime = "nodejs";

function webhookSecret() {
  return process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || "";
}

function verifyWebhookSignature(request: Request, dataId: string | null) {
  const secret = webhookSecret();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MERCADOPAGO_WEBHOOK_SECRET não configurado.");
    }
    // Dev without secret: still accept so local probes work.
    return;
  }

  WebhookSignatureValidator.validate({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    secret,
    toleranceSeconds: 300
  });
}

async function resolvePaymentId(request: Request) {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const topic = url.searchParams.get("topic") || url.searchParams.get("type");

  if (queryId && (topic === "payment" || !topic)) {
    return queryId;
  }

  if (request.method === "POST") {
    try {
      const payload = (await request.json()) as {
        type?: string;
        action?: string;
        data?: { id?: string | number };
      };
      if (payload?.data?.id && (payload.type === "payment" || payload.action?.includes("payment"))) {
        return String(payload.data.id);
      }
    } catch {
      // Mercado Pago may send empty body on some probes.
    }
  }

  return null;
}

function paymentAmountCents(payment: Awaited<ReturnType<typeof getPayment>>) {
  const amount = Number(payment.transaction_amount);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

async function restoreOrderStock(orderId: string) {
  const sql = getSql();
  if (!sql) return;

  const items = (await sql`
    select card_id, quantity
    from order_items
    where order_id = ${orderId}
  `) as Array<{ card_id: string; quantity: number }>;

  for (const item of items) {
    await sql`
      update cards
      set stock = stock + ${item.quantity}, updated_at = now()
      where id = ${item.card_id}
    `;
  }
}

async function markOrderFromPayment(paymentId: string) {
  if (!hasMercadoPago() || !hasDatabase()) return;

  const payment = await getPayment(paymentId);
  const orderId = String(payment.external_reference || payment.metadata?.order_id || "");
  if (!orderId) return;

  const status = mapMercadoPagoStatus(payment.status);
  const sql = getSql();
  if (!sql) return;

  const orders = (await sql`
    select id, status, total_cents
    from orders
    where id = ${orderId}
    limit 1
  `) as Array<{ id: string; status: string; total_cents: number | null }>;

  const order = orders[0];
  if (!order) return;

  if (status === "paid") {
    const paidCents = paymentAmountCents(payment);
    if (paidCents != null && order.total_cents != null && paidCents !== order.total_cents) {
      console.error("Mercado Pago amount mismatch", {
        orderId,
        expected: order.total_cents,
        paid: paidCents,
        paymentId
      });
      return;
    }
  }

  // Ignore stale cancellations after a successful payment.
  if (status === "cancelled" && order.status === "paid") {
    return;
  }

  // Avoid double-restoring stock on repeated cancel webhooks.
  const shouldRestoreStock = status === "cancelled" && order.status === "pending";

  await sql`
    update orders
    set
      status = ${status},
      payment_id = ${String(payment.id ?? paymentId)},
      payment_status = ${payment.status ?? null},
      updated_at = now()
    where id = ${orderId}
  `;

  if (shouldRestoreStock) {
    await restoreOrderStock(orderId);
  }
}

async function handleWebhook(request: Request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");

  try {
    verifyWebhookSignature(request, dataId);
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      console.warn("Mercado Pago webhook signature rejected", error.reason);
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    console.error("Mercado Pago webhook auth failed", error);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const paymentId = await resolvePaymentId(request);
  if (paymentId) await markOrderFromPayment(paymentId);
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  try {
    return await handleWebhook(request);
  } catch (error) {
    console.error("Mercado Pago webhook GET failed", error);
    return NextResponse.json({ ok: true });
  }
}

export async function POST(request: Request) {
  try {
    return await handleWebhook(request);
  } catch (error) {
    console.error("Mercado Pago webhook POST failed", error);
    return NextResponse.json({ ok: true });
  }
}
