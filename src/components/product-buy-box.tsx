"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProductPrice } from "@/components/product-price";
import { addToStoredCart, cartUnitCount } from "@/lib/cart-storage";
import { formatStock } from "@/lib/format";
import type { TcgCard } from "@/lib/types";

export function ProductBuyBox({ card }: { card: TcgCard }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const maxQty = Math.max(1, card.stock);
  const canBuy = card.stock > 0;

  function handleAdd() {
    if (!canBuy) return;
    addToStoredCart(card.id, card.stock, quantity);
    setCartCount(cartUnitCount());
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  function goToCart() {
    try {
      sessionStorage.setItem("mana-draw-open-cart", "1");
    } catch {
      // ignore
    }
    router.push("/");
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[var(--surface-soft)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          {card.productKind === "sealed" ? "Produto selado" : "Single"}
        </p>
        <ProductPrice
          className="mt-2"
          priceCents={card.priceCents}
          marketPriceCents={card.marketPriceCents}
          size="lg"
        />
        <p className="mt-2 text-sm text-[var(--muted)]">
          {canBuy ? formatStock(card.stock) : "Sem estoque no momento"}
        </p>
      </div>

      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1 font-semibold text-[var(--ink)]">
            {card.game}
          </span>
          {card.productKind === "single" ? (
            <span className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1 font-semibold text-[var(--ink)]">
              {card.condition}
            </span>
          ) : null}
          <span className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1 font-semibold text-[var(--ink)]">
            {card.language}
          </span>
          <span className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 py-1 font-semibold text-[var(--ink)]">
            {card.finish}
          </span>
        </div>

        {canBuy ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--ink)]">Quantidade</p>
            <div className="inline-flex items-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)]">
              <button
                type="button"
                className="grid h-11 w-11 place-items-center text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
                aria-label="Diminuir"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={16} />
              </button>
              <span className="grid h-11 min-w-12 place-items-center text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center text-[var(--ink)] transition hover:bg-[var(--surface-hover)] disabled:opacity-35"
                aria-label="Aumentar"
                disabled={quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canBuy}
          onClick={handleAdd}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--muted)]"
        >
          {added ? <Check size={18} /> : <ShoppingBag size={18} />}
          {added ? "Adicionado" : canBuy ? "Adicionar ao carrinho" : "Indisponível"}
        </button>

        {added ? (
          <button
            type="button"
            onClick={goToCart}
            className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
          >
            Ver carrinho{cartCount > 0 ? ` (${cartCount})` : ""}
          </button>
        ) : (
          <Link
            href="/#catalogo"
            className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
          >
            Continuar comprando
          </Link>
        )}

        <ul className="space-y-1.5 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
          <li>Pix e cartão via Mercado Pago</li>
          <li>Frete rastreado ou retirada na loja</li>
          <li>Estoque real — quantidade limitada</li>
        </ul>
      </div>
    </div>
  );
}
