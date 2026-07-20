"use client";

import {
  ArrowUpDown,
  BadgeCheck,
  Boxes,
  Check,
  ChevronRight,
  CreditCard,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
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
  const [menuOpen, setMenuOpen] = useState(false);
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
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#f7f5f0]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="Nova Mana">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--ink)] text-sm font-semibold text-white">
              NM
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">Nova Mana</span>
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
                    className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)] sm:inline-flex"
                    href="/admin"
                  >
                    <LayoutDashboard size={16} />
                    Admin
                  </a>
                )}
                <a
                  className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)] sm:inline-flex"
                  href="/conta"
                >
                  <UserRound size={16} />
                  {currentUser.name}
                </a>
                <form action={logoutAction} className="hidden sm:block">
                  <button
                    className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-white text-[var(--ink)]"
                    type="submit"
                    aria-label="Sair"
                  >
                    <LogOut size={17} />
                  </button>
                </form>
              </>
            ) : (
              <button
                className="hidden h-10 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--ink)] sm:inline-flex"
                type="button"
                onClick={() => setAuthOpen(true)}
              >
                <UserRound size={16} />
                Entrar
              </button>
            )}
            <button
              className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)] bg-white text-[var(--ink)] md:hidden"
              type="button"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <button
              className="relative grid h-10 w-10 place-items-center rounded-md bg-[var(--ink)] text-white"
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
        {menuOpen && (
          <div className="border-t border-[var(--line)] bg-white px-4 py-3 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm">
              <a href="#catalogo" onClick={() => setMenuOpen(false)}>
                Catalogo
              </a>
              <a href="#venda" onClick={() => setMenuOpen(false)}>
                Venda suas cartas
              </a>
              <a href="#operacao" onClick={() => setMenuOpen(false)}>
                Operacao
              </a>
              <a href="/conta" onClick={() => setMenuOpen(false)}>
                Historico
              </a>
              {currentUser?.role === "admin" && (
                <a href="/admin" onClick={() => setMenuOpen(false)}>
                  Admin
                </a>
              )}
              {!currentUser && (
                <button
                  className="w-fit font-semibold text-[var(--ink)]"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAuthOpen(true);
                  }}
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex w-fit items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--muted)]">
            <Sparkles size={15} className="text-[var(--gold)]" />
            Singles verificadas, estoque real e envio rastreado
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
            Cartas TCG prontas para jogar, colecionar e negociar.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            Uma loja enxuta para Magic, Yu-Gi-Oh! e Pokemon com compra rapida,
            curadoria por condicao e um fluxo claro para vender sua colecao.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              href="#catalogo"
            >
              Ver catalogo
              <ChevronRight size={17} />
            </a>
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--ink)]"
              href="#venda"
            >
              Cotar colecao
            </a>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["2.4k", "cartas em estoque"],
              ["98%", "pedidos no prazo"],
              ["24h", "para cotacoes"]
            ].map(([value, label]) => (
              <div key={label} className="border-l border-[var(--line)] pl-4">
                <strong className="block text-2xl text-[var(--ink)]">{value}</strong>
                <span className="text-sm text-[var(--muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-shadow overflow-hidden rounded-lg border border-[var(--line)] bg-white">
          <div className="grid grid-cols-2 gap-3 bg-[var(--ink)] p-4">
            {cards.slice(0, 4).map((card) => (
              <div key={card.id} className="relative aspect-[5/7] overflow-hidden rounded-md bg-stone-200">
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 190px, 45vw"
                  className="object-cover"
                  priority={card.id === cards[0]?.id}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Drop da semana</p>
              <p className="text-sm text-[var(--muted)]">Cartas com preco abaixo do mercado.</p>
            </div>
            <span className="rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-semibold text-[var(--accent-strong)]">
              -12%
            </span>
          </div>
        </div>
      </section>

      <section id="catalogo" className="border-y border-[var(--line)] bg-white/72">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--accent-strong)]">Catalogo</p>
              <h2 className="text-3xl font-semibold text-[var(--ink)]">Singles em destaque</h2>
            </div>
            <form className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_96px] lg:min-w-[660px]" method="get" action="/">
              <input type="hidden" name="game" value={game} />
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                <input
                  className="h-11 w-full rounded-md border border-[var(--line)] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-700/10"
                  name="q"
                  placeholder="Buscar por nome, colecao ou tag"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label className="relative block">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                <select
                  className="h-11 w-full appearance-none rounded-md border border-[var(--line)] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-teal-700/10"
                  name="sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                >
                  <option value="relevance">Maior desconto</option>
                  <option value="price-asc">Menor preco</option>
                  <option value="price-desc">Maior preco</option>
                </select>
              </label>
              <button className="h-11 rounded-md bg-[var(--ink)] text-sm font-semibold text-white" type="submit">
                Buscar
              </button>
            </form>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 pr-2 text-sm text-[var(--muted)]">
              <Filter size={16} />
              Jogos
            </span>
            {games.map((item) => (
              <button
                key={item}
                className={`h-10 rounded-md border px-4 text-sm font-medium transition ${
                  game === item
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                }`}
                type="button"
                onClick={() => setGame(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map((card) => (
              <article
                key={card.id}
                className="grid grid-cols-[116px,1fr] gap-4 rounded-lg border border-[var(--line)] bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[5/7] overflow-hidden rounded-md bg-stone-200">
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    fill
                    unoptimized
                    sizes="116px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{card.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{card.setName}</p>
                    </div>
                    <span className="rounded-md bg-[#f2efe7] px-2 py-1 text-[11px] font-semibold text-[var(--ink)]">
                      {card.condition}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {[card.game, card.finish, card.language].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-lg font-semibold text-[var(--ink)]">{formatCurrency(card.priceCents)}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Mercado {formatCurrency(card.marketPriceCents)} · {formatStock(card.stock)}
                  </p>
                  <button
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                    type="button"
                    onClick={() => addToCart(card)}
                  >
                    <ShoppingBag size={16} />
                    Adicionar
                  </button>
                </div>
              </article>
            ))}
            {filteredCards.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)] sm:col-span-2 lg:col-span-3">
                Nenhuma carta encontrada. Tente outro nome, colecao ou jogo.
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="venda" className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-16">
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--accent-strong)]">Buylist</p>
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
                <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e8f5f2] text-[var(--accent-strong)]">
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
            <article key={item.game} className="rounded-lg border border-[var(--line)] bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-sm font-semibold text-[var(--accent-strong)]">{item.game}</p>
                  <h3 className="text-xl font-semibold text-[var(--ink)]">{item.title}</h3>
                </div>
                <span className="rounded-md bg-[#f2efe7] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                  {item.turnaround}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.estimate}</p>
            </article>
          ))}
          <BuylistForm />
        </div>
      </section>

      <section id="operacao" className="border-t border-[var(--line)] bg-[var(--ink)] text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            [ShieldCheck, "Condicao auditada", "NM, SP, MP e HP com padrao fotografavel."],
            [Truck, "Envio rastreado", "Integracao pronta para frete e retirada local."],
            [CreditCard, "Checkout direto", "Carrinho preparado para Pix e cartao."],
            [Boxes, "Estoque real", "Neon como fonte unica para produtos e pedidos."]
          ].map(([Icon, title, copy]) => (
            <div key={String(title)} className="rounded-lg border border-white/12 p-4">
              <Icon size={22} className="mb-4 text-[#75d6cc]" />
              <p className="font-semibold">{String(title)}</p>
              <p className="mt-2 text-sm leading-6 text-white/68">{String(copy)}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-8 text-sm text-[var(--muted)] sm:px-6 md:flex-row lg:px-8">
        <p>Nova Mana TCG Market</p>
        <div className="flex gap-4">
          <a href="#catalogo">Catalogo</a>
          <a href="#venda">Buylist</a>
          <a href="#operacao">Operacao</a>
        </div>
      </footer>

      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 cursor-default bg-black/35"
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setCartOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
              <div>
                <p className="font-semibold text-[var(--ink)]">Carrinho</p>
                <p className="text-sm text-[var(--muted)]">{cartCount} itens selecionados</p>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-md border border-[var(--line)]"
                type="button"
                aria-label="Fechar carrinho"
                onClick={() => setCartOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
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
                    <div key={line.card.id} className="grid grid-cols-[64px,1fr] gap-3 rounded-lg border border-[var(--line)] p-3">
                      <div className="relative aspect-[5/7] overflow-hidden rounded-md bg-stone-200">
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
                          <p className="text-sm font-semibold">{formatCurrency(line.card.priceCents * line.quantity)}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-md border border-[var(--line)]">
                            <button
                              className="grid h-8 w-8 place-items-center"
                              type="button"
                              aria-label="Diminuir quantidade"
                              onClick={() => updateQuantity(line.card.id, line.quantity - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="grid h-8 min-w-8 place-items-center text-sm">{line.quantity}</span>
                            <button
                              className="grid h-8 w-8 place-items-center"
                              type="button"
                              aria-label="Aumentar quantidade"
                              onClick={() => updateQuantity(line.card.id, line.quantity + 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            className="text-xs font-semibold text-[var(--muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
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

            <div className="border-t border-[var(--line)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Subtotal</span>
                <strong className="text-xl text-[var(--ink)]">{formatCurrency(subtotal)}</strong>
              </div>
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  if (!currentUser) setAuthOpen(true);
                }}
              >
                <BadgeCheck size={17} />
                {currentUser ? "Finalizar pedido" : "Entrar para finalizar"}
              </button>
              {currentUser && (
                <form action={orderFormAction} className="mt-3">
                  <input type="hidden" name="cart" value={cartPayload} />
                  <button
                    className="h-11 w-full rounded-md border border-[var(--line)] bg-white text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
                    disabled={cart.length === 0 || orderPending}
                    type="submit"
                  >
                    {orderPending ? "Criando pedido..." : "Confirmar pedido"}
                  </button>
                </form>
              )}
              {orderState.message && (
                <p className={`mt-3 text-sm ${orderState.ok ? "text-[var(--accent-strong)]" : "text-red-700"}`}>
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
            <div className="rounded-lg border border-[var(--line)] bg-[#f7f5f0] p-4 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[var(--ink)]">Conta Nova Mana</p>
                  <p className="text-sm text-[var(--muted)]">
                    Entre para finalizar pedidos e acompanhar seu historico.
                  </p>
                </div>
                <button
                  className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-white"
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setAuthOpen(false)}
                >
                  <X size={17} />
                </button>
              </div>
              <AuthPanel />
              <p className="mt-3 text-xs text-[var(--muted)]">
                Sem Neon configurado: use qualquer email para cliente ou admin@novamana.local com senha admin123.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
