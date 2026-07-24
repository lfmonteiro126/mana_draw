import {
  BarChart3,
  Bell,
  Boxes,
  Camera,
  ChevronLeft,
  CircleDollarSign,
  Diamond,
  ClipboardList,
  Database,
  Gauge,
  Layers3,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  UsersRound
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  createCardAction,
  deleteCardAction,
  updateBuylistAction,
  updateCardAction,
  updateOrderStatusAction
} from "@/app/actions";
import { AuthPanel } from "@/components/auth-panel";
import { CardAutocomplete } from "@/components/card-autocomplete";
import { currentUser } from "@/lib/auth";
import {
  getAdminCards,
  getAdminCustomers,
  getAdminOrders,
  getBuylistSubmissions,
  hasDatabase
} from "@/lib/db";
import { formatCurrency, formatUsd } from "@/lib/format";
import { cardHasSecondFace, resolveCardBackImageUrl } from "@/lib/card-images";
import type { AdminCustomer, BuylistSubmission, CardCondition, FilterGame, Game, OrderSummary, TcgCard } from "@/lib/types";

const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const buylistStatuses = ["new", "reviewing", "approved", "declined", "paid"];
const orderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"];
const tabs = ["overview", "inventory", "new-card", "buylists", "orders", "customers", "internal-users", "reports", "settings"] as const;

type AdminTab = (typeof tabs)[number];

