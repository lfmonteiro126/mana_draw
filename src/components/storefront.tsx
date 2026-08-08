"use client";

import {
  ArrowUpDown,
  BadgeCheck,
  Boxes,
  Camera,
  ChevronRight,
  CreditCard,
  Filter,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Swords,
  Truck,
  UserRound,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createOrderAction, logoutAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth-panel";
import { BuylistForm } from "@/components/buylist-form";
import { CardDetailsModal } from "@/components/card-details-modal";
import { CardScannerModal } from "@/components/scanner/card-scanner-modal";
import { ProductPrice } from "@/components/product-price";
import { TrustStrip } from "@/components/trust-strip";
import { cardHasSecondFace, resolveCardBackImageUrl } from "@/lib/card-images";
import {
  clearStoredCart,
  readStoredCart,
  writeStoredCart
} from "@/lib/cart-storage";
import { buylist } from "@/lib/mock-data";
import { formatCurrency, formatStock } from "@/lib/format";
import type { ScannedCardResult } from "@/lib/scanner/scryfall";
import type { FilterGame, SortMode, StoreUser, TcgCard } from "@/lib/types";
import { sealedTypeLabel, isSealedProduct } from "@/lib/sealed";
import type { ShippingQuote } from "@/lib/shipping";

type CartLine = {
  card: TcgCard;
  quantity: number;
};

type CheckoutStep = "items" | "shipping" | "pay";

const games: FilterGame[] = ["Todos", "Magic", "Yu-Gi-Oh!", "Pokemon"];
const orderInitialState = { ok: false, message: "", checkoutUrl: null as string | null };

const conditionColors: Record<string, string> = {
  NM: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  SP: "bg-amber-50 text-amber-700 border border-amber-200",
  MP: "bg-orange-50 text-orange-700 border border-orange-200",
  HP: "bg-rose-50 text-rose-700 border border-rose-200"
};

const conditionLabels: Record<string, string> = {
  NM: "Near Mint",
  SP: "Slightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played"
};

export function Storefront({
  cards,
  sealedProducts = [],
  currentUser,
  initialQuery = "",
  initialGame = "Todos",
  initialSort = "relevance"
}: {
  cards: TcgCard[];
  sealedProducts?: TcgCard[];
  currentUser: StoreUser | null;
  initialQuery?: string;
  initialGame?: FilterGame;
  initialSort?: SortMode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [game, setGame] = useState<FilterGame>(initialGame);
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string>("pickup");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("items");
  const [activeSection, setActiveSection] = useState<"catalogo" | "selados" | "venda" | "conta">(
    "catalogo"
  );
  const [scannerOpen, setScannerOpen] = useState(false);
  const [orderState, orderFormAction, orderPending] = useActionState(
    createOrderAction,
    orderInitialState
  );

  const catalogInventory = useMemo(
    () => [...cards, ...sealedProducts],
    [cards, sealedProducts]
  );

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = cards.filter((card) => {
      const isAvailable = card.stock > 0;
      const matchesGame = game === "Todos" || card.game === game;
      const matchesQuery =
        normalized.length === 0 ||
        [card.name, card.setName, card.rarity, card.game, ...card.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return isAvailable && matchesGame && matchesQuery;
    });

    return [...visible].sort((a, b) => {
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      return b.marketPriceCents - b.priceCents - (a.marketPriceCents - a.priceCents);
    });
  }, [cards, game, query, sort]);

  const filteredSealed = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = sealedProducts.filter((card) => {
      const isAvailable = card.stock > 0;
      const matchesGame = game === "Todos" || card.game === game;
      const matchesQuery =
        normalized.length === 0 ||
        [
          card.name,
          card.setName,
          card.rarity,
          card.game,
          card.sealedType ?? "",
          ...card.tags
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return isAvailable && matchesGame && matchesQuery;
    });

    return [...visible].sort((a, b) => {
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      return b.marketPriceCents - b.priceCents - (a.marketPriceCents - a.priceCents);
    });
  }, [sealedProducts, game, query, sort]);

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce(
    (sum, line) => sum + line.card.priceCents * line.quantity,
    0
  );
  const selectedShipping =
    shippingQuotes.find((quote) => quote.id === selectedShippingId) ??
    shippingQuotes.find((quote) => quote.id === "pickup") ??
    null;
  const shippingCents = selectedShipping?.priceCents ?? 0;
  const total = subtotal + shippingCents;
  const cartPayload = JSON.stringify(
    cart.map((line) => ({ cardId: line.card.id, quantity: line.quantity }))
  );

  useEffect(() => {
    setQuery(initialQuery);
    setGame(initialGame);
    setSort(initialSort);
  }, [initialQuery, initialGame, initialSort]);

  useEffect(() => {
    try {
      const saved = readStoredCart();
      const restored = saved
        .map((line) => {
          const card = catalogInventory.find((item) => item.id === line.cardId);
          if (!card || card.stock <= 0) return null;
          return {
            card,
            quantity: Math.max(1, Math.min(line.quantity, card.stock))
          };
        })
        .filter((line): line is CartLine => Boolean(line));
      setCart(restored);
    } catch {
      // ignore corrupt storage
    } finally {
      setCartHydrated(true);
    }

    try {
      if (sessionStorage.getItem("mana-draw-open-cart") === "1") {
        sessionStorage.removeItem("mana-draw-open-cart");
        setCartOpen(true);
        setCheckoutStep("items");
      }
    } catch {
      // ignore
    }
  }, [catalogInventory]);

  useEffect(() => {
    if (!cartHydrated) return;
    writeStoredCart(cart.map((line) => ({ cardId: line.card.id, quantity: line.quantity })));
  }, [cart, cartHydrated]);

  useEffect(() => {
    if (orderState.ok && orderState.checkoutUrl) {
      setCart([]);
      clearStoredCart();
      window.location.href = orderState.checkoutUrl;
      return;
    }
    if (orderState.ok) {
      setCart([]);
      clearStoredCart();
    }
  }, [orderState.ok, orderState.checkoutUrl]);

  useEffect(() => {
    if (!cartOpen) return;
    if (cart.length === 0) {
      setCheckoutStep("items");
      return;
    }
    if (checkoutStep === "pay" && !currentUser) {
      setCheckoutStep("shipping");
    }
  }, [cartOpen, cart.length, checkoutStep, currentUser]);

  useEffect(() => {
    setShippingQuotes([
      {
        id: "pickup",
        company: "Mana Draw",
        service: "Retirada na loja",
        priceCents: 0,
        days: 0,
        currency: "BRL",
        kind: "pickup"
      }
    ]);
    setSelectedShippingId("pickup");
  }, []);

  async function fetchShippingQuotes() {
    const digits = postalCode.replace(/\D/g, "");
    if (digits.length !== 8) {
      setShippingError("Informe um CEP com 8 dígitos.");
      return;
    }
    if (cartCount === 0) {
      setShippingError("Adicione itens ao carrinho.");
      return;
    }

    setShippingLoading(true);
    setShippingError(null);
    try {
      const response = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: digits,
          itemCount: cartCount,
          insuranceCents: subtotal
        })
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        quotes?: ShippingQuote[];
      };
      if (!response.ok || !payload.ok || !payload.quotes?.length) {
        throw new Error(payload.message || "Não foi possível cotar o frete.");
      }
      setShippingQuotes(payload.quotes);
      setSelectedShippingId(
        payload.quotes.some((quote) => quote.id === selectedShippingId)
          ? selectedShippingId
          : payload.quotes[0].id
      );
    } catch (error) {
      setShippingError(error instanceof Error ? error.message : "Falha ao cotar frete.");
    } finally {
      setShippingLoading(false);
    }
  }

  useEffect(() => {
    const locked = cartOpen || authOpen;
    if (!locked) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (authOpen) setAuthOpen(false);
      else setCartOpen(false);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen, authOpen]);

  useEffect(() => {
    if (!addedToast) return;
    const timer = window.setTimeout(() => setAddedToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [addedToast]);

  useEffect(() => {
    const sectionIds = ["catalogo", "selados", "venda"] as const;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        const ranked = [...ratios.entries()].sort((a, b) => b[1] - a[1]);
        const top = ranked[0]?.[0];
        if (top === "catalogo" || top === "selados" || top === "venda") {
          setActiveSection(top);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55]
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function addToCart(card: TcgCard) {
    if (card.stock <= 0) return;

    setCart((current) => {
      const existing = current.find((line) => line.card.id === card.id);
      if (!existing) return [...current, { card, quantity: 1 }];
      return current.map((line) =>
        line.card.id === card.id
          ? { ...line, quantity: Math.min(line.quantity + 1, card.stock) }
          : line
      );
    });
    setAddedToast(card.name);
  }

  function updateQuantity(cardId: string, quantity: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.card.id === cardId
            ? { ...line, quantity: Math.max(0, Math.min(quantity, line.card.stock)) }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  function syncCatalogUrl(next: {
    query?: string;
    game?: FilterGame;
    sort?: SortMode;
  }) {
    const nextQuery = next.query ?? query;
    const nextGame = next.game ?? game;
    const nextSort = next.sort ?? sort;
    setQuery(nextQuery);
    setGame(nextGame);
    setSort(nextSort);

    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextGame !== "Todos") params.set("game", nextGame);
    if (nextSort !== "relevance") params.set("sort", nextSort);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  function clearCatalogFilters() {
    syncCatalogUrl({ query: "", game: "Todos", sort: "relevance" });
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Mana Draw">
            <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(15,159,144,0.28)]">
              MD
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide text-[var(--ink)]">Mana Draw</span>
              <span className="block text-xs text-[var(--muted)]">TCG market</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
            <a className="transition hover:text-[var(--ink)]" href="#catalogo">
              Singles
            </a>
            <a className="transition hover:text-[var(--ink)]" href="#selados">
              Selados
            </a>
            <Link className="transition hover:text-[var(--ink)]" href="/analisar-deck">
              Analisar deck
            </Link>
            <a className="transition hover:text-[var(--ink)]" href="#venda">
              Venda suas cartas
            </a>
            <a className="transition hover:text-[var(--ink)]" href="#operacao">
              Operação
            </a>
            <Link className="transition hover:text-[var(--ink)]" href="/conta">
              Histórico
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                {currentUser.role === "admin" && (
                  <Link
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[#0b1220] px-3 text-sm font-semibold text-teal-300 transition hover:bg-slate-900"
                    href="/admin"
                    title="Console operacional"
                  >
                    <LayoutDashboard size={16} />
                    <span className="hidden sm:inline">Console OPS</span>
                    <span className="sm:hidden">OPS</span>
                  </Link>
                )}
                <Link
                  className="hidden h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:inline-flex"
                  href="/conta"
                >
                  <UserRound size={16} />
                  Conta
                </Link>
                <form action={logoutAction} className="hidden sm:block">
                  <button
                    className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
                    type="submit"
                    aria-label="Sair"
                  >
                    <LogOut size={17} />
                  </button>
                </form>
              </>
            ) : (
              <button
                className="hidden h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:inline-flex"
                type="button"
                onClick={() => setAuthOpen(true)}
              >
                <UserRound size={16} />
                Entrar
              </button>
            )}
            <button
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-500/40 bg-emerald-950/10 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-950/20 sm:text-sm"
              type="button"
              onClick={() => setScannerOpen(true)}
              title="Escanear carta MTG pela câmera do celular"
            >
              <Camera size={16} className="text-emerald-600" />
              <span className="hidden sm:inline">Scanner MTG</span>
            </button>
            <button
              className="relative hidden h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)] md:grid"
              type="button"
              aria-label="Abrir carrinho"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[var(--background)] bg-[var(--gold)] px-1 text-[11px] font-bold text-[#1a1205] animate-badge-pop">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile floating dock */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 px-3 md:hidden ${
          cartOpen || authOpen ? "pointer-events-none opacity-0 translate-y-3" : "opacity-100 translate-y-0"
        } transition-all duration-300 ease-out`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal"
      >
        <div className="mobile-dock animate-dock-in mx-auto grid h-[3.75rem] max-w-md grid-cols-5 items-center rounded-[var(--radius-sheet)] border border-[var(--line)] bg-white/95 px-1 backdrop-blur-2xl">
          <a
            href="#catalogo"
            aria-current={activeSection === "catalogo" ? "page" : undefined}
            className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[10px] font-semibold transition-all duration-200 active:scale-95 ${
              activeSection === "catalogo"
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <LayoutGrid size={20} strokeWidth={activeSection === "catalogo" ? 2.25 : 1.75} />
            <span>Catálogo</span>
            {activeSection === "catalogo" && (
              <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-[var(--accent)]" />
            )}
          </a>

          <a
            href="#venda"
            aria-current={activeSection === "venda" ? "page" : undefined}
            className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[10px] font-semibold transition-all duration-200 active:scale-95 ${
              activeSection === "venda"
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Camera size={20} strokeWidth={activeSection === "venda" ? 2.25 : 1.75} />
            <span>Vender</span>
            {activeSection === "venda" && (
              <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-[var(--accent)]" />
            )}
          </a>

          <div className="relative flex items-center justify-center">
            <button
              type="button"
              aria-label={`Abrir carrinho${cartCount > 0 ? `, ${cartCount} itens` : ""}`}
              onClick={() => setCartOpen(true)}
              className="relative -mt-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.05rem] bg-[var(--accent)] text-white transition-transform duration-200 mobile-dock-cart active:scale-95 hover:bg-[var(--accent-strong)]"
            >
              <ShoppingBag size={22} strokeWidth={2} />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[var(--surface)] bg-[var(--gold)] px-1 text-[10px] font-bold text-[#1a1205] animate-badge-pop"
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <Link
            href="/analisar-deck"
            className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[10px] font-semibold text-[var(--muted)] transition-all duration-200 hover:text-[var(--ink)] active:scale-95"
          >
            <Swords size={20} strokeWidth={1.75} />
            <span>Deck</span>
          </Link>

          {currentUser ? (
            currentUser.role === "admin" ? (
              <Link
                href="/admin"
                className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[10px] font-semibold text-[#0b1220] transition-all duration-200 active:scale-95"
              >
                <LayoutDashboard size={20} strokeWidth={2.1} />
                <span>OPS</span>
              </Link>
            ) : (
              <Link
                href="/conta"
                className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[10px] font-semibold text-[var(--muted)] transition-all duration-200 hover:text-[var(--ink)] active:scale-95"
              >
                <UserRound size={20} strokeWidth={1.75} />
                <span className="max-w-[3.25rem] truncate">Conta</span>
              </Link>
            )
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[10px] font-semibold text-[var(--muted)] transition-all duration-200 hover:text-[var(--ink)] active:scale-95"
            >
              <UserRound size={20} strokeWidth={1.75} />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </nav>

      <HeroGameShowcase />
      <TrustStrip />

      <section id="catalogo" className="border-b border-[var(--line)] bg-[var(--surface)]/40 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-10">
          <div className="min-w-0">
            <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
                  Catálogo de singles
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Cartas avulsas — filtre por jogo, busque por nome ou coleção e adicione ao carrinho.
                </p>
              </div>
              <form
                className="surface-card grid grid-cols-[1fr_92px] gap-2 p-2 sm:grid-cols-[minmax(220px,1fr)_180px_96px] xl:min-w-[620px]"
                method="get"
                action="/"
              >
                <input type="hidden" name="game" value={game} />
                <label className="relative col-span-2 block sm:col-span-1">
                  <span className="sr-only">Buscar cartas</span>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  <input
                    className="field-input h-11 w-full rounded-[var(--radius-control)] pl-10 pr-10 text-sm"
                    name="q"
                    placeholder="Buscar por nome, coleção ou tag"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    title="Escanear carta MTG pela câmera do celular"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--muted)] hover:text-emerald-600 hover:bg-emerald-950/10 rounded-md transition"
                  >
                    <Camera size={18} />
                  </button>
                </label>
                <label className="relative block">
                  <span className="sr-only">Ordenar</span>
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  <select
                    className="field-input h-11 w-full appearance-none rounded-[var(--radius-control)] pl-10 pr-3 text-sm"
                    name="sort"
                    value={sort}
                    onChange={(event) => syncCatalogUrl({ sort: event.target.value as SortMode })}
                  >
                    <option value="relevance">Maior desconto</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                  </select>
                </label>
                <button
                  className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95"
                  type="submit"
                >
                  Buscar
                </button>
              </form>
            </div>

            <div className="sticky top-[var(--nav-height)] z-30 -mx-4 mb-5 flex items-center gap-2 overflow-x-auto border-y border-[var(--line)] bg-[var(--background)]/95 px-4 py-2.5 backdrop-blur-xl scrollbar-none snap-x snap-mandatory sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-1">
              <span className="inline-flex shrink-0 items-center gap-2 pr-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <Filter size={14} />
                Jogos
              </span>
              {games.map((item) => (
                <button
                  key={item}
                  className={`chip focus-ring h-9 shrink-0 snap-start px-3.5 text-sm active:scale-95 ${
                    game === item ? "chip-active" : "text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
                  }`}
                  type="button"
                  onClick={() => syncCatalogUrl({ game: item })}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCards.map((card) => (
                <article
                  key={card.id}
                  className="surface-card grid grid-cols-[92px_1fr] gap-3 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:shadow-[var(--shadow-lift)] active:scale-[0.995] sm:grid-cols-[116px_1fr] sm:gap-4 sm:p-3.5"
                >
                  <CardThumb
                    card={card}
                    sizes="(min-width: 640px) 116px, 92px"
                    onAddToCart={addToCart}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/carta/${card.id}`}
                            className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
                            title={card.name}
                          >
                            {card.name}
                          </Link>
                          <p className="truncate text-xs text-[var(--muted)]" title={card.setName}>
                            {card.setName}
                          </p>
                        </div>
                        <span
                          title={conditionLabels[card.condition] || card.condition}
                          aria-label={conditionLabels[card.condition] || card.condition}
                          className={`shrink-0 rounded-[0.45rem] px-2 py-1 text-[10px] font-bold tracking-wider ${
                            conditionColors[card.condition] || "border border-[var(--line)] bg-[var(--surface-hover)] text-[var(--muted)]"
                          }`}
                        >
                          {card.condition}
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-1">
                        <span className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                          {card.game}
                        </span>
                        <span className="hidden rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] text-[var(--muted)] sm:inline">
                          {card.finish}
                        </span>
                        <span className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                          {card.language}
                        </span>
                      </div>
                    </div>
                    <div>
                      <ProductPrice
                        priceCents={card.priceCents}
                        marketPriceCents={card.marketPriceCents}
                        size="md"
                      />
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{formatStock(card.stock)}</p>
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:mt-3">
                        <button
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--muted)]"
                          type="button"
                          disabled={card.stock <= 0}
                          onClick={() => addToCart(card)}
                        >
                          <ShoppingBag size={14} />
                          Adicionar
                        </button>
                        <Link
                          href={`/carta/${card.id}`}
                          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
                          aria-label={`Ver ${card.name}`}
                        >
                          Ver
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {filteredCards.length === 0 && (
                <div className="surface-card border-dashed p-8 text-center sm:col-span-2 xl:col-span-3">
                  <p className="text-sm font-semibold text-[var(--ink)]">Nenhuma carta encontrada</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Tente outro nome, coleção ou jogo.
                  </p>
                  <button
                    type="button"
                    onClick={clearCatalogFilters}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </div>

          <WeeklyDropPanel cards={cards.slice(0, 4)} onAddToCart={addToCart} />
        </div>
      </section>

      <section id="selados" className="border-b border-[var(--line)] bg-[var(--surface-soft)]/50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-sm font-semibold text-[var(--accent)]">Produtos selados</p>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
                Boxes, ETBs, tins e decks
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                Magic, Pokémon e Yu-Gi-Oh! — produtos fechados prontos para envio.
              </p>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {filteredSealed.length}{" "}
              {filteredSealed.length === 1 ? "produto" : "produtos"}
            </p>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSealed.map((product) => (
              <article
                key={product.id}
                className="surface-card grid grid-cols-[104px_1fr] gap-3 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:shadow-[var(--shadow-lift)] active:scale-[0.995] sm:grid-cols-[128px_1fr] sm:gap-4 sm:p-3.5"
              >
                <SealedThumb
                  product={product}
                  sizes="(min-width: 640px) 128px, 104px"
                  onAddToCart={addToCart}
                />
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/carta/${product.id}`}
                          className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition hover:text-[var(--accent-strong)]"
                          title={product.name}
                        >
                          {product.name}
                        </Link>
                        <p className="truncate text-xs text-[var(--muted)]" title={product.setName}>
                          {product.setName}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-[0.45rem] border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-bold tracking-wide text-[var(--accent)]">
                        Selado
                      </span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      <span className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                        {product.game}
                      </span>
                      <span className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                        {sealedTypeLabel(product.game, product.sealedType)}
                      </span>
                      <span className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]">
                        {product.language}
                      </span>
                    </div>
                  </div>
                  <div>
                    <ProductPrice
                      priceCents={product.priceCents}
                      marketPriceCents={product.marketPriceCents}
                      size="md"
                    />
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{formatStock(product.stock)}</p>
                    <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:mt-3">
                      <button
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--muted)]"
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => addToCart(product)}
                      >
                        <ShoppingBag size={14} />
                        Adicionar
                      </button>
                      <Link
                        href={`/carta/${product.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
                        aria-label={`Ver ${product.name}`}
                      >
                        Ver
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {filteredSealed.length === 0 && (
              <div className="surface-card border-dashed p-8 text-center sm:col-span-2 xl:col-span-3">
                <p className="text-sm font-semibold text-[var(--ink)]">Nenhum produto selado encontrado</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Tente outro nome, coleção ou jogo — ou limpe os filtros.
                </p>
                <button
                  type="button"
                  onClick={clearCatalogFilters}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="venda" className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--accent)]">Buylist</p>
          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            Venda cartas paradas por crédito ou Pix.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-[var(--muted)]">
            Envie fotos do lote, receba uma cotação por condição e escolha como receber.
          </p>
          <div className="mt-8 space-y-5">
            {[
              ["Triagem visual", "Fotos ou planilha com nomes, edições e condições."],
              ["Cotação objetiva", "Mercado, liquidez e raridade em uma proposta clara."],
              ["Pagamento flexível", "Pix, crédito na loja ou combinação dos dois."]
            ].map(([title, copy], index) => (
              <div key={title} className="flex gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[0.55rem] bg-[var(--accent)] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Estimativas por jogo</p>
              <p className="text-xs text-[var(--muted)]">Valores de referência para cotação rápida.</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {buylist.map((item) => (
                <div key={item.game} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{item.game}</p>
                    <p className="truncate font-semibold text-[var(--ink)]">{item.title}</p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">{item.estimate}</p>
                  </div>
                  <span className="shrink-0 rounded-[var(--radius-control)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]">
                    {item.turnaround}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <BuylistForm
            defaultEmail={currentUser?.email ?? ""}
            defaultName={currentUser?.name ?? ""}
          />
        </div>
      </section>

      <section id="operacao" className="border-y border-[var(--line)] bg-[var(--surface)]/70">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Como a loja opera</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Condição auditada, estoque real e checkout preparado para Pix e cartão.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
            {[
              [ShieldCheck, "Condição auditada", "NM, SP, MP e HP com padrão fotografável."],
              [Truck, "Envio rastreado", "Pronto para frete e retirada local."],
              [CreditCard, "Checkout direto", "Carrinho preparado para Pix e cartão."],
              [Boxes, "Estoque real", "Catálogo atualizado com o estoque disponível."]
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="flex gap-3 md:flex-col md:gap-0">
                <Icon size={22} className="mt-0.5 shrink-0 text-[var(--accent)] md:mb-3 md:mt-0" />
                <div>
                  <p className="font-semibold text-[var(--ink)]">{String(title)}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{String(copy)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-4 border-t border-[var(--line)] px-4 py-10 pb-6 text-sm text-[var(--muted)] sm:px-6 md:flex-row md:pb-10 lg:px-8">
        <div>
          <p className="text-base font-semibold text-[var(--ink)]">Mana Draw</p>
          <p className="mt-1">Marketplace TCG · comprar e vender singles</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a className="transition hover:text-[var(--ink)]" href="#catalogo">Singles</a>
          <a className="transition hover:text-[var(--ink)]" href="#selados">Selados</a>
          <Link className="transition hover:text-[var(--ink)]" href="/analisar-deck">Analisar deck</Link>
          <a className="transition hover:text-[var(--ink)]" href="#venda">Buylist</a>
          <a className="transition hover:text-[var(--ink)]" href="#operacao">Operação</a>
          <Link className="transition hover:text-[var(--ink)]" href="/conta">Conta</Link>
        </div>
      </footer>

      {addedToast ? (
        <div
          role="status"
          className="fixed bottom-[calc(var(--nav-height)+1rem)] left-1/2 z-[70] flex w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-lift)] animate-fade-in md:bottom-6"
        >
          <p className="min-w-0 truncate text-sm text-[var(--ink)]">
            <span className="font-semibold">Adicionado:</span> {addedToast}
          </p>
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-[var(--accent)]"
            onClick={() => {
              setAddedToast(null);
              setCheckoutStep("items");
              setCartOpen(true);
            }}
          >
            Ver carrinho
          </button>
        </div>
      ) : null}

      {cartOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <button
            className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-sm"
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setCartOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Carrinho"
            className="fixed bottom-0 right-0 z-50 flex h-[min(86vh,720px)] w-full flex-col rounded-t-[var(--radius-sheet)] border-t border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lift)] transition-all duration-300 animate-slide-up md:absolute md:top-0 md:h-full md:max-w-md md:rounded-t-none md:border-l md:border-t-0 md:animate-fade-in"
          >
            <div className="mx-auto my-2.5 h-1 w-12 shrink-0 rounded-full bg-slate-300 md:hidden" />

            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 pb-4 pt-1 md:p-4">
              <div>
                <p className="font-semibold tracking-tight text-[var(--ink)]">Carrinho</p>
                <p className="text-xs text-[var(--muted)]">
                  {cartCount === 0
                    ? "Nenhum item ainda"
                    : `${cartCount} ${cartCount === 1 ? "item" : "itens"} · checkout em 3 passos`}
                </p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
                type="button"
                aria-label="Fechar carrinho"
                onClick={() => setCartOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {cart.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 border-b border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2.5">
                {(
                  [
                    ["items", "1 · Itens"],
                    ["shipping", "2 · Frete"],
                    ["pay", "3 · Pagar"]
                  ] as const
                ).map(([step, label]) => {
                  const active = checkoutStep === step;
                  const done =
                    (step === "items" && (checkoutStep === "shipping" || checkoutStep === "pay")) ||
                    (step === "shipping" && checkoutStep === "pay");
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => {
                        if (step === "pay" && !currentUser) {
                          setCheckoutStep("shipping");
                          return;
                        }
                        setCheckoutStep(step);
                      }}
                      className={`rounded-[0.55rem] px-2 py-2 text-[11px] font-semibold transition ${
                        active
                          ? "bg-[var(--accent)] text-white shadow-sm"
                          : done
                            ? "bg-white text-[var(--accent-strong)]"
                            : "text-[var(--muted)] hover:bg-white/70"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="flex-1 overflow-auto p-4 scrollbar-none">
              {cart.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-[var(--radius-card)] bg-[var(--surface-soft)] text-[var(--muted)]">
                      <PackageCheck size={28} />
                    </span>
                    <p className="font-semibold text-[var(--ink)]">Seu carrinho está vazio</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Adicione singles ou selados do catálogo.</p>
                    <button
                      type="button"
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                      onClick={() => setCartOpen(false)}
                    >
                      Continuar comprando
                    </button>
                  </div>
                </div>
              ) : checkoutStep === "items" ? (
                <div className="grid gap-3">
                  {cart.map((line) => (
                    <div
                      key={line.card.id}
                      className="grid grid-cols-[64px_1fr] gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] p-3"
                    >
                      <Link
                        href={`/carta/${line.card.id}`}
                        className="relative aspect-[5/7] overflow-hidden rounded-[0.45rem] bg-slate-100"
                        onClick={() => setCartOpen(false)}
                      >
                        <Image
                          src={line.card.imageUrl}
                          alt={line.card.name}
                          fill
                          unoptimized
                          sizes="64px"
                          className="object-cover"
                        />
                      </Link>
                      <div>
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/carta/${line.card.id}`}
                              className="truncate text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent-strong)]"
                              onClick={() => setCartOpen(false)}
                            >
                              {line.card.name}
                            </Link>
                            <p className="truncate text-xs text-[var(--muted)]">
                              {line.card.productKind === "sealed"
                                ? `${line.card.game} · Selado`
                                : `${line.card.game} · ${line.card.condition}`}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            {formatCurrency(line.card.priceCents * line.quantity)}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)]">
                            <button
                              className="grid h-8 w-8 place-items-center text-[var(--ink)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                              type="button"
                              aria-label="Diminuir quantidade"
                              onClick={() => updateQuantity(line.card.id, line.quantity - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="grid h-8 min-w-8 place-items-center text-sm font-medium text-[var(--ink)]">
                              {line.quantity}
                            </span>
                            <button
                              className="grid h-8 w-8 place-items-center text-[var(--ink)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
                              type="button"
                              aria-label="Aumentar quantidade"
                              disabled={line.quantity >= line.card.stock}
                              onClick={() => updateQuantity(line.card.id, line.quantity + 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            className="text-xs font-semibold text-[var(--muted)] transition hover:text-rose-600"
                            type="button"
                            onClick={() => updateQuantity(line.card.id, 0)}
                          >
                            Remover
                          </button>
                        </div>
                        {line.quantity >= line.card.stock ? (
                          <p className="mt-2 text-[11px] text-[var(--muted)]">Máx. {line.card.stock} em estoque</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : checkoutStep === "shipping" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">Entrega</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Retirada na loja é gratuita. Para envio, informe o CEP.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]" htmlFor="checkout-cep">
                      CEP de entrega
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="checkout-cep"
                        className="field-input h-11 flex-1 rounded-[var(--radius-control)] px-3 text-sm"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder="00000-000"
                        value={postalCode}
                        onChange={(event) => setPostalCode(event.target.value)}
                      />
                      <button
                        type="button"
                        className="h-11 shrink-0 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] disabled:opacity-45"
                        disabled={shippingLoading}
                        onClick={() => void fetchShippingQuotes()}
                      >
                        {shippingLoading ? "..." : "Calcular"}
                      </button>
                    </div>
                    {shippingError ? <p className="mt-1.5 text-xs text-rose-600">{shippingError}</p> : null}
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-[var(--ink)]">Opções de frete</legend>
                    {shippingQuotes.map((quote) => (
                      <label
                        key={quote.id}
                        className={`flex cursor-pointer items-start justify-between gap-3 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm transition ${
                          selectedShippingId === quote.id
                            ? "border-[var(--accent)] bg-[var(--accent)]/5"
                            : "border-[var(--line)] bg-[var(--surface-soft)]"
                        }`}
                      >
                        <span className="flex min-w-0 items-start gap-2">
                          <input
                            type="radio"
                            className="mt-1"
                            name="shippingQuote"
                            checked={selectedShippingId === quote.id}
                            onChange={() => setSelectedShippingId(quote.id)}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold text-[var(--ink)]">
                              {quote.company} · {quote.service}
                            </span>
                            <span className="block text-xs text-[var(--muted)]">
                              {quote.kind === "pickup"
                                ? "Sem frete · retire no local"
                                : quote.days != null
                                  ? `Até ${quote.days} dia(s) úteis`
                                  : "Prazo sob consulta"}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold text-[var(--ink)]">
                          {quote.priceCents === 0 ? "Grátis" : formatCurrency(quote.priceCents)}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                    <p className="text-sm font-semibold text-[var(--ink)]">Resumo</p>
                    <div className="mt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[var(--muted)]">{cartCount} item(ns)</span>
                        <span className="font-medium text-[var(--ink)]">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[var(--muted)]">
                          {selectedShipping?.service ?? "Frete"}
                        </span>
                        <span className="font-medium text-[var(--ink)]">
                          {shippingCents === 0 ? "Grátis" : formatCurrency(shippingCents)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-2">
                        <span className="font-semibold text-[var(--ink)]">Total</span>
                        <strong className="text-lg tracking-tight text-[var(--ink)]">
                          {formatCurrency(total)}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-card)] border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3 text-xs leading-5 text-[var(--ink)]">
                    <p className="font-semibold text-[var(--accent-strong)]">Pagamento seguro</p>
                    <p className="mt-1 text-[var(--muted)]">
                      Na próxima tela você paga com Pix ou cartão pelo Mercado Pago. Estoque reservado ao confirmar.
                    </p>
                  </div>
                  {!currentUser ? (
                    <p className="text-sm text-[var(--muted)]">
                      Entre na conta para finalizar — seu carrinho permanece nesta sessão.
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Logado como <span className="font-semibold text-[var(--ink)]">{currentUser.email}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--line)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {cart.length > 0 && checkoutStep !== "pay" ? (
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Total parcial</span>
                  <strong className="tracking-tight text-[var(--ink)]">{formatCurrency(total)}</strong>
                </div>
              ) : null}

              {cart.length === 0 ? null : checkoutStep === "items" ? (
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95"
                  onClick={() => setCheckoutStep("shipping")}
                >
                  Continuar para frete
                  <ChevronRight size={17} />
                </button>
              ) : checkoutStep === "shipping" ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:opacity-45"
                    disabled={!selectedShippingId}
                    onClick={() => {
                      if (!currentUser) {
                        setAuthOpen(true);
                        return;
                      }
                      setCheckoutStep("pay");
                    }}
                  >
                    {currentUser ? "Continuar para pagar" : "Entrar e continuar"}
                    <ChevronRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="h-10 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
                    onClick={() => setCheckoutStep("items")}
                  >
                    Voltar aos itens
                  </button>
                </div>
              ) : currentUser ? (
                <div className="grid gap-2">
                  <form action={orderFormAction}>
                    <input type="hidden" name="cart" value={cartPayload} />
                    <input type="hidden" name="postalCode" value={postalCode} />
                    <input type="hidden" name="shippingQuoteId" value={selectedShippingId} />
                    <button
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={cart.length === 0 || orderPending || !selectedShippingId}
                      type="submit"
                    >
                      <BadgeCheck size={17} />
                      {orderPending
                        ? "Preparando pagamento..."
                        : orderState.checkoutUrl
                          ? "Abrindo Mercado Pago..."
                          : "Pagar com Pix ou cartão"}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="h-10 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"
                    onClick={() => setCheckoutStep("shipping")}
                  >
                    Voltar ao frete
                  </button>
                </div>
              ) : (
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95"
                  type="button"
                  onClick={() => setAuthOpen(true)}
                >
                  <BadgeCheck size={17} />
                  Entrar e finalizar
                </button>
              )}
              {orderState.message && (
                <div className={`mt-3 text-sm ${orderState.ok ? "text-[var(--accent-strong)]" : "text-rose-600"}`}>
                  <p>{orderState.message}</p>
                  {orderState.ok && !orderState.checkoutUrl ? (
                    <Link href="/conta" className="mt-2 inline-flex font-semibold underline-offset-2 hover:underline">
                      Ver pedidos
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-[60] animate-fade-in">
          <button
            className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-sm"
            type="button"
            aria-label="Fechar autenticação"
            onClick={() => setAuthOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 w-full animate-slide-up md:left-1/2 md:top-1/2 md:bottom-auto md:w-[min(720px,calc(100vw-32px))] md:-translate-x-1/2 md:-translate-y-1/2 md:animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Conta Mana Draw"
              className="rounded-t-[var(--radius-sheet)] border border-[var(--line)] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] md:rounded-[var(--radius-card)] md:p-6 md:pb-6"
            >
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 md:hidden" />
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-[var(--ink)]">Conta Mana Draw</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Entre para finalizar pedidos e acompanhar seu histórico.
                  </p>
                </div>
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] transition hover:bg-[var(--surface-hover)]"
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setAuthOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
              <AuthPanel checkoutHint={cart.length > 0} />
              {process.env.NODE_ENV === "development" ? (
                <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                  Demo local: qualquer email como cliente, ou admin@manadraw.local / admin123.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <CardScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSelectForStore={(scanned) => {
          setScannerOpen(false);
          syncCatalogUrl({ query: scanned.name, game: "Magic" });
          const el = document.getElementById("catalogo");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        onSelectForBuylist={() => {
          setScannerOpen(false);
          const el = document.getElementById("venda");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />
    </main>
  );
}

const heroShowcase = [
  {
    game: "Magic",
    label: "Magic: The Gathering",
    imageUrl: "/hero/magic-liliana.jpg"
  },
  {
    game: "Pokémon",
    label: "Pokémon TCG",
    imageUrl: "/hero/pokemon.jpg"
  },
  {
    game: "Yu-Gi-Oh!",
    label: "Yu-Gi-Oh!",
    imageUrl: "/hero/yugioh.jpg"
  }
] as const;

function HeroGameShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;

    if (paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % heroShowcase.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Destaques por jogo"
    >
      <div className="relative aspect-[5/4] w-full sm:aspect-[16/9] lg:aspect-[21/9] lg:min-h-[420px]">
        {heroShowcase.map((item, index) => (
          <div
            key={item.game}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              index === active ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={index !== active}
          >
            <Image
              src={item.imageUrl}
              alt={item.label}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
        ))}

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/55 to-slate-950/20 sm:via-slate-950/45 sm:to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/50 to-transparent"
        />

        <div className="absolute inset-0 flex flex-col justify-end sm:justify-center">
          <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
            <div className="max-w-xl text-white">
              <p className="text-[2.35rem] font-semibold leading-none tracking-tight drop-shadow-sm sm:text-6xl">
                Mana Draw
              </p>
              <h1 className="mt-4 max-w-xl text-balance text-xl font-medium leading-snug text-white/95 sm:text-2xl">
                Compre singles. Venda sua coleção.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
                Marketplace TCG para Magic, Yu-Gi-Oh! e Pokémon — estoque pronto e cotação por foto.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5 sm:gap-3">
                <a
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-[0.98]"
                  href="#catalogo"
                >
                  Ver catálogo
                  <ChevronRight size={17} />
                </a>
                <a
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/35 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/18 active:scale-[0.98]"
                  href="#venda"
                >
                  Cotar coleção
                </a>
              </div>
              <p className="mt-4 text-xs font-medium tracking-wide text-white/70 sm:text-sm">
                Pix e cartão · frete rastreado · condição auditada
              </p>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2 sm:bottom-5">
          {heroShowcase.map((item, index) => (
            <button
              key={item.game}
              type="button"
              aria-label={`Mostrar ${item.game}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => setActive(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === active
                  ? "w-7 bg-white"
                  : "w-1.5 bg-white/45 hover:bg-white/75"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function WeeklyDropPanel({
  cards,
  onAddToCart
}: {
  cards: TcgCard[];
  onAddToCart?: (card: TcgCard) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <aside className="surface-card lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">Drop da semana</p>
          <p className="text-sm text-[var(--muted)]">Seleção rápida para comprar agora.</p>
        </div>
        <span className="rounded-[var(--radius-control)] bg-[var(--accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--accent)]">
          Destaques
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 bg-[var(--surface-soft)] p-4">
        {cards.map((card, index) => (
          <CardThumb
            key={card.id}
            card={card}
            priority={index === 0}
            sizes="(min-width: 1024px) 150px, 45vw"
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
      <div className="border-t border-[var(--line)] p-4">
        <a
          className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          href="#catalogo"
        >
          Ver cartas em destaque
        </a>
      </div>
    </aside>
  );
}


function SealedThumb({
  product,
  sizes,
  onAddToCart
}: {
  product: TcgCard;
  sizes: string;
  onAddToCart?: (card: TcgCard) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="relative aspect-square w-full shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] outline-none transition hover:border-[var(--accent)]/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        aria-label={`${product.name}. Toque para ver detalhes do produto selado.`}
        onClick={() => setDetailsOpen(true)}
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          unoptimized
          sizes={sizes}
          className="object-contain p-2"
        />
      </button>

      <CardDetailsModal
        card={product}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onAddToCart={
          onAddToCart
            ? (selected) => {
                onAddToCart(selected);
                setDetailsOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

function CardThumb({
  card,
  priority = false,
  sizes,
  onAddToCart
}: {
  card: TcgCard;
  priority?: boolean;
  sizes: string;
  onAddToCart?: (card: TcgCard) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const back = getCardBack(card.game);
  const secondFaceUrl = resolveCardBackImageUrl(card);
  const hasSecondFace = cardHasSecondFace(card);
  const flipBackUrl = secondFaceUrl ?? back.imageUrl;
  const sealed = isSealedProduct(card);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress() {
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setFlipped((current) => !current);
    }, 420);
  }

  return (
    <>
      <button
        type="button"
        className="group relative z-0 aspect-[5/7] w-full shrink-0 overflow-visible rounded-lg outline-none [perspective:1200px] hover:z-20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        aria-label={
          sealed
            ? `${card.name}. Toque para detalhes do produto selado.`
            : hasSecondFace
              ? `${card.name}. Toque para detalhes. Segure para ver a segunda face.`
              : `${card.name}. Toque para detalhes. Segure para ver o verso.`
        }
        onClick={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }
          if (sealed) {
            setDetailsOpen(true);
            return;
          }
          setDetailsOpen(true);
        }}
        onPointerDown={(event) => {
          if (sealed) return;
          if (event.pointerType === "touch" || event.pointerType === "pen") {
            startLongPress();
          }
        }}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className={`absolute inset-0 rounded-lg border border-slate-900/15 bg-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition duration-500 ease-out [transform-style:preserve-3d] ${
            sealed
              ? ""
              : "group-hover:[transform:rotateY(180deg)] group-focus-visible:[transform:rotateY(180deg)] group-hover:shadow-[0_8px_20px_rgba(15,23,42,0.14)]"
          } ${
            !sealed && flipped ? "[transform:rotateY(180deg)] shadow-[0_8px_20px_rgba(15,23,42,0.14)]" : ""
          }`}
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              unoptimized
              sizes={sizes}
              className={sealed ? "object-contain p-1.5" : "object-cover"}
              priority={priority}
            />
            {hasSecondFace && !sealed ? (
              <span className="absolute left-1.5 top-1.5 rounded bg-[var(--accent)]/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                2 faces
              </span>
            ) : null}
            {sealed ? (
              <span className="absolute left-1.5 top-1.5 rounded bg-[var(--accent)]/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                Selado
              </span>
            ) : null}
          </div>

          {!sealed ? (
            <div
              className={`absolute inset-0 overflow-hidden rounded-lg border [transform:rotateY(180deg)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${
                hasSecondFace ? "border-[var(--line)] bg-slate-100" : back.frame
              }`}
            >
              <Image
                src={flipBackUrl}
                alt={hasSecondFace ? `${card.name} segunda face` : `Verso de carta ${card.game}`}
                fill
                unoptimized
                sizes={sizes}
                className="object-cover"
              />
              {hasSecondFace ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-[var(--accent)]/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                  Face 2
                </span>
              ) : (
                <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_24px_rgba(0,0,0,0.35)]" />
              )}
            </div>
          ) : null}
        </div>
      </button>

      <CardDetailsModal
        card={card}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onAddToCart={
          onAddToCart
            ? (selected) => {
                onAddToCart(selected);
                setDetailsOpen(false);
              }
            : undefined
        }
      />
    </>
  );
}

function getCardBack(game: TcgCard["game"]) {
  if (game === "Magic") {
    return {
      frame: "border-black bg-black",
      imageUrl: "/card-backs/magic-back.png"
    };
  }

  if (game === "Pokemon") {
    return {
      frame: "border-black bg-black",
      imageUrl: "/card-backs/pokemon-back.png"
    };
  }

  return {
    frame: "border-black bg-black",
    imageUrl: "/card-backs/yugioh-back.png"
  };
}
