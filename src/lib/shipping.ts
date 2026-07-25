export type ShippingQuote = {
  id: string;
  company: string;
  service: string;
  priceCents: number;
  days: number | null;
  currency: "BRL";
  kind: "pickup" | "melhor_envio" | "fallback";
  meta?: {
    companyId?: number;
    serviceId?: number;
  };
};

type QuoteInput = {
  postalCode: string;
  itemCount: number;
  insuranceCents: number;
};

type MelhorEnvioQuote = {
  id: number;
  name: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { id?: number; name?: string };
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePostalCode(value: string) {
  const digits = digitsOnly(value);
  return digits.length === 8 ? digits : null;
}

export function hasMelhorEnvio() {
  return Boolean(process.env.MELHOR_ENVIO_TOKEN?.trim());
}

function pickupQuote(): ShippingQuote {
  const label = process.env.STORE_PICKUP_LABEL?.trim() || "Retirada na loja";
  return {
    id: "pickup",
    company: "Mana Draw",
    service: label,
    priceCents: 0,
    days: 0,
    currency: "BRL",
    kind: "pickup"
  };
}

function fallbackQuotes(itemCount: number): ShippingQuote[] {
  const packs = Math.max(1, Math.ceil(itemCount / 20));
  return [
    pickupQuote(),
    {
      id: "fallback-pac",
      company: "Correios",
      service: "PAC (estimado)",
      priceCents: 1890 + packs * 400,
      days: 8,
      currency: "BRL",
      kind: "fallback"
    },
    {
      id: "fallback-sedex",
      company: "Correios",
      service: "SEDEX (estimado)",
      priceCents: 2890 + packs * 650,
      days: 3,
      currency: "BRL",
      kind: "fallback"
    }
  ];
}

function moneyToCents(value: string | number | undefined) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function melhorEnvioBaseUrl() {
  const sandbox = process.env.MELHOR_ENVIO_SANDBOX !== "false";
  return sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br";
}

export async function quoteShipping(input: QuoteInput): Promise<ShippingQuote[]> {
  const postalCode = normalizePostalCode(input.postalCode);
  if (!postalCode) {
    throw new Error("CEP inválido. Use 8 dígitos.");
  }

  const quantity = Math.max(1, input.itemCount);
  const from = normalizePostalCode(process.env.MELHOR_ENVIO_FROM_POSTAL_CODE || "") || "01310100";
  const quotes: ShippingQuote[] = [pickupQuote()];

  if (!hasMelhorEnvio()) {
    return fallbackQuotes(quantity);
  }

  const token = process.env.MELHOR_ENVIO_TOKEN!.trim();
  const userAgent =
    process.env.MELHOR_ENVIO_USER_AGENT?.trim() ||
    "Mana Draw (contato@manadraw.local)";

  const insuranceReais = Math.max(1, input.insuranceCents / 100);
  const body = {
    from: { postal_code: from },
    to: { postal_code: postalCode },
    products: [
      {
        id: "tcg-cards",
        width: 11,
        height: 16,
        length: Math.min(40, Math.max(2, Math.ceil(quantity * 0.12))),
        weight: Math.max(0.1, Number((quantity * 0.018 + 0.05).toFixed(3))),
        insurance_value: insuranceReais,
        quantity: 1
      }
    ]
  };

  const response = await fetch(`${melhorEnvioBaseUrl()}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Melhor Envio quote failed", response.status, text.slice(0, 300));
    return fallbackQuotes(quantity);
  }

  const payload = (await response.json()) as MelhorEnvioQuote[];
  const mapped = (Array.isArray(payload) ? payload : [])
    .filter((row) => !row.error)
    .map((row): ShippingQuote | null => {
      const priceCents = moneyToCents(row.custom_price ?? row.price);
      if (priceCents == null) return null;
      const days = row.custom_delivery_time ?? row.delivery_time ?? null;
      return {
        id: `me-${row.id}`,
        company: row.company?.name || "Melhor Envio",
        service: row.name,
        priceCents,
        days: typeof days === "number" ? days : null,
        currency: "BRL",
        kind: "melhor_envio",
        meta: {
          companyId: row.company?.id,
          serviceId: row.id
        }
      };
    })
    .filter((row): row is ShippingQuote => row !== null)
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, 6);

  if (mapped.length === 0) {
    return fallbackQuotes(quantity);
  }

  return [...quotes, ...mapped];
}

export function findQuoteById(quotes: ShippingQuote[], id: string) {
  return quotes.find((quote) => quote.id === id) ?? null;
}