const tabLabels: Record<AdminTab, { title: string; description: string }> = {
  overview: {
    title: "Overview",
    description: "Resumo operacional de estoque, pedidos e cotações."
  },
  inventory: {
    title: "Inventário",
    description: "Busque, filtre e ajuste preço, estoque e condição das cartas."
  },
  "new-card": {
    title: "Nova carta",
    description: "Cadastre singles com autocomplete, print selecionado e preço de mercado."
  },
  buylists: {
    title: "Buylists",
    description: "Analise fotos, acompanhe status e registre ofertas recebidas."
  },
  orders: {
    title: "Pedidos",
    description: "Acompanhe compras recentes e atualize o fluxo de entrega."
  },
  customers: {
    title: "Clientes",
    description: "Veja contas de compradores, recorrência de compra e cotações vinculadas."
  },
  "internal-users": {
    title: "Usuários internos",
    description: "Gerencie a visibilidade de admins e contas internas da operação."
  },
  reports: {
    title: "Relatórios",
    description: "Indicadores para decidir reposição, precificação e prioridade."
  },
  settings: {
    title: "Ajustes",
    description: "Estado de ambiente, Neon e integrações essenciais."
  }
};

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
  const activeTab = normalizeTab(params.tab);

  if (user?.role !== "admin") {
    return (
      <main className="min-h-screen px-4 py-10 text-[var(--ink)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl">
          <Link className="text-sm font-semibold text-[var(--accent)]" href="/">
            Voltar para loja
          </Link>
          <div className="surface-card mt-8 p-6 sm:p-8">
            <p className="text-3xl font-semibold tracking-tight">Mana Draw</p>
            <h1 className="mt-2 text-xl font-medium text-[var(--ink)]">Acesso admin</h1>
            <p className="mt-2 text-[var(--muted)]">
              Entre com uma conta admin para gerenciar estoque, preços, pedidos e cotações.
            </p>
            <div className="mt-6">
              <AuthPanel redirectTo="/admin" />
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Demo local sem Neon: admin@manadraw.local / admin123.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const [allCards, cards, submissions, orders, customers] = await Promise.all([
    getAdminCards({ limit: 10000 }),
    getAdminCards({ query, game, stock }),
    getBuylistSubmissions(),
    getAdminOrders(),
    getAdminCustomers()
  ]);

  const totalStock = allCards.reduce((sum, card) => sum + card.stock, 0);
  const inventoryValue = allCards.reduce((sum, card) => sum + card.stock * card.priceCents, 0);
  const lowStockCards = allCards.filter((card) => card.stock <= 3);
  const openSubmissions = submissions.filter((submission) => ["new", "reviewing"].includes(submission.status));
  const paidRevenue = orders
    .filter((order) => !["cancelled"].includes(order.status))
    .reduce((sum, order) => sum + order.subtotalCents, 0);
  const topCards = [...allCards].sort((a, b) => b.stock * b.priceCents - a.stock * a.priceCents).slice(0, 4);
  const gameStats = getGameStats(allCards);
  const conditionStats = getConditionStats(allCards);
  const statusStats = getStatusStats(orders);
  const customerAccounts = customers.filter((customer) => customer.role === "customer");
  const internalUsers = customers.filter((customer) => customer.role !== "customer");
  const navItems = getNavItems(openSubmissions.length, orders.filter((order) => order.status === "pending").length);
  const page = tabLabels[activeTab];

  return (
    <main className="min-h-screen text-[var(--ink)]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-[var(--line)] bg-white/95 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-[76px] items-center gap-3 border-b border-[var(--line)] px-6">
            <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-bold text-white shadow-[0_8px_18px_rgba(15,159,144,0.28)]">
              MD
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">Mana Draw</p>
              <p className="text-xs text-[var(--muted)]">TCG Admin</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 px-4 py-6 text-sm font-medium text-[var(--muted)]">
            {navItems.map((item) => (
              <NavItem key={item.tab} active={activeTab === item.tab} badge={item.badge} href={`/admin?tab=${item.tab}`} icon={item.icon} label={item.label} />
            ))}
          </nav>

          <div className="border-t border-[var(--line)] p-4">
            <Link
              className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-3 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              href="/"
            >
              <ChevronLeft size={18} />
              Voltar para loja
            </Link>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-7">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{page.title}</h1>
                  <span className="hidden items-center gap-2 text-sm text-[var(--muted)] sm:inline-flex">
                    <Sparkles size={15} className="text-[var(--accent)]" />
                    Operação TCG
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{page.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <form className="relative hidden w-[280px] xl:block">
                  <input type="hidden" name="tab" value="inventory" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
                  <input className={inputClassWithIcon} name="query" placeholder="Busca global" defaultValue={query} />
                </form>
                <Link
                  className="hidden h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-soft)] sm:inline-flex"
                  href="/"
                >
                  Loja
                </Link>
                <Link
                  className="relative grid h-11 w-11 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)]"
                  href="/admin?tab=buylists"
                  aria-label="Notificações"
                >
                  <Bell size={18} />
                  {openSubmissions.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />}
                </Link>
                <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-bold text-white">
                  MD
                </span>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-4 py-3 scrollbar-none lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.tab}
                  className={`chip inline-flex h-10 shrink-0 items-center gap-2 px-3 text-sm ${
                    activeTab === item.tab ? "chip-active" : "text-[var(--muted)]"
                  }`}
                  href={`/admin?tab=${item.tab}`}
                >
                  {item.icon}
                  {item.label}
                  {item.badge ? (
                    <span
                      className={`rounded px-1.5 text-xs ${
                        activeTab === item.tab
                          ? "bg-white/20 text-white"
                          : "bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-7">
            {(notice || error) && (
              <p className={`mb-5 rounded-[var(--radius-control)] border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent-strong)]"}`}>
                {messageFor(error || notice)}
              </p>
            )}

            {activeTab === "overview" && (
              <OverviewTab
                cards={allCards}
                gameStats={gameStats}
                inventoryValue={inventoryValue}
                lowStockCards={lowStockCards}
                openSubmissions={openSubmissions}
                orders={orders}
                paidRevenue={paidRevenue}
                submissions={submissions}
                topCards={topCards}
                totalStock={totalStock}
              />
            )}
            {activeTab === "inventory" && (
              <InventoryTab cards={cards} game={game} gameStats={gameStats} inventoryValue={inventoryValue} query={query} stock={stock} topCards={topCards} />
            )}
            {activeTab === "new-card" && <NewCardTab gameStats={gameStats} inventoryValue={inventoryValue} topCards={topCards} />}
            {activeTab === "buylists" && <BuylistsTab submissions={submissions} openCount={openSubmissions.length} />}
            {activeTab === "orders" && <OrdersTab orders={orders} />}
            {activeTab === "customers" && <CustomersTab customers={customerAccounts} />}
            {activeTab === "internal-users" && <InternalUsersTab users={internalUsers} />}
            {activeTab === "reports" && (
              <ReportsTab
                conditionStats={conditionStats}
                gameStats={gameStats}
                inventoryValue={inventoryValue}
                lowStockCards={lowStockCards}
                orders={orders}
                paidRevenue={paidRevenue}
                statusStats={statusStats}
                submissions={submissions}
              />
            )}
            {activeTab === "settings" && <SettingsTab cards={allCards} userEmail={user.email} />}
          </div>
        </section>
      </div>
    </main>
  );
}

