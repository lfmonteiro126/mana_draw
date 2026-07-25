import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { getAppUrl } from "@/lib/app-url";

export type CheckoutLine = {
  id: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
};

export function hasMercadoPago() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

function client() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  return new MercadoPagoConfig({ accessToken });
}

export async function createCheckoutPreference(input: {
  orderId: string;
  email: string;
  name?: string;
  lines: CheckoutLine[];
  shippingCents: number;
  shippingLabel?: string;
}) {
  const preference = new Preference(client());
  const appUrl = getAppUrl();

  const items = input.lines.map((line) => ({
    id: line.id,
    title: line.title.slice(0, 120),
    quantity: line.quantity,
    unit_price: Number((line.unitPriceCents / 100).toFixed(2)),
    currency_id: "BRL" as const
  }));

  if (input.shippingCents > 0) {
    items.push({
      id: "shipping",
      title: (input.shippingLabel || "Frete").slice(0, 120),
      quantity: 1,
      unit_price: Number((input.shippingCents / 100).toFixed(2)),
      currency_id: "BRL"
    });
  }

  const result = await preference.create({
    body: {
      items,
      payer: {
        email: input.email,
        name: input.name
      },
      external_reference: input.orderId,
      metadata: {
        order_id: input.orderId
      },
      back_urls: {
        success: `${appUrl}/pedido/retorno?status=success`,
        failure: `${appUrl}/pedido/retorno?status=failure`,
        pending: `${appUrl}/pedido/retorno?status=pending`
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      statement_descriptor: "MANA DRAW"
    }
  });

  const sandbox = process.env.MERCADOPAGO_SANDBOX === "true";
  const checkoutUrl = sandbox
    ? result.sandbox_init_point || result.init_point
    : result.init_point || result.sandbox_init_point;

  if (!result.id || !checkoutUrl) {
    throw new Error("Mercado Pago não retornou link de checkout.");
  }

  return {
    preferenceId: result.id,
    checkoutUrl
  };
}

export async function getPayment(paymentId: string) {
  const payment = new Payment(client());
  return payment.get({ id: paymentId });
}

export function mapMercadoPagoStatus(status: string | undefined) {
  switch (status) {
    case "approved":
      return "paid";
    case "cancelled":
    case "rejected":
    case "refunded":
    case "charged_back":
      return "cancelled";
    default:
      return "pending";
  }
}
