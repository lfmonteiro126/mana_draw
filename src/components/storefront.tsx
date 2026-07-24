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
import { useActionState, useEffect, useMemo, useState } from "react";
import { createOrderAction, logoutAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth-panel";
import { BuylistForm } from "@/components/buylist-form";
import { CardDetailsModal } from "@/components/card-details-modal";
import { cardHasSecondFace, resolveCardBackImageUrl } from "@/lib/card-images";
import { buylist } from "@/lib/mock-data";
import { formatCurrency, formatStock } from "@/lib/format";
import type { FilterGame, SortMode, StoreUser, TcgCard } from "@/lib/types";

type CartLine = {
  card: TcgCard;
  quantity: number;
};

const games: FilterGame[] = ["Todos", "Magic", "Yu-Gi-Oh!", "Pokemon"];
const orderInitialState = { ok: false, message: "" };

const conditionColors: Record<string, string> = {
  NM: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  SP: "bg-amber-50 text-amber-700 border border-amber-200",
  MP: "bg-orange-50 text-orange-700 border border-orange-200",
  HP: "bg-rose-50 text-rose-700 border border-rose-200"
};

export function Storefront({
  cards,
  currentUser,
  initialQuery = "",
  initialGame = "Todos",
  initialSort = "relevance"
}: {
  cards: TcgCard[];
  currentUser: StoreUser | null;
  initialQuery?: string;
  initialGame?: FilterGame;
  initialSort?: SortMode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [game, setGame] = useState<FilterGame>(initialGame);
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"catalogo" | "venda" | "conta">(
    "catalogo"
  );
  const [orderState, orderFormAction, orderPending] = useActionState(
    createOrderAction,
    orderInitialState
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

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce(
    (sum, line) => sum + line.card.priceCents * line.quantity,
    0
  );
  const cartPayload = JSON.stringify(
    cart.map((line) => ({ cardId: line.card.id, quantity: line.quantity }))
  );

  useEffect(() => {
    if (orderState.ok) setCart([]);
  }, [orderState.ok]);

  useEffect(() => {
    const locked = cartOpen || authOpen;
    if (!locked) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [cartOpen, authOpen]);

  useEffect(() => {
    const sectionIds = ["catalogo", "venda"] as const;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id === "catalogo" || visible[0]?.target.id === "venda") {
          setActiveSection(visible[0].target.id as "catalogo" | "venda");
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
    setCartOpen(true);
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
              Catálogo
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
                    className="hidden h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:inline-flex"
                    href="/admin"
                  >
                    <LayoutDashboard size={16} />
                    Admin
                  </Link>
                )}
                <Link
                  className="hidden h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:inline-flex"
                  href="/conta"
                >
                  <UserRound size={16} />
                  {currentUser.name}
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
        aria-label="Navegacao principal"
      >
        <div className="mobile-dock animate-dock-in mx-auto grid h-[3.75rem] max-w-md grid-cols-5 items-center rounded-2xl border border-[var(--line)] bg-white/95 px-1 backdrop-blur-2xl">
          <a
            href="#catalogo"
            aria-current={activeSection === "catalogo" ? "page" : undefined}
            className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-all duration-200 active:scale-95 ${
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
            className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-all duration-200 active:scale-95 ${
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
              className="relative -mt-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white transition-transform duration-200 mobile-dock-cart active:scale-95 hover:bg-[var(--accent-strong)]"
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
            className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold text-[var(--muted)] transition-all duration-200 hover:text-[var(--ink)] active:scale-95"
          >
            <Swords size={20} strokeWidth={1.75} />
            <span>Deck</span>
          </Link>

          {currentUser ? (
            <Link
              href="/conta"
              onClick={() => setActiveSection("conta")}
              aria-current={activeSection === "conta" ? "page" : undefined}
              className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-all duration-200 active:scale-95 ${
                activeSection === "conta"
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              <UserRound size={20} strokeWidth={activeSection === "conta" ? 2.25 : 1.75} />
              <span className="max-w-[3.25rem] truncate">{currentUser.name.split(" ")[0]}</span>
              {activeSection === "conta" && (
                <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold text-[var(--muted)] transition-all duration-200 hover:text-[var(--ink)] active:scale-95"
            >
              <UserRound size={20} strokeWidth={1.75} />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </nav>

      <section className="relative mx-auto max-w-7xl overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-[var(--accent)]/10 blur-3xl sm:h-72 sm:w-72"
        />
        <div className="relative max-w-2xl">
          <p className="text-[2.35rem] font-semibold leading-none tracking-tight text-[var(--ink)] sm:text-6xl">
            Mana Draw
          </p>
          <h1 className="mt-4 max-w-xl text-balance text-xl font-medium leading-snug text-[var(--ink)] sm:text-2xl">
            Compre singles. Venda sua coleção.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)] sm:text-base">
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
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-5 text-sm font-semibold text-[var(--ink)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-hover)] active:scale-[0.98]"
              href="#venda"
            >
              Cotar coleção
            </a>
          </div>
          <Link
            href="/analisar-deck"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
          >
            <Swords size={15} />
            Analisar deck Commander
          </Link>
        </div>
      </section>

      <section id="catalogo" className="border-y border-[var(--line)] bg-[var(--surface)]/40 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-10">
          <div className="min-w-0">
            <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
                  Catálogo de singles
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Filtre por jogo, busque por nome ou coleção e adicione ao carrinho.
                </p>
              </div>
              <form
                className="surface-card grid grid-cols-[1fr_92px] gap-2 p-2 sm:grid-cols-[minmax(220px,1fr)_180px_96px] xl:min-w-[620px]"
                method="get"
                action="/"
              >
                <input type="hidden" name="game" value={game} />
                <label className="relative col-span-2 block sm:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  <input
                    className="field-input h-11 w-full rounded-[var(--radius-control)] pl-10 pr-3 text-sm"
                    name="q"
                    placeholder="Buscar por nome, coleção ou tag"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="relative block">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  <select
                    className="field-input h-11 w-full appearance-none rounded-[var(--radius-control)] pl-10 pr-3 text-sm"
                    name="sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortMode)}
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

            <div className="sticky top-[65px] z-30 -mx-4 mb-5 flex items-center gap-2 overflow-x-auto border-y border-[var(--line)] bg-[var(--background)]/95 px-4 py-2.5 backdrop-blur-xl scrollbar-none snap-x snap-mandatory sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-1">
              <span className="inline-flex shrink-0 items-center gap-2 pr-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <Filter size={14} />
                Jogos
              </span>
              {games.map((item) => (
                <button
                  key={item}
                  className={`chip h-9 shrink-0 snap-start px-3.5 text-sm active:scale-95 ${
                    game === item ? "chip-active" : "text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
                  }`}
                  type="button"
                  onClick={() => setGame(item)}
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
                          <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]" title={card.name}>
                            {card.name}
                          </p>
                          <p className="truncate text-xs text-[var(--muted)]" title={card.setName}>
                            {card.setName}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-[0.45rem] px-2 py-1 text-[10px] font-bold tracking-wider ${
                            conditionColors[card.condition] || "border border-[var(--line)] bg-[var(--surface-hover)] text-[var(--muted)]"
                          }`}
                        >
                          {card.condition}
                        </span>
                      </div>
                      <div className="mb-2 hidden flex-wrap gap-1 sm:flex">
                        {[card.game, card.finish, card.language].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-[0.4rem] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xl font-semibold tracking-tight text-[var(--ink)]">
                        {formatCurrency(card.priceCents)}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">{formatStock(card.stock)}</p>
                      <button
                        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--muted)] sm:mt-3"
                        type="button"
                        disabled={card.stock <= 0}
                        onClick={() => addToCart(card)}
                      >
                        <ShoppingBag size={14} />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {filteredCards.length === 0 && (
                <div className="surface-card border-dashed p-8 text-center text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">
                  Nenhuma carta encontrada. Tente outro nome, coleção ou jogo.
                </div>
              )}
            </div>
          </div>

          <WeeklyDropPanel cards={cards.slice(0, 4)} onAddToCart={addToCart} />
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
          <BuylistForm />
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
              [Boxes, "Estoque real", "Neon como fonte única de produtos e pedidos."]
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
          <a className="transition hover:text-[var(--ink)]" href="#catalogo">Catálogo</a>
          <Link className="transition hover:text-[var(--ink)]" href="/analisar-deck">Analisar deck</Link>
          <a className="transition hover:text-[var(--ink)]" href="#venda">Buylist</a>
          <a className="transition hover:text-[var(--ink)]" href="#operacao">Operação</a>
        </div>
      </footer>

      {cartOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <button
            className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-sm"
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setCartOpen(false)}
          />
          <aside className="fixed bottom-0 right-0 z-50 flex h-[min(86vh,720px)] w-full flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl transition-all duration-300 md:absolute md:top-0 md:h-full md:max-w-md md:rounded-t-none animate-slide-up md:animate-fade-in border-t md:border-t-0 md:border-l border-[var(--line)]">
            {/* Handle do bottom sheet no mobile */}
            <div className="mx-auto my-2.5 h-1 w-12 rounded-full bg-slate-300 md:hidden shrink-0" />

            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 pb-4 pt-1 md:p-4">
              <div>
                <p className="font-semibold text-[var(--ink)]">Carrinho</p>
                <p className="text-xs text-[var(--muted)]">{cartCount} itens selecionados</p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                type="button"
                aria-label="Fechar carrinho"
                onClick={() => setCartOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 scrollbar-none">
              {cart.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <PackageCheck className="mx-auto mb-3 text-[var(--muted)]" size={34} />
                    <p className="font-semibold text-[var(--ink)]">Seu carrinho está vazio</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Adicione singles do catálogo.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {cart.map((line) => (
                    <div key={line.card.id} className="grid grid-cols-[64px_1fr] gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-hover)]/40 p-3">
                      <div className="relative aspect-[5/7] overflow-hidden rounded-md bg-slate-100">
                        <Image
                          src={line.card.imageUrl}
                          alt={line.card.name}
                          fill
                          unoptimized
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--ink)]">{line.card.name}</p>
                            <p className="truncate text-xs text-[var(--muted)]">{line.card.game} · {line.card.condition}</p>
                          </div>
                          <p className="text-sm font-semibold text-[var(--ink)]">{formatCurrency(line.card.priceCents * line.quantity)}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-md border border-[var(--line)] bg-[var(--surface)]">
                            <button
                              className="grid h-8 w-8 place-items-center text-[var(--ink)] hover:text-[var(--accent)]"
                              type="button"
                              aria-label="Diminuir quantidade"
                              onClick={() => updateQuantity(line.card.id, line.quantity - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="grid h-8 min-w-8 place-items-center text-sm text-[var(--ink)] font-medium">{line.quantity}</span>
                            <button
                              className="grid h-8 w-8 place-items-center text-[var(--ink)] hover:text-[var(--accent)]"
                              type="button"
                              aria-label="Aumentar quantidade"
                              onClick={() => updateQuantity(line.card.id, line.quantity + 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] transition"
                            type="button"
                            onClick={() => updateQuantity(line.card.id, 0)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--line)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Subtotal</span>
                <strong className="text-xl text-[var(--ink)]">{formatCurrency(subtotal)}</strong>
              </div>
              {currentUser ? (
                <form action={orderFormAction}>
                  <input type="hidden" name="cart" value={cartPayload} />
                  <button
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={cart.length === 0 || orderPending}
                    type="submit"
                  >
                    <BadgeCheck size={17} />
                    {orderPending ? "Criando pedido..." : "Finalizar compra"}
                  </button>
                </form>
              ) : (
                <button
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => setAuthOpen(true)}
                >
                  <BadgeCheck size={17} />
                  Entrar e finalizar
                </button>
              )}
              {orderState.message && (
                <p className={`mt-3 text-sm ${orderState.ok ? "text-[var(--accent-strong)]" : "text-rose-600"}`}>
                  {orderState.message}
                </p>
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
            aria-label="Fechar autenticacao"
            onClick={() => setAuthOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 w-full animate-slide-up md:left-1/2 md:top-1/2 md:bottom-auto md:w-[min(720px,calc(100vw-32px))] md:-translate-x-1/2 md:-translate-y-1/2 md:animate-fade-in">
            <div className="rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl md:rounded-lg md:pb-4">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 md:hidden" />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[var(--ink)]">Conta Mana Draw</p>
                  <p className="text-sm text-[var(--muted)]">
                    Entre para finalizar pedidos e acompanhar seu historico.
                  </p>
                </div>
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)]"
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setAuthOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
              <AuthPanel />
              <p className="mt-3 text-xs text-[var(--muted)]">
                Sem Neon configurado: use qualquer email para cliente ou admin@manadraw.local com senha admin123.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
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
          -12%
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
  const back = getCardBack(card.game);
  const secondFaceUrl = resolveCardBackImageUrl(card);
  const hasSecondFace = cardHasSecondFace(card);
  const flipBackUrl = secondFaceUrl ?? back.imageUrl;

  return (
    <>
      <button
        type="button"
        className="group relative z-0 aspect-[5/7] w-full shrink-0 overflow-visible rounded-lg outline-none [perspective:1200px] hover:z-20 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
        aria-label={
          hasSecondFace
            ? `${card.name}. Passe o mouse para ver a segunda face. Clique para ver detalhes.`
            : `${card.name}. Passe o mouse para ver o verso. Clique para ver detalhes.`
        }
        onClick={() => setDetailsOpen(true)}
      >
        <div className="absolute inset-0 rounded-lg border border-slate-900/15 bg-slate-200 shadow-[0_2px_8px_rgba(15,23,42,0.08)] transition duration-500 ease-out [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-visible:[transform:rotateY(180deg)] group-hover:shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
          <div className="absolute inset-0 overflow-hidden rounded-lg [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
            <Image
              src={card.imageUrl}
              alt={card.name}
              fill
              unoptimized
              sizes={sizes}
              className="object-cover"
              priority={priority}
            />
            {hasSecondFace ? (
              <span className="absolute left-1.5 top-1.5 rounded bg-[var(--accent)]/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                2 faces
              </span>
            ) : null}
          </div>

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
