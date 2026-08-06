export const CART_STORAGE_KEY = "mana-draw-cart-v1";

export type StoredCartLine = {
  cardId: string;
  quantity: number;
};

export function readStoredCart(): StoredCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line) => line && typeof line.cardId === "string")
      .map((line) => ({
        cardId: line.cardId,
        quantity: Math.max(1, Math.floor(Number(line.quantity) || 1))
      }));
  } catch {
    return [];
  }
}

export function writeStoredCart(lines: StoredCartLine[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

export function clearStoredCart() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CART_STORAGE_KEY);
}

/** Adds or increments a line; respects max stock. Returns new total units for that card. */
export function addToStoredCart(cardId: string, stock: number, quantity = 1) {
  const lines = readStoredCart();
  const existing = lines.find((line) => line.cardId === cardId);
  const nextQty = Math.min(stock, (existing?.quantity ?? 0) + Math.max(1, quantity));

  if (existing) {
    existing.quantity = nextQty;
  } else if (stock > 0) {
    lines.push({ cardId, quantity: nextQty });
  }

  writeStoredCart(lines.filter((line) => line.quantity > 0));
  return nextQty;
}

export function cartUnitCount(lines: StoredCartLine[] = readStoredCart()) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
