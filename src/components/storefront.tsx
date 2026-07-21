"use client";

import {
  ArrowUpDown,
  BadgeCheck,
  Boxes,
  Camera,
  Check,
  ChevronRight,
  CreditCard,
  Filter,
  LayoutDashboard,
  LogOut,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRound,
  X
} from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createOrderAction, logoutAction } from "@/app/actions";
import { AuthPanel } from "@/components/auth-panel";
import { BuylistForm } from "@/components/buylist-form";
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
  NM: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  SP: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  MP: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  HP: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
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
  const [orderState, orderFormAction, orderPending] = useActionState(
    createOrderAction,
    orderInitialState
  );

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = cards.filter((card) => {
      const matchesGame = game === "Todos" || card.game === game;
      const matchesQuery =
        normalized.length === 0 ||
        [card.name, card.setName, card.rarity, card.game, ...card.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesGame && matchesQuery;
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

  function addToCart(card: TcgCard) {
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
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="Mana Draw">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white">
              NM
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">Mana Draw</span>
              <span className="block text-xs text-[var(--muted)]">TCG market</span>
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
            <a className="transition hover:text-[var(--ink)]" href="#catalogo">
              Catalogo
            </a>
            <a className="transition hover:text-[var(--ink)]" href="#venda">
              Venda suas cartas
            </a>
            <a className="transition hover:text-[var(--ink)]" href="#operacao">
              Operacao
            </a>
            <a className="transition hover:text-[var(--ink)]" href="/conta">
              Historico
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                {currentUser.role === "admin" && (
                  <a
                    className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] sm:inline-flex"
                    href="/admin"
                  >
                    <LayoutDashboard size={16} />
                    Admin
                  </a>
                )}
                <a
                  className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] sm:inline-flex"
                  href="/conta"
                >
                  <UserRound size={16} />
                  {currentUser.name}
                </a>
                <form action={logoutAction} className="hidden sm:block">
                  <button
                    className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                    type="submit"
                    aria-label="Sair"
                  >
                    <LogOut size={17} />
                  </button>
                </form>
              </>
            ) : (
              <button
                className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] sm:inline-flex"
                type="button"
                onClick={() => setAuthOpen(true)}
              >
                <UserRound size={16} />
                Entrar
              </button>
            )}
            <button
              className="relative grid h-10 w-10 place-items-center rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition"
              type="button"
              aria-label="Abrir carrinho"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sticky Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--line)] bg-[var(--background)]/90 backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          <a href="#catalogo" className="flex flex-col items-center gap-1 text-[10px] font-medium text-[var(--muted)] hover:text-white transition active:scale-95">
            <ShoppingBag size={20} />
            <span>Catálogo</span>
          </a>
          <a href="#venda" className="flex flex-col items-center gap-1 text-[10px] font-medium text-[var(--muted)] hover:text-white transition active:scale-95">
            <Camera size={20} />
            <span>Vender</span>
          </a>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex flex-col items-center gap-1 text-[10px] font-medium text-[var(--muted)] hover:text-white transition active:scale-95"
          >
            <div className="relative">
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </div>
            <span>Carrinho</span>
          </button>
          {currentUser ? (
            <a href="/conta" className="flex flex-col items-center gap-1 text-[10px] font-medium text-[var(--muted)] hover:text-white transition active:scale-95">
              <UserRound size={20} />
              <span className="max-w-[64px] truncate">{currentUser.name.split(" ")[0]}</span>
            </a>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="flex flex-col items-center gap-1 text-[10px] font-medium text-[var(--muted)] hover:text-white transition active:scale-95"
            >
              <UserRound size={20} />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-start gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-8 lg:py-6">
        <div className="flex flex-col justify-center">
          <div className="mb-3 flex w-fit items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--muted)]">
            <Sparkles size={15} className="text-[var(--gold)]" />
            Loja TCG para comprar e vender cartas
          </div>
          <h1 className="max-w-3xl text-balance text-2xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">
            Compre singles. Venda sua colecao TCG.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Compre cartas para jogar agora ou envie fotos da sua colecao para cotacao.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              href="#catalogo"
            >
              Ver catalogo
              <ChevronRight size={17} />
            </a>
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
              href="#venda"
            >
              Cotar colecao
            </a>
          </div>
          <a className="mt-3 text-sm font-semibold text-[var(--accent)] sm:hidden" href="#venda">
            Tambem compramos cartas de player, bulk e colecoes
          </a>
          <div className="mt-4 hidden grid-cols-3 gap-2 sm:grid sm:gap-3">
            {[
              ["2.4k", "cartas em estoque"],
              ["3", "jogos curados"],
              ["24h", "para cotacoes"]
            ].map(([value, label]) => (
              <div key={label} className="border-l border-[var(--line)] pl-3 sm:pl-4">
                <strong className="block text-lg text-[var(--ink)] sm:text-2xl">{value}</strong>
                <span className="text-[11px] leading-4 text-[var(--muted)] sm:text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="hidden self-start rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--accent)]/15 text-[var(--accent)]">
              <Camera size={18} />
            </span>
            <div>
              <p className="font-semibold text-[var(--ink)]">Vendemos e compramos cartas</p>
              <p className="mt-1 hidden text-sm leading-5 text-[var(--muted)] sm:block">
                Tem cartas de player, bulk ou colecao parada? Envie fotos para avaliacao.
              </p>
            </div>
          </div>
          <a
            className="mt-3 inline-flex h-10 items-center justify-center rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
            href="#venda"
          >
            Quero vender cartas
          </a>
        </aside>
      </section>

      <section id="catalogo" className="border-y border-[var(--line)] bg-[var(--surface)]/30 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-8">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--accent)]">Catalogo</p>
                <h2 className="text-2xl font-semibold text-[var(--ink)]">Singles em destaque</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">Compre cartas avulsas direto do estoque.</p>
              </div>
              <form className="grid grid-cols-[1fr_92px] gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 sm:grid-cols-[minmax(220px,1fr)_180px_96px] xl:min-w-[620px]" method="get" action="/">
                <input type="hidden" name="game" value={game} />
                <label className="relative col-span-2 block sm:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  <input
                    className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/35 pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-700/10"
                    name="q"
                    placeholder="Buscar por nome, colecao ou tag"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="relative block">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                  <select
                    className="h-11 w-full appearance-none rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/35 pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-700/10"
                    name="sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortMode)}
                  >
                    <option value="relevance">Maior desconto</option>
                    <option value="price-asc">Menor preco</option>
                    <option value="price-desc">Maior preco</option>
                  </select>
                </label>
                <button className="h-11 rounded-md bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition active:scale-95" type="submit">
                  Buscar
                </button>
              </form>
            </div>

            <div className="sticky top-[65px] z-30 -mx-4 mb-4 flex items-center gap-2 overflow-x-auto border-y border-[var(--line)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur-xl scrollbar-none snap-x snap-mandatory sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-1">
              <span className="inline-flex items-center gap-2 pr-1 text-sm font-semibold text-[var(--muted)] shrink-0">
                <Filter size={16} />
                Jogos
              </span>
              {games.map((item) => (
                <button
                  key={item}
                  className={`h-11 rounded-full border px-5 text-sm font-semibold transition shrink-0 snap-start ${
                    game === item
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-lg shadow-teal-950/30"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-white hover:text-white"
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
                  className="grid grid-cols-[92px_1fr] gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-[116px_1fr] sm:gap-4"
                >
                  <CardFlip card={card} sizes="(min-width: 640px) 116px, 92px" />
                  <div className="min-w-0 flex flex-col justify-between flex-1">
                    <div>
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]" title={card.name}>{card.name}</p>
                          <p className="truncate text-xs text-[var(--muted)]" title={card.setName}>{card.setName}</p>
                        </div>
                        <span className={`rounded px-2 py-1 text-[10px] font-bold tracking-wider shrink-0 ${conditionColors[card.condition] || "bg-[var(--line)] text-[var(--muted)]"}`}>
                          {card.condition}
                        </span>
                      </div>
                      <div className="mb-2 hidden flex-wrap gap-1 sm:flex">
                        {[card.game, card.finish, card.language].map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-[var(--surface-hover)] border border-[var(--line)] px-1.5 py-0.5 text-[9px] text-[var(--muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-[var(--ink)]">{formatCurrency(card.priceCents)}</p>
                      <p className="text-xs text-[var(--muted)] truncate">
                        {formatStock(card.stock)}
                      </p>
                      <button
                        className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 sm:mt-3"
                        type="button"
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
                <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">
                  Nenhuma carta encontrada. Tente outro nome, colecao ou jogo.
                </div>
              )}
            </div>
          </div>

          <WeeklyDropPanel cards={cards.slice(0, 4)} />
        </div>
      </section>

      <section id="venda" className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-16">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--accent)]">Buylist</p>
          <h2 className="text-3xl font-semibold text-[var(--ink)]">Transforme cartas paradas em credito ou Pix.</h2>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            O fluxo de compra foi pensado para ser transparente: voce envia fotos,
            recebe uma cotacao por condicao e escolhe credito na loja ou pagamento.
          </p>
          <div className="mt-7 grid gap-3">
            {[
              ["Triagem visual", "Fotos ou planilha com nomes, edicoes e condicoes."],
              ["Cotacao objetiva", "Preco de mercado, liquidez e raridade em uma proposta."],
              ["Pagamento claro", "Pix, credito na loja ou composicao entre os dois."]
            ].map(([title, copy]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Check size={14} />
                </span>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{title}</p>
                  <p className="text-sm leading-6 text-[var(--muted)]">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {buylist.map((item) => (
            <article key={item.game} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-sm font-semibold text-[var(--accent)]">{item.game}</p>
                  <h3 className="text-xl font-semibold text-[var(--ink)]">{item.title}</h3>
                </div>
                <span className="rounded-md bg-[var(--surface-hover)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                  {item.turnaround}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.estimate}</p>
            </article>
          ))}
          <BuylistForm />
        </div>
      </section>

      <section id="operacao" className="border-y border-[var(--line)] bg-[var(--surface)]/70 text-[var(--ink)]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            [ShieldCheck, "Condicao auditada", "NM, SP, MP e HP com padrao fotografavel."],
            [Truck, "Envio rastreado", "Integracao pronta para frete e retirada local."],
            [CreditCard, "Checkout direto", "Carrinho preparado para Pix e cartao."],
            [Boxes, "Estoque real", "Neon como fonte unica para produtos e pedidos."]
          ].map(([Icon, title, copy]) => (
            <div key={String(title)} className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <Icon size={22} className="mb-4 text-[var(--accent)]" />
              <p className="font-semibold">{String(title)}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{String(copy)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-8 text-sm text-[var(--muted)] sm:px-6 md:flex-row lg:px-8">
        <p>Mana Draw TCG Market</p>
        <div className="flex gap-4">
          <a href="#catalogo">Catalogo</a>
          <a href="#venda">Buylist</a>
          <a href="#operacao">Operacao</a>
        </div>
      </footer>

      {cartOpen && (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <button
            className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-xs"
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setCartOpen(false)}
          />
          <aside className="fixed bottom-0 right-0 z-50 flex h-[80vh] w-full flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl transition-all duration-300 md:absolute md:top-0 md:h-full md:max-w-md md:rounded-t-none animate-slide-up md:animate-fade-in border-t md:border-t-0 md:border-l border-[var(--line)]">
            {/* Handle do bottom sheet no mobile */}
            <div className="mx-auto my-2.5 h-1 w-12 rounded-full bg-[var(--line)] md:hidden shrink-0" />

            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
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
                    <p className="font-semibold text-[var(--ink)]">Seu carrinho esta vazio</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Adicione singles do catalogo.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {cart.map((line) => (
                    <div key={line.card.id} className="grid grid-cols-[64px_1fr] gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-hover)]/40 p-3">
                      <div className="relative aspect-[5/7] overflow-hidden rounded-md bg-stone-800">
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
                              className="grid h-8 w-8 place-items-center text-[var(--ink)] hover:text-white"
                              type="button"
                              aria-label="Diminuir quantidade"
                              onClick={() => updateQuantity(line.card.id, line.quantity - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="grid h-8 min-w-8 place-items-center text-sm text-[var(--ink)] font-medium">{line.quantity}</span>
                            <button
                              className="grid h-8 w-8 place-items-center text-[var(--ink)] hover:text-white"
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

            <div className="border-t border-[var(--line)] bg-[var(--surface)] p-4">
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
                <p className={`mt-3 text-sm ${orderState.ok ? "text-[var(--accent)]" : "text-red-400"}`}>
                  {orderState.message}
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            className="absolute inset-0 cursor-default bg-black/35"
            type="button"
            aria-label="Fechar autenticacao"
            onClick={() => setAuthOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[var(--ink)]">Conta Mana Draw</p>
                  <p className="text-sm text-[var(--muted)]">
                    Entre para finalizar pedidos e acompanhar seu historico.
                  </p>
                </div>
                <button
                  className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)]"
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

function WeeklyDropPanel({ cards }: { cards: TcgCard[] }) {
  if (cards.length === 0) return null;

  return (
    <aside className="card-shadow overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">Drop da semana</p>
          <p className="text-sm text-[var(--muted)]">Ofertas para comprar agora.</p>
        </div>
        <span className="rounded-md bg-[var(--accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--accent)]">
          -12%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 bg-[var(--background)] p-4">
        {cards.map((card, index) => (
          <CardFlip
            key={card.id}
            card={card}
            priority={index === 0}
            sizes="(min-width: 1024px) 150px, 45vw"
          />
        ))}
      </div>
      <div className="border-t border-[var(--line)] p-4">
        <a
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          href="#catalogo"
        >
          Ver cartas em destaque
        </a>
      </div>
    </aside>
  );
}

function CardFlip({
  card,
  priority = false,
  sizes
}: {
  card: TcgCard;
  priority?: boolean;
  sizes: string;
}) {
  const back = getCardBack(card.game);

  return (
    <div
      className="group relative aspect-[5/7] w-full shrink-0 [perspective:1200px]"
      tabIndex={0}
      aria-label={`${card.name}. Passe o mouse para ver o verso.`}
    >
      <div className="absolute inset-0 rounded-md shadow-[0_18px_42px_rgba(0,0,0,0.32)] transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)_rotateZ(-1deg)] group-focus:[transform:rotateY(180deg)_rotateZ(-1deg)]">
        <div className="absolute inset-0 overflow-hidden rounded-md border border-[var(--line)] bg-stone-800 [backface-visibility:hidden]">
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            unoptimized
            sizes={sizes}
            className="object-cover"
            priority={priority}
          />
        </div>
        <div className={`absolute inset-0 overflow-hidden rounded-md border [backface-visibility:hidden] [transform:rotateY(180deg)] ${back.frame}`}>
          {back.imageUrl ? (
            <>
              <Image
                src={back.imageUrl}
                alt="Verso de carta Magic: The Gathering"
                fill
                unoptimized
                sizes={sizes}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.24)_43%,transparent_57%)] opacity-0 transition-opacity duration-500 group-hover:opacity-45 group-focus:opacity-45" />
              <div className="absolute inset-0 rounded-md shadow-[inset_0_0_28px_rgba(0,0,0,0.55)]" />
            </>
          ) : (
            <>
              <div className={`absolute inset-2 rounded-[6px] border ${back.inner}`} />
              <div className="absolute inset-[13px] rounded-[5px] border border-white/10 bg-black/25" />
              <div className={`absolute inset-[22px] rounded-[4px] border ${back.inner}`} />
              <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2 text-[9px] font-bold uppercase text-white/65">
                <span>{card.game}</span>
                <span>{card.finish}</span>
              </div>
              <div className="absolute inset-0 grid place-items-center p-4 text-center">
                <div className="relative grid h-[46%] w-[64%] place-items-center rounded-full border border-white/15 bg-black/20 shadow-2xl">
                  <div className={`absolute inset-2 rounded-full border ${back.inner}`} />
                  <span className={`grid h-10 w-10 place-items-center rounded-md text-xs font-bold text-white shadow-lg ${back.badge}`}>
                    MD
                  </span>
                </div>
              </div>
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase text-white/55">
                <span>Mana Draw</span>
                <span>{card.language}</span>
              </div>
              <div className={`absolute inset-0 opacity-35 ${back.sheen}`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getCardBack(game: TcgCard["game"]) {
  if (game === "Magic") {
    return {
      badge: "bg-violet-500",
      frame: "border-black bg-black",
      imageUrl: "/card-backs/magic-back.png",
      inner: "border-violet-300/20",
      sheen: "bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.18)_42%,transparent_58%)]"
    };
  }

  if (game === "Pokemon") {
    return {
      badge: "bg-amber-500",
      frame: "border-black bg-black",
      imageUrl: "/card-backs/pokemon-back.png",
      inner: "border-amber-200/20",
      sheen: "bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.2)_42%,transparent_58%)]"
    };
  }

  return {
    badge: "bg-cyan-500",
    frame: "border-black bg-black",
    imageUrl: "/card-backs/yugioh-back.png",
    inner: "border-cyan-200/20",
    sheen: "bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.18)_42%,transparent_58%)]"
  };
}
