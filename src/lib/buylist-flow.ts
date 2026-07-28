import { createHash, randomBytes } from "crypto";
import type { BuylistStatus } from "./types";

/** Status canônicos do ciclo de compra via buylist. */
export const BUYLIST_STATUSES = [
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
  "cancelled"
] as const satisfies readonly BuylistStatus[];

/** Status legados ainda aceitos na leitura (migração). */
export const LEGACY_BUYLIST_STATUSES = ["approved"] as const;

const transitions: Record<string, readonly string[]> = {
  new: ["reviewing", "offered", "declined", "cancelled"],
  reviewing: ["offered", "declined", "cancelled", "new"],
  /** Legado: approved = oferta da loja → trata como offered */
  approved: ["awaiting_shipment", "declined", "cancelled", "offered", "reviewing"],
  offered: ["awaiting_shipment", "declined", "cancelled", "reviewing", "offered"],
  awaiting_shipment: ["in_transit", "received", "cancelled", "declined"],
  in_transit: ["received", "cancelled"],
  received: ["checking", "cancelled"],
  checking: ["stocked", "received", "cancelled"],
  stocked: ["paid", "cancelled"],
  paid: [],
  declined: ["reviewing", "offered"],
  cancelled: ["reviewing"]
};

export function normalizeBuylistStatus(status: string): BuylistStatus | string {
  if (status === "approved") return "offered";
  return status;
}

export function canTransitionBuylistStatus(from: string, to: string) {
  const source = normalizeBuylistStatus(from);
  const allowed = transitions[source] ?? [];
  return allowed.includes(to) || from === to;
}

export function isOpenBuylistStatus(status: string) {
  const normalized = normalizeBuylistStatus(status);
  return normalized === "new" || normalized === "reviewing";
}

export function isAwaitingCustomerStatus(status: string) {
  const normalized = normalizeBuylistStatus(status);
  return normalized === "offered";
}

export function isInboundPendingStatus(status: string) {
  const normalized = normalizeBuylistStatus(status);
  return normalized === "awaiting_shipment" || normalized === "in_transit";
}

export function isReceiveQueueStatus(status: string) {
  const normalized = normalizeBuylistStatus(status);
  return (
    normalized === "in_transit" ||
    normalized === "received" ||
    normalized === "checking" ||
    normalized === "stocked"
  );
}

export function isValidBuylistStatus(status: string): status is BuylistStatus {
  return (BUYLIST_STATUSES as readonly string[]).includes(status) || status === "approved";
}

export function generateAcceptToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashAcceptToken(token) };
}

export function hashAcceptToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function offerExpiryDate(days = 14) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function isOfferExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function siteOrigin() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function buylistCustomerUrl(id: string, token?: string | null) {
  const base = `${siteOrigin()}/buylist/${id}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function computePayoutFromLines(
  lines: Array<{ lineStatus: string; qtyAccepted: number; unitOfferCents: number }>
) {
  return lines
    .filter((line) => line.lineStatus === "accepted" || line.lineStatus === "adjusted")
    .reduce((sum, line) => sum + line.qtyAccepted * line.unitOfferCents, 0);
}
