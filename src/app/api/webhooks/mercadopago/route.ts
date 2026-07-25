import { NextResponse } from "next/server";
import { getSql, hasDatabase } from "@/lib/db";
import { getPayment, hasMercadoPago, mapMercadoPagoStatus } from "@/lib/payments/mercadopago";

export const runtime = "nodejs";

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

async function markOrderFromPayment(paymentId: string) {
  if (!hasMercadoPago() || !hasDatabase()) return;

  const payment = await getPayment(paymentId);
  const orderId = String(payment.external_reference || payment.metadata?.order_id || "");
  if (!orderId) return;

  const status = mapMercadoPagoStatus(payment.status);
  const sql = getSql();
  if (!sql) return;

  await sql`
    update orders
    set
      status = ${status},
      payment_id = ${String(payment.id ?? paymentId)},
      payment_status = ${payment.status ?? null},
      updated_at = now()
    where id = ${orderId}
  `;
}

export async function GET(request: Request) {
  try {
    const paymentId = await resolvePaymentId(request);
    if (paymentId) await markOrderFromPayment(paymentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mercado Pago webhook GET failed", error);
    return NextResponse.json({ ok: true });
  }
}

export async function POST(request: Request) {
  try {
    const paymentId = await resolvePaymentId(request);
    if (paymentId) await markOrderFromPayment(paymentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mercado Pago webhook POST failed", error);
    return NextResponse.json({ ok: true });
  }
}