function OverviewTab({
  cards,
  gameStats,
  inventoryValue,
  lowStockCards,
  openSubmissions,
  orders,
  paidRevenue,
  submissions,
  topCards,
  totalStock
}: {
  cards: TcgCard[];
  gameStats: ReturnType<typeof getGameStats>;
  inventoryValue: number;
  lowStockCards: TcgCard[];
  openSubmissions: BuylistSubmission[];
  orders: OrderSummary[];
  paidRevenue: number;
  submissions: BuylistSubmission[];
  topCards: TcgCard[];
  totalStock: number;
}) {
  return (
    <div className="grid gap-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-bold text-[var(--accent)]">
                <Diamond size={14} />
                Painel executivo
              </span>
              <span className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">
                {cards.length} prints ativos
              </span>
            </div>
            <h2 className="mt-5 max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-3xl">
              Estoque, compra e venda em uma leitura rápida.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Priorize reposição, acompanhe buylist e veja a distribuição por jogo sem tabelas densas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroStat label="Estoque total" value={`${totalStock} un.`} />
            <HeroStat label="Valor parado" value={formatCurrency(inventoryValue)} />
            <HeroStat label="Cotações abertas" value={String(openSubmissions.length)} />
            <HeroStat label="Pedidos" value={String(orders.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CircleDollarSign size={20} />} label="Valor em estoque" trend="+ inventario" value={formatCurrency(inventoryValue)} tone="cyan" />
        <MetricCard icon={<Boxes size={20} />} label="Cartas ativas" trend={`${totalStock} unidades`} value={String(cards.length)} tone="green" />
        <MetricCard icon={<Camera size={20} />} label="Cotações abertas" trend={`${submissions.length} recebidas`} value={String(openSubmissions.length)} tone="orange" />
        <MetricCard icon={<ShoppingBag size={20} />} label="Receita em pedidos" trend={`${orders.length} pedidos`} value={formatCurrency(paidRevenue)} tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <Panel>
          <PanelHeader title="Prioridades de hoje" text="Acoes que impactam compra, cotacao e reposicao." badge={`${lowStockCards.length + openSubmissions.length} pendencias`} />
          <div className="grid gap-3 md:grid-cols-3">
            <PriorityCard href="/admin?tab=inventory&stock=low" label="Repor estoque baixo" value={String(lowStockCards.length)} text="Cartas com 3 unidades ou menos." />
            <PriorityCard href="/admin?tab=buylists" label="Responder cotações" value={String(openSubmissions.length)} text="Lotes novos ou em analise." />
            <PriorityCard href="/admin?tab=orders" label="Atualizar pedidos" value={String(orders.filter((order) => order.status === "pending").length)} text="Compras ainda pendentes." />
          </div>
        </Panel>

        <DistributionPanel gameStats={gameStats} inventoryValue={inventoryValue} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TopCardsPanel topCards={topCards} />
        <RecentOrdersPanel orders={orders.slice(0, 5)} />
      </section>
    </div>
  );
}

function InventoryTab({
  cards,
  game,
  gameStats,
  inventoryValue,
  query,
  stock,
  topCards
}: {
  cards: TcgCard[];
  game: FilterGame;
  gameStats: ReturnType<typeof getGameStats>;
  inventoryValue: number;
  query: string;
  stock: "all" | "low" | "out";
  topCards: TcgCard[];
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.85fr)]">
      <Panel>
        <PanelHeader title="Inventário" text="Cards consolidados por print, condição, idioma e acabamento." badge={`${cards.length} itens únicos`} />
        <form className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] p-3 md:grid-cols-2">
          <input type="hidden" name="tab" value="inventory" />
          <label className="relative block md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input className={inputClassWithIcon} name="query" placeholder="Buscar carta, coleção ou tag" defaultValue={query} />
          </label>
          <select className={inputClass} name="game" defaultValue={game}>
            <option value="Todos">Todos os jogos</option>
            {games.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className={inputClass} name="stock" defaultValue={stock}>
            <option value="all">Todo estoque</option>
            <option value="low">Baixo estoque</option>
            <option value="out">Sem estoque</option>
          </select>
          <button className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)] md:col-span-2" type="submit">
            Filtrar
          </button>
        </form>

        <div className="grid gap-3">
          {cards.length === 0 ? (
            <EmptyState icon={<Search size={30} />} title="Nenhuma carta encontrada" text="Ajuste os filtros ou cadastre uma nova carta." />
          ) : (
            cards.map((card) => <InventoryRow key={card.id} card={card} />)
          )}
        </div>
      </Panel>

      <div className="grid gap-6">
        <DistributionPanel gameStats={gameStats} inventoryValue={inventoryValue} />
        <TopCardsPanel topCards={topCards} />
      </div>
    </section>
  );
}

function NewCardTab({
  gameStats,
  inventoryValue,
  topCards
}: {
  gameStats: ReturnType<typeof getGameStats>;
  inventoryValue: number;
  topCards: TcgCard[];
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <NewCardPanel />
      <div className="grid gap-6">
        <Panel>
          <PanelHeader title="Como cadastrar melhor" text="Use a busca para escolher o print correto e evitar dados duplicados." />
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <p className="font-semibold text-[var(--ink)]">1. Escolha o jogo e busque pelo nome</p>
              <p className="mt-1 leading-6">A integração preenche coleção, raridade, imagem e preço médio quando disponível.</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <p className="font-semibold text-[var(--ink)]">2. Selecione o print exato</p>
              <p className="mt-1 leading-6">Prefira a versão com arte, acabamento e coleção corretos para reduzir retrabalho.</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <p className="font-semibold text-[var(--ink)]">3. Revise preço e estoque</p>
              <p className="mt-1 leading-6">O preço sugerido é referência de mercado; ajuste antes de publicar na vitrine.</p>
            </div>
          </div>
        </Panel>
        <DistributionPanel gameStats={gameStats} inventoryValue={inventoryValue} />
        <TopCardsPanel topCards={topCards} />
      </div>
    </section>
  );
}

