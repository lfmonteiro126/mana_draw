import {
  BarChart3,
  Bell,
  Boxes,
  Camera,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Layers3,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  createCardAction,
  updateBuylistAction,
  updateCardAction,
  updateOrderStatusAction
} from "@/app/actions";
import { AuthPanel } from "@/components/auth-panel";
import { CardAutocomplete } from "@/components/card-autocomplete";
import { currentUser } from "@/lib/auth";
import {
  getAdminCards,
  getAdminOrders,
  getBuylistSubmissions,
  hasDatabase
} from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import type { CardCondition, FilterGame, Game, TcgCard } from "@/lib/types";

const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const buylistStatuses = ["new", "reviewing", "approved", "declined", "paid"];
const orderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"];

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  const params = await searchParams;
  const notice = typeof params.notice === "string" ? params.notice : "";
  const error = typeof params.error === "string" ? params.error : "";
  const query = typeof params.query === "string" ? params.query : "";
  const game = normalizeGame(params.game);
  const stock = normalizeStock(params.stock);

  if (user?.role !== "admin") {
    return (
      <main className="min-h-screen px-4 py-10 text-[var(--ink)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl">
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/">
            Voltar para loja
          </Link>
          <div className="card-shadow mt-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6">
            <h1 className="text-3xl font-semibold">Admin Nova Mana</h1>
            <p className="mt-2 text-[var(--muted)]">
              Entre com uma conta admin para gerenciar estoque, precos, pedidos e cotações.
            </p>
            <div className="mt-6">
              <AuthPanel redirectTo="/admin" />
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Demo local sem Neon: admin@novamana.local / admin123.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const [cards, submissions, orders] = await Promise.all([
    getAdminCards({ query, game, stock }),
    getBuylistSubmissions(),
    getAdminOrders()
  ]);

  const totalStock = cards.reduce((sum, card) => sum + card.stock, 0);
  const inventoryValue = cards.reduce(
    (sum, card) => sum + card.stock * card.priceCents,
    0
  );
  const lowStock = cards.filter((card) => card.stock <= 3).length;
  const openSubmissions = submissions.filter((submission) =>
    ["new", "reviewing"].includes(submission.status)
  ).length;
  const gameStats = getGameStats(cards);
  const topCards = [...cards]
    .sort((a, b) => b.stock * b.priceCents - a.stock * a.priceCents)
    .slice(0, 4);

  return (
    <main className="min-h-screen text-[var(--ink)]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)]/75 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-[76px] items-center gap-3 border-b border-[var(--line)] px-6">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--accent)] text-white">
              <CircleDollarSign size={22} />
            </span>
            <div>
              <p className="text-lg font-semibold">Nova Mana</p>
              <p className="text-xs text-[var(--muted)]">TCG Admin</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6 text-sm font-medium text-[var(--muted)]">
            <NavItem active icon={<Gauge size={19} />} label="Overview" />
            <NavItem icon={<Layers3 size={19} />} label="Inventario" />
            <NavItem icon={<ClipboardList size={19} />} label="Buylists" />
            <NavItem icon={<ShoppingBag size={19} />} label="Pedidos" />
            <NavItem icon={<UsersRound size={19} />} label="Clientes" />
            <NavItem icon={<BarChart3 size={19} />} label="Relatorios" />
            <NavItem icon={<Settings size={19} />} label="Ajustes" />
          </nav>

          <div className="border-t border-[var(--line)] p-4">
            <Link
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              href="/"
            >
              <ChevronLeft size={18} />
              Voltar para loja
            </Link>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-xl">
            <div className="flex h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-7">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                  <span className="hidden items-center gap-2 text-sm text-[var(--muted)] sm:inline-flex">
                    <Sparkles size={15} />
                    Operacao TCG
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Estoque, pedidos e cotações com o mesmo padrão visual da loja.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  className="hidden h-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] sm:inline-flex"
                  href="/"
                >
                  Loja
                </Link>
                <button className="relative grid h-11 w-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]" type="button" aria-label="Notificacoes">
                  <Bell size={18} />
                  {openSubmissions > 0 && (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
                  NM
                </span>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-7">
            {(notice || error) && (
              <p className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-500/25 bg-red-500/15 text-red-300" : "border-[var(--accent)]/25 bg-[var(--accent)]/15 text-[var(--accent)]"}`}>
                {messageFor(error || notice)}
              </p>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<CircleDollarSign size={20} />}
                label="Valor em estoque"
                trend="+ inventario"
                value={formatCurrency(inventoryValue)}
                tone="cyan"
              />
              <MetricCard
                icon={<Boxes size={20} />}
                label="Cartas ativas"
                trend={`${totalStock} unidades`}
                value={String(cards.length)}
                tone="green"
              />
              <MetricCard
                icon={<Camera size={20} />}
                label="Cotações abertas"
                trend={`${submissions.length} recebidas`}
                value={String(openSubmissions)}
                tone="orange"
              />
              <MetricCard
                icon={<ShieldCheck size={20} />}
                label="Baixo estoque"
                trend={hasDatabase() ? "Neon conectado" : "Modo demo"}
                value={String(lowStock)}
                tone="red"
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.85fr)]">
              <Panel>
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-semibold">Inventario</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Busque, filtre e ajuste preco, estoque e condicao.
                    </p>
                  </div>
                  <span className="w-fit rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                    {cards.length} registros
                  </span>
                </div>

                <form className="mb-4 grid gap-3 lg:grid-cols-[minmax(180px,1fr)_160px_160px_auto]">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                    <input
                      className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
                      name="query"
                      placeholder="Buscar carta, colecao ou tag"
                      defaultValue={query}
                    />
                  </label>
                  <select className="h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)]" name="game" defaultValue={game}>
                    <option value="Todos">Todos os jogos</option>
                    {games.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select className="h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--accent)]" name="stock" defaultValue={stock}>
                    <option value="all">Todo estoque</option>
                    <option value="low">Baixo estoque</option>
                    <option value="out">Sem estoque</option>
                  </select>
                  <button className="h-11 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
                    Filtrar
                  </button>
                </form>

                <div className="overflow-hidden rounded-lg border border-[var(--line)]">
                  <div className="hidden grid-cols-[minmax(230px,1fr)_145px_105px_135px_105px] gap-4 border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold uppercase text-[var(--muted)] xl:grid">
                    <span>Carta</span>
                    <span>Preco</span>
                    <span>Estoque</span>
                    <span>Condicao</span>
                    <span></span>
                  </div>

                  {cards.length === 0 ? (
                    <EmptyState icon={<Search size={30} />} title="Nenhuma carta encontrada" text="Ajuste os filtros ou cadastre uma nova carta." />
                  ) : (
                    cards.map((card) => <InventoryRow key={card.id} card={card} />)
                  )}
                </div>
              </Panel>

              <div className="grid gap-6">
                <Panel>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Nova carta</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">Cadastre uma carta direto no catalogo.</p>
                    </div>
                    <Plus className="text-[var(--accent)]" size={20} />
                  </div>
                  <form action={createCardAction} className="grid gap-3">
                    <CardAutocomplete />
                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
                      <input className="h-4 w-4 accent-[var(--accent)]" name="featured" type="checkbox" />
                      Destacar na vitrine
                    </label>
                    <button className="h-11 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
                      Cadastrar carta
                    </button>
                  </form>
                </Panel>

                <Panel>
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold">Distribuicao por jogo</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">Quantidade de cartas no catalogo filtrado.</p>
                  </div>
                  <div className="space-y-5">
                    {gameStats.map((item) => (
                      <div key={item.game}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-[var(--ink)]">{item.game}</span>
                          <span className="text-[var(--muted)]">
                            {item.count} · {item.percent}%
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                          <div
                            className={`h-full rounded-full ${item.barClass}`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-5">
                    <span className="text-sm text-[var(--muted)]">Valor total</span>
                    <strong className="text-2xl">{formatCurrency(inventoryValue)}</strong>
                  </div>
                </Panel>

                <Panel>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">Cartas principais</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">Maior valor por estoque.</p>
                    </div>
                    <TrendingUp className="text-[var(--accent)]" size={20} />
                  </div>
                  <div className="space-y-4">
                    {topCards.map((card, index) => (
                      <div key={card.id} className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{card.name}</p>
                            <p className="text-xs text-[var(--muted)]">{card.stock} un. · {card.condition}</p>
                          </div>
                        </div>
                        <strong className="text-sm">{formatCurrency(card.stock * card.priceCents)}</strong>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Panel>
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-semibold">Pedidos</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">Acompanhe e atualize o status das compras.</p>
                  </div>
                  <span className="w-fit rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                    {orders.length} recentes
                  </span>
                </div>
                {orders.length === 0 ? (
                  <EmptyState icon={<PackageCheck size={30} />} title="Nenhum pedido ainda" text="Os pedidos finalizados aparecem aqui." />
                ) : (
                  <div className="grid gap-3">
                    {orders.map((order) => (
                      <form key={order.id} action={updateOrderStatusAction} className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-[1fr_150px_92px] sm:items-center">
                        <input type="hidden" name="id" value={order.id} />
                        <div className="min-w-0">
                          <p className="font-semibold">Pedido {order.id.slice(0, 8)}</p>
                          <p className="truncate text-sm text-[var(--muted)]">
                            {order.customerEmail ?? "Cliente"} · {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {order.itemCount} itens
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{formatCurrency(order.subtotalCents)}</p>
                        </div>
                        <select className={inputClass} name="status" defaultValue={order.status}>
                          {orderStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <button className="h-11 rounded-lg bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
                          Salvar
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel>
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-semibold">Cotações de buylist</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">Analise fotos, status e valor oferecido.</p>
                  </div>
                  <span className="w-fit rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--gold)]">
                    {openSubmissions} abertas
                  </span>
                </div>

                {submissions.length === 0 ? (
                  <EmptyState icon={<Camera size={30} />} title="Nenhuma cotacao recebida" text="Os lotes enviados pelo site aparecem aqui." />
                ) : (
                  <div className="grid gap-3">
                    {submissions.map((submission) => (
                      <article key={submission.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{submission.customerName}</p>
                            <p className="truncate text-sm text-[var(--muted)]">
                              {submission.email} · {submission.game} · {new Date(submission.createdAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <span className="w-fit rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                            {submission.photoCount} fotos
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                          {submission.notes}
                        </p>
                        {submission.photoUrls.length > 0 && (
                          <div className="mt-4 grid grid-cols-4 gap-2">
                            {submission.photoUrls.slice(0, 4).map((url, index) => (
                              <a
                                key={`${submission.id}-${index}`}
                                className="block aspect-[3/4] rounded-lg border border-[var(--line)] bg-cover bg-center"
                                href={url}
                                style={{ backgroundImage: `url(${url})` }}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Abrir foto ${index + 1}`}
                              />
                            ))}
                          </div>
                        )}
                        <form action={updateBuylistAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_92px]">
                          <input type="hidden" name="id" value={submission.id} />
                          <select className={inputClass} name="status" defaultValue={submission.status}>
                            {buylistStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <input
                            className={inputClass}
                            name="offer"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Oferta"
                            defaultValue={submission.offerCents === null ? "" : (submission.offerCents / 100).toFixed(2)}
                          />
                          <button className="h-11 rounded-lg bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
                            Salvar
                          </button>
                        </form>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function InventoryRow({ card }: { card: TcgCard }) {
  return (
    <form
      action={updateCardAction}
      className="grid gap-4 border-b border-[var(--line)] px-4 py-4 last:border-b-0 xl:grid-cols-[minmax(230px,1fr)_145px_105px_135px_105px] xl:items-center"
    >
      <input type="hidden" name="id" value={card.id} />
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-hover)] text-sm font-bold text-[var(--ink)]">
            {card.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--ink)]">{card.name}</p>
            <p className="truncate text-sm text-[var(--muted)]">
              {card.game} · {card.setName} · {card.finish}
            </p>
          </div>
        </div>
      </div>

      <label className="grid min-w-0 gap-1 text-sm">
        <span className="text-xs text-[var(--muted)] xl:hidden">Preco</span>
        <input
          className={inputClass}
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={(card.priceCents / 100).toFixed(2)}
        />
      </label>

      <label className="grid min-w-0 gap-1 text-sm">
        <span className="text-xs text-[var(--muted)] xl:hidden">Estoque</span>
        <input
          className={inputClass}
          name="stock"
          type="number"
          min="0"
          step="1"
          defaultValue={card.stock}
        />
      </label>

      <label className="grid min-w-0 gap-1 text-sm">
        <span className="text-xs text-[var(--muted)] xl:hidden">Condicao</span>
        <select className={inputClass} name="condition" defaultValue={card.condition}>
          {conditions.map((condition) => (
            <option key={condition} value={condition}>
              {condition}
            </option>
          ))}
        </select>
      </label>

      <button className="h-11 w-full rounded-lg bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
        Salvar
      </button>
    </form>
  );
}

function EmptyState({
  icon,
  title,
  text
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-soft)] p-8 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-[var(--surface)] text-[var(--muted)]">
        {icon}
      </span>
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

function NavItem({
  active,
  icon,
  label
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-3 transition ${
        active
          ? "bg-[var(--surface-hover)] text-[var(--ink)] before:-ml-3 before:h-7 before:w-1 before:rounded-r-full before:bg-[var(--accent)]"
          : "hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
      }`}
    >
      <span className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{icon}</span>
      {label}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="card-shadow rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      {children}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  trend,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  trend: string;
  value: string;
  tone: "cyan" | "green" | "orange" | "red";
}) {
  const toneClass = {
    cyan: "text-[var(--accent)] bg-[var(--accent)]/15",
    green: "text-emerald-300 bg-emerald-500/15",
    orange: "text-[var(--gold)] bg-[var(--gold)]/15",
    red: "text-red-300 bg-red-500/15"
  }[tone];

  return (
    <div className="card-shadow rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
        <span className={`grid h-11 w-11 place-items-center rounded-lg ${toneClass}`}>
          {icon}
        </span>
      </div>
      <div className="flex items-end gap-3">
        <strong className="text-3xl font-semibold tracking-tight text-[var(--ink)]">{value}</strong>
        <span className="pb-1 text-sm font-semibold text-[var(--accent)]">{trend}</span>
      </div>
    </div>
  );
}

function getGameStats(cards: Array<{ game: Game }>) {
  const items: Array<{ game: Game; barClass: string }> = [
    { game: "Magic", barClass: "bg-[var(--accent)]" },
    { game: "Pokemon", barClass: "bg-[var(--gold)]" },
    { game: "Yu-Gi-Oh!", barClass: "bg-violet-400" }
  ];
  const total = Math.max(cards.length, 1);

  return items.map((item) => {
    const count = cards.filter((card) => card.game === item.game).length;
    return {
      ...item,
      count,
      percent: Math.round((count / total) * 100)
    };
  });
}

function normalizeGame(value: string | string[] | undefined): FilterGame {
  return typeof value === "string" && (value === "Magic" || value === "Pokemon" || value === "Yu-Gi-Oh!")
    ? value
    : "Todos";
}

function normalizeStock(value: string | string[] | undefined): "all" | "low" | "out" {
  return typeof value === "string" && (value === "low" || value === "out") ? value : "all";
}

function messageFor(code: string) {
  const messages: Record<string, string> = {
    "card-updated": "Carta atualizada com sucesso.",
    "card-created": "Carta cadastrada com sucesso.",
    "buylist-updated": "Cotacao atualizada com sucesso.",
    "order-updated": "Pedido atualizado com sucesso.",
    "demo-no-db": "Modo demo ativo. Configure o Neon para persistir esta alteracao.",
    unauthorized: "Acesso restrito a administradores.",
    "invalid-card": "Dados da carta invalidos.",
    "invalid-new-card": "Confira os dados da nova carta.",
    "invalid-buylist": "Dados da cotacao invalidos.",
    "invalid-order": "Status do pedido invalido.",
    "no-db": "Banco indisponivel."
  };

  return messages[code] ?? code;
}

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]";