function BuylistsTab({ submissions, openCount }: { submissions: BuylistSubmission[]; openCount: number }) {
  return (
    <Panel>
      <PanelHeader title="Cotações de buylist" text="Analise fotos, status e valor oferecido." badge={`${openCount} abertas`} tone="gold" />
      {submissions.length === 0 ? (
        <EmptyState icon={<Camera size={30} />} title="Nenhuma cotacao recebida" text="Os lotes enviados pelo site aparecem aqui." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{submission.customerName}</p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {submission.email} · {submission.game} · {formatDate(submission.createdAt)}
                  </p>
                </div>
                <StatusPill label={submission.status} />
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{submission.notes}</p>
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
                <input type="hidden" name="tab" value="buylists" />
                <select className={inputClass} name="status" defaultValue={submission.status}>
                  {buylistStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <input className={inputClass} name="offer" type="number" min="0" step="0.01" placeholder="Oferta" defaultValue={submission.offerCents === null ? "" : (submission.offerCents / 100).toFixed(2)} />
                <button className="h-11 rounded-lg bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
                  Salvar
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function OrdersTab({ orders }: { orders: OrderSummary[] }) {
  return (
    <Panel>
      <PanelHeader title="Pedidos" text="Acompanhe e atualize o status das compras." badge={`${orders.length} recentes`} />
      {orders.length === 0 ? (
        <EmptyState icon={<PackageCheck size={30} />} title="Nenhum pedido ainda" text="Os pedidos finalizados aparecem aqui." />
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <form key={order.id} action={updateOrderStatusAction} className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 md:grid-cols-[1fr_150px_92px] md:items-center">
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="tab" value="orders" />
              <div className="min-w-0">
                <p className="font-semibold">Pedido {order.id.slice(0, 8)}</p>
                <p className="truncate text-sm text-[var(--muted)]">
                  {order.customerEmail ?? "Cliente"} · {formatDate(order.createdAt)} · {order.itemCount} itens
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
  );
}

function CustomersTab({ customers }: { customers: AdminCustomer[] }) {
  const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpentCents, 0);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<UsersRound size={20} />} label="Clientes cadastrados" trend="base ativa" value={String(customers.length)} tone="cyan" />
        <MetricCard icon={<ShoppingBag size={20} />} label="Pedidos da base" trend="historico" value={String(customers.reduce((sum, customer) => sum + customer.orderCount, 0))} tone="green" />
        <MetricCard icon={<CircleDollarSign size={20} />} label="Receita vinculada" trend="por cliente" value={formatCurrency(totalSpent)} tone="orange" />
      </section>

      <Panel>
        <PanelHeader title="Clientes" text="Compras, buylists e papel de cada conta." badge={`${customers.length} contas`} />
        {customers.length === 0 ? (
          <EmptyState icon={<UsersRound size={30} />} title="Nenhum cliente no Neon" text="Cadastros e logins reais aparecem aqui quando o banco estiver configurado." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--line)]">
            <div className="hidden grid-cols-[minmax(220px,1fr)_120px_120px_140px_120px] gap-4 border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold uppercase text-[var(--muted)] lg:grid">
              <span>Cliente</span>
              <span>Pedidos</span>
              <span>Buylists</span>
              <span>Total</span>
              <span>Ultima compra</span>
            </div>
            {customers.map((customer) => (
              <div key={customer.id} className="grid gap-3 border-b border-[var(--line)] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_120px_120px_140px_120px] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{customer.name}</p>
                  <p className="truncate text-sm text-[var(--muted)]">{customer.email}</p>
                </div>
                <InfoValue label="Pedidos" value={String(customer.orderCount)} />
                <InfoValue label="Buylists" value={String(customer.buylistCount)} />
                <InfoValue label="Total" value={formatCurrency(customer.totalSpentCents)} />
                <InfoValue label="Ultima compra" value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "Sem compra"} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function InternalUsersTab({ users }: { users: AdminCustomer[] }) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<ShieldCheck size={20} />} label="Usuarios internos" trend="acesso admin" value={String(users.length)} tone="cyan" />
        <MetricCard icon={<ShoppingBag size={20} />} label="Pedidos criados" trend="pela conta" value={String(users.reduce((sum, user) => sum + user.orderCount, 0))} tone="green" />
        <MetricCard icon={<Camera size={20} />} label="Buylists enviadas" trend="pela conta" value={String(users.reduce((sum, user) => sum + user.buylistCount, 0))} tone="orange" />
      </section>

      <Panel>
        <PanelHeader title="Usuarios internos" text="Admins e contas de operacao ficam separadas da base de clientes." badge={`${users.length} contas internas`} />
        {users.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={30} />} title="Nenhum usuario interno encontrado" text="Contas com role admin aparecem aqui quando existirem no Neon." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--line)]">
            <div className="hidden grid-cols-[minmax(220px,1fr)_120px_140px_140px_140px] gap-4 border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold uppercase text-[var(--muted)] lg:grid">
              <span>Usuario</span>
              <span>Perfil</span>
              <span>Pedidos</span>
              <span>Buylists</span>
              <span>Criado em</span>
            </div>
            {users.map((user) => (
              <div key={user.id} className="grid gap-3 border-b border-[var(--line)] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_120px_140px_140px_140px] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.name}</p>
                  <p className="truncate text-sm text-[var(--muted)]">{user.email}</p>
                </div>
                <InfoValue label="Perfil" value={user.role} />
                <InfoValue label="Pedidos" value={String(user.orderCount)} />
                <InfoValue label="Buylists" value={String(user.buylistCount)} />
                <InfoValue label="Criado em" value={formatDate(user.createdAt)} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReportsTab({
  conditionStats,
  gameStats,
  inventoryValue,
  lowStockCards,
  orders,
  paidRevenue,
  statusStats,
  submissions
}: {
  conditionStats: ReturnType<typeof getConditionStats>;
  gameStats: ReturnType<typeof getGameStats>;
  inventoryValue: number;
  lowStockCards: TcgCard[];
  orders: OrderSummary[];
  paidRevenue: number;
  statusStats: ReturnType<typeof getStatusStats>;
  submissions: BuylistSubmission[];
}) {
  const conversionBase = Math.max(submissions.length, 1);
  const acceptedBuylists = submissions.filter((submission) => ["approved", "paid"].includes(submission.status)).length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CircleDollarSign size={20} />} label="Receita registrada" trend={`${orders.length} pedidos`} value={formatCurrency(paidRevenue)} tone="cyan" />
        <MetricCard icon={<Boxes size={20} />} label="Valor parado" trend="estoque atual" value={formatCurrency(inventoryValue)} tone="green" />
        <MetricCard icon={<ShieldCheck size={20} />} label="Risco de ruptura" trend="baixo estoque" value={String(lowStockCards.length)} tone="red" />
        <MetricCard icon={<Camera size={20} />} label="Conversao buylist" trend="aprovadas/pagas" value={`${Math.round((acceptedBuylists / conversionBase) * 100)}%`} tone="orange" />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ReportPanel title="Estoque por jogo" rows={gameStats.map((item) => ({ label: item.game, value: `${item.count} unidades`, percent: item.percent, className: item.barClass }))} />
        <ReportPanel title="Condição das cartas" rows={conditionStats.map((item) => ({ label: item.condition, value: `${item.count} unidades`, percent: item.percent, className: item.barClass }))} />
        <ReportPanel title="Status de pedidos" rows={statusStats.map((item) => ({ label: item.status, value: `${item.count} pedidos`, percent: item.percent, className: item.barClass }))} />
      </section>

      <Panel>
        <PanelHeader title="Recomendacoes imediatas" text="Leitura operacional a partir dos dados atuais." />
        <div className="grid gap-3 md:grid-cols-3">
          <PriorityCard href="/admin?tab=inventory&stock=low" label="Reposicao" value={String(lowStockCards.length)} text="Priorize singles com demanda e menos de 4 unidades." />
          <PriorityCard href="/admin?tab=buylists" label="Compra de colecoes" value={String(submissions.filter((item) => item.status === "new").length)} text="Novas buylists devem ser respondidas rapido para aumentar aceite." />
          <PriorityCard href="/admin?tab=orders" label="Operacao" value={String(orders.filter((item) => item.status === "pending").length)} text="Pedidos pendentes merecem primeiro contato ou pagamento." />
        </div>
      </Panel>
    </div>
  );
}

function SettingsTab({ cards, userEmail }: { cards: TcgCard[]; userEmail: string }) {
  const checks = [
    { label: "Neon Database", value: hasDatabase() ? "Conectado" : "Modo demo", ok: hasDatabase() },
    { label: "Admin logado", value: userEmail, ok: true },
    { label: "API de cartas", value: "/api/card-lookup", ok: true },
    { label: "Catalogo carregado", value: `${cards.length} cartas`, ok: cards.length > 0 }
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel>
        <PanelHeader title="Checklist de ambiente" text="Itens importantes antes de publicar ou operar no Vercel." />
        <div className="grid gap-3">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <div>
                <p className="font-semibold">{check.label}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{check.value}</p>
              </div>
              <span className={`rounded-lg px-3 py-2 text-xs font-bold ${check.ok ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-[var(--gold)]/15 text-[var(--gold)]"}`}>
                {check.ok ? "OK" : "Atencao"}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Deploy</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Variaveis esperadas para producao.</p>
          </div>
          <Database className="text-[var(--accent)]" size={20} />
        </div>
        <div className="space-y-3 text-sm">
          {["DATABASE_URL", "ADMIN_EMAIL"].map((item) => (
            <div key={item} className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3">
              <p className="font-semibold text-[var(--ink)]">{item}</p>
              <p className="mt-1 text-[var(--muted)]">Configure no painel do Vercel antes do deploy.</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function NewCardPanel() {
  return (
    <Panel>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Nova carta</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Cadastre uma carta direto no catalogo.</p>
        </div>
        <Plus className="text-[var(--accent)]" size={20} />
      </div>
      <form action={createCardAction} className="grid gap-3">
        <input type="hidden" name="tab" value="new-card" />
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
  );
}

function DistributionPanel({ gameStats, inventoryValue }: { gameStats: ReturnType<typeof getGameStats>; inventoryValue: number }) {
  return (
    <Panel>
      <PanelHeader title="Cartas por jogo" text="Barras horizontais para comparar volume sem distorção." />
      <div className="space-y-4">
        {gameStats.map((item) => (
          <DataBar
            key={item.game}
            accentClass={item.barClass}
            label={item.game}
            meta={`${item.percent}% do estoque`}
            percent={item.percent}
            value={`${item.count} un.`}
          />
        ))}
      </div>
      <div className="mt-6 flex items-end justify-between border-t border-[var(--line)] pt-5">
        <span className="text-sm text-[var(--muted)]">Valor total</span>
        <strong className="text-2xl font-semibold">{formatCurrency(inventoryValue)}</strong>
      </div>
    </Panel>
  );
}

function TopCardsPanel({ topCards }: { topCards: TcgCard[] }) {
  return (
    <Panel>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Cartas principais</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Maior valor por estoque.</p>
        </div>
        <TrendingUp className="text-[var(--accent)]" size={20} />
      </div>
      <div className="space-y-3">
        {topCards.map((card, index) => (
          <div key={card.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-xs font-bold text-[var(--accent)]">{index + 1}</span>
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
  );
}

function RecentOrdersPanel({ orders }: { orders: OrderSummary[] }) {
  return (
    <Panel>
      <PanelHeader title="Pedidos recentes" text="Ultimas compras criadas no site." />
      {orders.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={30} />} title="Nenhum pedido recente" text="Pedidos finalizados aparecem aqui." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="min-w-0">
                <p className="font-semibold">Pedido {order.id.slice(0, 8)}</p>
                <p className="truncate text-sm text-[var(--muted)]">{order.customerEmail ?? "Cliente"} · {order.itemCount} itens</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(order.subtotalCents)}</p>
                <p className="text-xs text-[var(--muted)]">{order.status}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function InventoryRow({ card }: { card: TcgCard }) {
  const secondFaceUrl = resolveCardBackImageUrl(card);
  const hasSecondFace = cardHasSecondFace(card);
  const zoomUrls = [card.imageUrl, secondFaceUrl].filter((url): url is string => Boolean(url));

  return (
    <form action={updateCardAction} className="group grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3 transition hover:border-[var(--accent)]/45 hover:bg-[var(--surface-elevated)]">
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="tab" value="inventory" />

      <div className="grid min-w-0 gap-4 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
        <div
          aria-label={`${card.name}. Passe o mouse para ampliar.`}
          className="group/preview relative h-28 w-[88px] overflow-visible rounded-lg outline-none"
          tabIndex={0}
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <Image src={card.imageUrl} alt={card.name} fill unoptimized sizes="88px" className="object-cover" />
          </div>
          <div className={`pointer-events-none absolute left-full top-1/2 z-50 ml-4 hidden -translate-y-1/2 scale-95 gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 opacity-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ring-[var(--accent)]/25 transition duration-200 group-hover/preview:scale-100 group-hover/preview:opacity-100 group-focus/preview:scale-100 group-focus/preview:opacity-100 md:grid ${hasSecondFace ? "grid-cols-2" : "grid-cols-1"}`}>
            {zoomUrls.map((url, index) => (
              <div key={`${card.id}-${index}`} className="relative aspect-[5/7] w-[min(240px,34vw)] overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)]">
                <Image
                  src={url}
                  alt={index === 0 ? `${card.name} frente ampliada` : `${card.name} segunda face ampliada`}
                  fill
                  unoptimized
                  sizes="240px"
                  className="object-cover"
                />
                {index === 1 ? (
                  <span className="absolute left-2 top-2 rounded-md bg-[var(--accent)]/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                    Face 2
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-bold text-[var(--accent)]">{card.game}</span>
              <span className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">{card.language}</span>
              <span className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">{card.finish}</span>
            </div>
            <p className="truncate text-base font-semibold text-[var(--ink)]" title={card.name}>{card.name}</p>
            <p className="truncate text-sm text-[var(--muted)]" title={`${card.setName} · ${card.rarity}`}>
              {card.setName} · {card.rarity}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs min-[520px]:grid-cols-3">
            <InventoryStat
              label="Mercado"
              value={
                card.game === "Magic" && card.marketPriceCents > 0
                  ? formatUsd(card.marketPriceCents)
                  : formatCurrency(card.marketPriceCents)
              }
            />
            <InventoryStat label="Total" value={formatCurrency(card.stock * card.priceCents)} />
            <InventoryStat label="Estoque" value={`${card.stock} un.`} />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 min-[760px]:grid-cols-[minmax(140px,1fr)_110px_130px_112px_52px] min-[760px]:items-end">
        <FieldLabel label="Preco"><input className={inputClass} name="price" type="number" min="0" step="0.01" defaultValue={(card.priceCents / 100).toFixed(2)} /></FieldLabel>
        <FieldLabel label="Estoque"><input className={inputClass} name="stock" type="number" min="0" step="1" defaultValue={card.stock} /></FieldLabel>
        <FieldLabel label="Condicao">
          <select className={inputClass} name="condition" defaultValue={card.condition}>
            {conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </FieldLabel>
        <button className="h-11 w-full rounded-lg bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)] active:scale-95" type="submit">
          Salvar
        </button>
        <button
          aria-label={`Excluir ${card.name} do estoque`}
          className="grid h-11 w-full place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 active:scale-95"
          formAction={deleteCardAction}
          title="Excluir do estoque"
          type="submit"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </form>
  );
}

function InventoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-soft)] p-8 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-[var(--surface)] text-[var(--muted)]">{icon}</span>
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

function NavItem({ active, badge, href, icon, label }: { active?: boolean; badge?: number; href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 transition ${
        active
          ? "bg-[var(--accent)]/10 text-[var(--ink)] ring-1 ring-[var(--accent)]/25"
          : "hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
      }`}
      href={href}
    >
      <span className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      {badge ? (
        <span className="rounded-[0.45rem] bg-[var(--accent)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="surface-card p-5 lg:p-6">{children}</div>;
}

function PanelHeader({ badge, text, title, tone = "muted" }: { badge?: string; text: string; title: string; tone?: "muted" | "gold" }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
      </div>
      {badge ? (
        <span className={`w-fit rounded-[var(--radius-control)] bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold ${tone === "gold" ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function MetricCard({ icon, label, trend, value, tone }: { icon: ReactNode; label: string; trend: string; value: string; tone: "cyan" | "green" | "orange" | "red" }) {
  const toneClass = {
    cyan: "text-teal-700 bg-teal-50",
    green: "text-emerald-700 bg-emerald-50",
    orange: "text-amber-700 bg-amber-50",
    red: "text-rose-700 bg-rose-50"
  }[tone];

  return (
    <div className="surface-card p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
        <span className={`grid h-11 w-11 place-items-center rounded-[var(--radius-control)] ${toneClass}`}>{icon}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <strong className="text-3xl font-semibold tracking-tight text-[var(--ink)]">{value}</strong>
        <span className="pb-1 text-sm font-semibold text-[var(--accent)]">{trend}</span>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function PriorityCard({ href, label, text, value }: { href: string; label: string; text: string; value: string }) {
  return (
    <Link className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]/60" href={href}>
      <strong className="text-3xl tracking-tight">{value}</strong>
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </Link>
  );
}

function ReportPanel({ rows, title }: { rows: Array<{ className: string; label: string; percent: number; value: string }>; title: string }) {
  return (
    <Panel>
      <PanelHeader title={title} text="Comparação objetiva por volume." />
      <div className="space-y-4">
        {rows.map((row) => (
          <DataBar key={row.label} accentClass={row.className} label={row.label} meta={`${row.percent}%`} percent={row.percent} value={row.value} />
        ))}
      </div>
    </Panel>
  );
}

function DataBar({ accentClass, label, meta, percent, value }: { accentClass: string; label: string; meta: string; percent: number; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{meta}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[var(--ink)]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${Math.max(percent, 3)}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className="w-fit rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">{label}</span>;
}

function FieldLabel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-xs text-[var(--muted)] lg:hidden">{label}</span>
      <p className="truncate text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function getNavItems(openSubmissions: number, pendingOrders: number) {
  return [
    { tab: "overview" as const, icon: <Gauge size={19} />, label: "Overview" },
    { tab: "inventory" as const, icon: <Layers3 size={19} />, label: "Inventário" },
    { tab: "new-card" as const, icon: <Plus size={19} />, label: "Nova carta" },
    { tab: "buylists" as const, icon: <ClipboardList size={19} />, label: "Buylists", badge: openSubmissions },
    { tab: "orders" as const, icon: <ShoppingBag size={19} />, label: "Pedidos", badge: pendingOrders },
    { tab: "customers" as const, icon: <UsersRound size={19} />, label: "Clientes" },
    { tab: "internal-users" as const, icon: <ShieldCheck size={19} />, label: "Usuários internos" },
    { tab: "reports" as const, icon: <BarChart3 size={19} />, label: "Relatórios" },
    { tab: "settings" as const, icon: <Settings size={19} />, label: "Ajustes" }
  ];
}

function getGameStats(cards: Array<{ game: Game; stock: number }>) {
  const items: Array<{ game: Game; barClass: string }> = [
    { game: "Magic", barClass: "bg-[var(--accent)]" },
    { game: "Pokemon", barClass: "bg-[var(--gold)]" },
    { game: "Yu-Gi-Oh!", barClass: "bg-sky-500" }
  ];
  const total = Math.max(cards.reduce((sum, card) => sum + card.stock, 0), 1);

  return items.map((item) => {
    const count = cards
      .filter((card) => card.game === item.game)
      .reduce((sum, card) => sum + card.stock, 0);
    return { ...item, count, percent: Math.round((count / total) * 100) };
  });
}

function getConditionStats(cards: Array<{ condition: CardCondition; stock: number }>) {
  const items: Array<{ condition: CardCondition; barClass: string }> = [
    { condition: "NM", barClass: "bg-[var(--accent)]" },
    { condition: "SP", barClass: "bg-[var(--gold)]" },
    { condition: "MP", barClass: "bg-orange-400" },
    { condition: "HP", barClass: "bg-red-400" }
  ];
  const total = Math.max(cards.reduce((sum, card) => sum + card.stock, 0), 1);

  return items.map((item) => {
    const count = cards
      .filter((card) => card.condition === item.condition)
      .reduce((sum, card) => sum + card.stock, 0);
    return { ...item, count, percent: Math.round((count / total) * 100) };
  });
}

function getStatusStats(orders: Array<{ status: string }>) {
  const statuses = ["pending", "paid", "shipped", "delivered", "cancelled"];
  const colors = ["bg-[var(--gold)]", "bg-[var(--accent)]", "bg-cyan-400", "bg-emerald-400", "bg-red-400"];
  const total = Math.max(orders.length, 1);

  return statuses.map((status, index) => {
    const count = orders.filter((order) => order.status === status).length;
    return { status, count, percent: Math.round((count / total) * 100), barClass: colors[index] };
  });
}

function normalizeTab(value: string | string[] | undefined): AdminTab {
  return typeof value === "string" && tabs.includes(value as AdminTab) ? (value as AdminTab) : "overview";
}

function normalizeGame(value: string | string[] | undefined): FilterGame {
  return typeof value === "string" && (value === "Magic" || value === "Pokemon" || value === "Yu-Gi-Oh!") ? value : "Todos";
}

function normalizeStock(value: string | string[] | undefined): "all" | "low" | "out" {
  return typeof value === "string" && (value === "low" || value === "out") ? value : "all";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function messageFor(code: string) {
  const messages: Record<string, string> = {
    "card-updated": "Carta atualizada com sucesso.",
    "card-created": "Carta cadastrada com sucesso.",
    "card-deleted": "Carta removida do estoque.",
    "buylist-updated": "Cotacao atualizada com sucesso.",
    "order-updated": "Pedido atualizado com sucesso.",
    "demo-no-db": "Modo demo ativo. Configure o Neon para persistir esta alteracao.",
    unauthorized: "Acesso restrito a administradores.",
    "invalid-card": "Dados da carta invalidos.",
    "invalid-new-card": "Selecione um print real retornado pela busca antes de cadastrar.",
    "invalid-buylist": "Dados da cotacao invalidos.",
    "invalid-order": "Status do pedido invalido.",
    "no-db": "Banco indisponivel."
  };

  return messages[code] ?? code;
}

const inputClass =
  "field-input h-11 w-full min-w-0 rounded-[var(--radius-control)] px-3 text-sm placeholder:text-[var(--muted)]";
const inputClassWithIcon =
  "field-input h-11 w-full rounded-[var(--radius-control)] pl-10 pr-3 text-sm placeholder:text-[var(--muted)]";
