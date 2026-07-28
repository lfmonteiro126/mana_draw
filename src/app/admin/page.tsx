import {
  AlertCircle,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
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
  Store,
  Trash2,
  TrendingUp,
  UsersRound
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  deleteCardAction,
  updateBuylistAction,
  updateCardAction,
  updateOrderStatusAction
} from "@/app/actions";
import { BuylistPhotoGallery } from "@/components/admin/buylist-photo-gallery";
import { NewCardEntry } from "@/components/admin/new-card-entry";
import {
  AlertBanner,
  DataBar,
  EmptyState,
  FieldLabel,
  FilterChip,
  HeroStat,
  InfoValue,
  MetricCard,
  NavItem,
  NavSection,
  Panel,
  PanelHeader,
  PriorityCard,
  StatusBadge,
  adminInputClass,
  adminInputWithIconClass
} from "@/components/admin/ui";
import { AuthPanel } from "@/components/auth-panel";
import { OrderCard } from "@/components/order-card";
import { currentUser } from "@/lib/auth";
import { buylistStatusLabels, buylistStatusStyles } from "@/lib/buylist-ui";
import { cardHasSecondFace, resolveCardBackImageUrl } from "@/lib/card-images";
import {
  getAdminCards,
  getAdminCustomers,
  getAdminOrders,
  getBuylistSubmissions,
  hasDatabase
} from "@/lib/db";
import { formatCurrency, formatUsd } from "@/lib/format";
import { orderStatusLabels, orderStatusStyles } from "@/lib/orders-ui";
import type {
  AdminCustomer,
  BuylistSubmission,
  CardCondition,
  FilterGame,
  Game,
  OrderSummary,
  TcgCard
} from "@/lib/types";

const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const buylistStatuses = ["new", "reviewing", "approved", "declined", "paid"] as const;
const orderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
const tabs = [
  "overview",
  "inventory",
  "new-card",
  "buylists",
  "orders",
  "customers",
  "internal-users",
  "reports",
  "settings"
] as const;

type AdminTab = (typeof tabs)[number];

const tabLabels: Record<AdminTab, { title: string; description: string }> = {
  overview: {
    title: "Visão geral",
    description: "Resumo operacional de estoque, pedidos e cotações."
  },
  inventory: {
    title: "Inventário",
    description: "Busque, filtre e ajuste preço, estoque e condição das cartas."
  },
  "new-card": {
    title: "Nova carta",
    description: "Cadastre singles uma a uma ou importe lotes CSV/TXT do ManaBox."
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
    description: "Contas admin e de operação da loja."
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
  const orderFilter = normalizeOrderFilter(params.status);
  const buylistFilter = normalizeBuylistFilter(params.status);

  if (user?.role !== "admin") {
    return (
      <main className="admin-console min-h-screen px-4 py-10 text-[var(--ink)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-lg">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
            href="/"
          >
            <ChevronLeft size={16} />
            Voltar para loja
          </Link>
          <div className="surface-card mt-8 overflow-hidden">
            <div className="border-b border-[var(--line)] bg-[var(--surface-soft)]/80 px-6 py-6 sm:px-8">
              <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-bold text-white shadow-[0_8px_18px_rgba(15,159,144,0.28)]">
                MD
              </span>
              <p className="mt-4 text-2xl font-semibold tracking-tight">Mana Draw Admin</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Entre com uma conta admin para gerenciar estoque, preços, pedidos e cotações.
              </p>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <AuthPanel redirectTo="/admin" />
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                Demo local sem Neon: <span className="font-medium text-[var(--ink)]">admin@manadraw.local</span> /{" "}
                <span className="font-medium text-[var(--ink)]">admin123</span>
              </p>
            </div>
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
  const lowStockCards = allCards.filter((card) => card.stock > 0 && card.stock <= 3);
  const outOfStockCards = allCards.filter((card) => card.stock === 0);
  const openSubmissions = submissions.filter((submission) =>
    ["new", "reviewing"].includes(submission.status)
  );
  const pendingOrders = orders.filter((order) => order.status === "pending");
  const paidRevenue = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + (order.totalCents || order.subtotalCents), 0);
  const topCards = [...allCards]
    .sort((a, b) => b.stock * b.priceCents - a.stock * a.priceCents)
    .slice(0, 5);
  const gameStats = getGameStats(allCards);
  const conditionStats = getConditionStats(allCards);
  const statusStats = getStatusStats(orders);
  const customerAccounts = customers.filter((customer) => customer.role === "customer");
  const internalUsers = customers.filter((customer) => customer.role !== "customer");
  const navGroups = getNavGroups(openSubmissions.length, pendingOrders.length);
  const page = tabLabels[activeTab];
  const initials = userInitials(user.name || user.email);
  const alertCount = openSubmissions.length + pendingOrders.length;

  return (
    <main className="admin-console min-h-screen text-[var(--ink)]">
      <div className="grid min-h-screen lg:grid-cols-[272px_1fr]">
        <aside className="hidden border-r border-[var(--line)] bg-white/95 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex h-[76px] items-center gap-3 border-b border-[var(--line)] px-5">
            <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-bold text-white shadow-[0_8px_18px_rgba(15,159,144,0.28)]">
              MD
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight">Mana Draw</p>
              <p className="text-xs text-[var(--muted)]">Console admin</p>
            </div>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => (
              <NavSection key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <NavItem
                    key={item.tab}
                    active={activeTab === item.tab}
                    badge={item.badge}
                    href={`/admin?tab=${item.tab}`}
                    icon={item.icon}
                    label={item.label}
                  />
                ))}
              </NavSection>
            ))}
          </nav>

          <div className="space-y-2 border-t border-[var(--line)] p-4">
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name || "Admin"}</p>
                <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
              </div>
            </div>
            <Link
              className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              href="/"
            >
              <Store size={18} />
              Abrir loja
            </Link>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-7">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{page.title}</h1>
                <p className="mt-1 hidden text-sm text-[var(--muted)] sm:block">{page.description}</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <form action="/admin" className="relative hidden w-[260px] xl:block" method="get">
                  <input type="hidden" name="tab" value="inventory" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
                  <input
                    className={adminInputWithIconClass}
                    name="query"
                    placeholder="Buscar no inventário…"
                    defaultValue={activeTab === "inventory" ? query : ""}
                  />
                </form>
                <Link
                  className="hidden h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-soft)] sm:inline-flex"
                  href="/"
                >
                  <Store size={16} />
                  Loja
                </Link>
                <Link
                  className="relative grid h-11 w-11 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-soft)]"
                  href="/admin?tab=buylists&status=new"
                  aria-label={`${alertCount} pendências`}
                  title="Pendências"
                >
                  <Bell size={18} />
                  {alertCount > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  ) : null}
                </Link>
                <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-bold text-white lg:hidden">
                  {initials}
                </span>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-4 py-3 scrollbar-none lg:hidden">
              {navGroups.flatMap((group) => group.items).map((item) => (
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
              <AlertBanner tone={error ? "error" : "success"}>
                <span className="inline-flex items-center gap-2">
                  {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  {messageFor(error || notice)}
                </span>
              </AlertBanner>
            )}

            {activeTab === "overview" && (
              <OverviewTab
                cards={allCards}
                gameStats={gameStats}
                inventoryValue={inventoryValue}
                lowStockCards={lowStockCards}
                openSubmissions={openSubmissions}
                orders={orders}
                outOfStockCount={outOfStockCards.length}
                paidRevenue={paidRevenue}
                pendingOrders={pendingOrders}
                submissions={submissions}
                topCards={topCards}
                totalStock={totalStock}
              />
            )}
            {activeTab === "inventory" && (
              <InventoryTab
                cards={cards}
                game={game}
                gameStats={gameStats}
                inventoryValue={inventoryValue}
                query={query}
                stock={stock}
                topCards={topCards}
              />
            )}
            {activeTab === "new-card" && (
              <NewCardTab gameStats={gameStats} inventoryValue={inventoryValue} topCards={topCards} />
            )}
            {activeTab === "buylists" && (
              <BuylistsTab filter={buylistFilter} openCount={openSubmissions.length} submissions={submissions} />
            )}
            {activeTab === "orders" && <OrdersTab filter={orderFilter} orders={orders} />}
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
  outOfStockCount,
  paidRevenue,
  pendingOrders,
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
  outOfStockCount: number;
  paidRevenue: number;
  pendingOrders: OrderSummary[];
  submissions: BuylistSubmission[];
  topCards: TcgCard[];
  totalStock: number;
}) {
  const priorityCount = lowStockCards.length + openSubmissions.length + pendingOrders.length;

  return (
    <div className="grid gap-6">
      <section className="surface-card overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-bold text-[var(--accent)]">
                Painel do dia
              </span>
              <span className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">
                {cards.length} prints ativos
              </span>
            </div>
            <h2 className="mt-5 max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-3xl">
              Estoque, compra e venda em uma leitura rápida.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Priorize reposição, responda buylists e acompanhe pedidos sem perder o contexto do inventário.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <HeroStat label="Estoque total" value={`${totalStock} un.`} />
            <HeroStat label="Valor parado" value={formatCurrency(inventoryValue)} />
            <HeroStat label="Cotações abertas" value={String(openSubmissions.length)} />
            <HeroStat label="Pedidos pendentes" value={String(pendingOrders.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<CircleDollarSign size={20} />}
          label="Valor em estoque"
          hint="Soma de preço × unidades"
          value={formatCurrency(inventoryValue)}
          tone="cyan"
        />
        <MetricCard
          icon={<Boxes size={20} />}
          label="Cartas ativas"
          hint={`${totalStock} unidades · ${outOfStockCount} sem estoque`}
          value={String(cards.length)}
          tone="green"
        />
        <MetricCard
          icon={<Camera size={20} />}
          label="Cotações abertas"
          hint={`${submissions.length} recebidas no total`}
          value={String(openSubmissions.length)}
          tone="orange"
        />
        <MetricCard
          icon={<ShoppingBag size={20} />}
          label="Receita em pedidos"
          hint={`${orders.length} pedidos recentes`}
          value={formatCurrency(paidRevenue)}
          tone="red"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <Panel>
          <PanelHeader
            title="Prioridades de hoje"
            text="Ações que impactam compra, cotação e reposição."
            badge={`${priorityCount} pendências`}
            tone={priorityCount > 0 ? "gold" : "muted"}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <PriorityCard
              href="/admin?tab=inventory&stock=low"
              label="Repor estoque baixo"
              value={String(lowStockCards.length)}
              text="Cartas com 1 a 3 unidades."
              urgent={lowStockCards.length > 0}
            />
            <PriorityCard
              href="/admin?tab=buylists&status=new"
              label="Responder cotações"
              value={String(openSubmissions.length)}
              text="Lotes novos ou em análise."
              urgent={openSubmissions.length > 0}
            />
            <PriorityCard
              href="/admin?tab=orders&status=pending"
              label="Atualizar pedidos"
              value={String(pendingOrders.length)}
              text="Compras ainda pendentes de pagamento."
              urgent={pendingOrders.length > 0}
            />
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
        <PanelHeader
          title="Inventário"
          text="Cards consolidados por print, condição, idioma e acabamento."
          badge={`${cards.length} itens`}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <FilterChip active={stock === "all"} href={inventoryHref({ query, game, stock: "all" })} label="Todos" />
          <FilterChip active={stock === "low"} href={inventoryHref({ query, game, stock: "low" })} label="Baixo estoque" />
          <FilterChip active={stock === "out"} href={inventoryHref({ query, game, stock: "out" })} label="Sem estoque" />
          {games.map((item) => (
            <FilterChip
              key={item}
              active={game === item}
              href={inventoryHref({ query, game: item, stock })}
              label={item}
            />
          ))}
        </div>

        <form action="/admin" className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] p-3 md:grid-cols-[1fr_auto]" method="get">
          <input type="hidden" name="tab" value="inventory" />
          <input type="hidden" name="game" value={game} />
          <input type="hidden" name="stock" value={stock} />
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input
              className={adminInputWithIconClass}
              name="query"
              placeholder="Buscar carta, coleção ou tag"
              defaultValue={query}
            />
          </label>
          <button
            className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
            type="submit"
          >
            Buscar
          </button>
        </form>

        <div className="grid gap-3">
          {cards.length === 0 ? (
            <EmptyState
              icon={<Search size={28} />}
              title="Nenhuma carta encontrada"
              text="Ajuste os filtros ou cadastre uma nova carta."
              action={
                <Link
                  className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
                  href="/admin?tab=new-card"
                >
                  Cadastrar carta
                </Link>
              }
            />
          ) : (
            cards.map((card) => <InventoryRow key={card.id} card={card} />)
          )}
        </div>
      </Panel>

      <div className="grid gap-6 self-start xl:sticky xl:top-24">
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
      <div className="grid gap-6 self-start xl:sticky xl:top-24">
        <Panel>
          <PanelHeader title="Como cadastrar melhor" text="Use a busca unitária ou o lote ManaBox com prévia Scryfall." />
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            {[
              ["1. Uma carta", "Busque o nome, escolha o print e revise preço BRL antes de publicar."],
              ["2. Em lote (ManaBox)", "Exporte CSV/TXT no app, pré-visualize matches no Scryfall e importe só o que estiver OK."],
              ["3. Preço de venda", "Mercado Scryfall fica em USD; venda é BRL — no lote pode deixar R$ 0 e ajustar no inventário."]
            ].map(([title, text]) => (
              <div key={title} className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                <p className="font-semibold text-[var(--ink)]">{title}</p>
                <p className="mt-1 leading-6">{text}</p>
              </div>
            ))}
          </div>
        </Panel>
        <DistributionPanel gameStats={gameStats} inventoryValue={inventoryValue} />
        <TopCardsPanel topCards={topCards} />
      </div>
    </section>
  );
}

function BuylistsTab({
  submissions,
  openCount,
  filter
}: {
  submissions: BuylistSubmission[];
  openCount: number;
  filter: "all" | (typeof buylistStatuses)[number];
}) {
  const filtered =
    filter === "all" ? submissions : submissions.filter((item) => item.status === filter);

  return (
    <Panel>
      <PanelHeader
        title="Cotações de buylist"
        text="Analise fotos, status e valor oferecido."
        badge={`${openCount} abertas`}
        tone="gold"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip
          active={filter === "all"}
          count={submissions.length}
          href="/admin?tab=buylists"
          label="Todas"
        />
        {buylistStatuses.map((status) => (
          <FilterChip
            key={status}
            active={filter === status}
            count={submissions.filter((item) => item.status === status).length}
            href={`/admin?tab=buylists&status=${status}`}
            label={buylistStatusLabels[status]}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Camera size={28} />}
          title={submissions.length === 0 ? "Nenhuma cotação recebida" : "Nenhuma cotação neste filtro"}
          text={
            submissions.length === 0
              ? "Os lotes enviados pelo site aparecem aqui."
              : "Troque o filtro para ver outras cotações."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((submission) => (
            <article
              key={submission.id}
              className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--ink)]">{submission.customerName}</p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {submission.email} · {submission.game} · {formatDate(submission.createdAt)}
                  </p>
                </div>
                <StatusBadge
                  label={buylistStatusLabels[submission.status] ?? submission.status}
                  className={buylistStatusStyles[submission.status]}
                />
              </div>
              {submission.notes ? (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{submission.notes}</p>
              ) : null}
              <BuylistPhotoGallery
                customerName={submission.customerName}
                photos={submission.photoUrls}
              />
              <form action={updateBuylistAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                <input type="hidden" name="id" value={submission.id} />
                <input type="hidden" name="tab" value="buylists" />
                <select className={adminInputClass} name="status" defaultValue={submission.status}>
                  {buylistStatuses.map((item) => (
                    <option key={item} value={item}>
                      {buylistStatusLabels[item]}
                    </option>
                  ))}
                </select>
                <input
                  className={adminInputClass}
                  name="offer"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Oferta R$"
                  defaultValue={
                    submission.offerCents === null ? "" : (submission.offerCents / 100).toFixed(2)
                  }
                />
                <button
                  className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
                  type="submit"
                >
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

function OrdersTab({
  orders,
  filter
}: {
  orders: OrderSummary[];
  filter: "all" | (typeof orderStatuses)[number];
}) {
  const pending = orders.filter((order) => order.status === "pending").length;
  const paid = orders.filter((order) => order.status === "paid").length;
  const filtered = filter === "all" ? orders : orders.filter((order) => order.status === filter);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={<PackageCheck size={20} />}
          label="Recentes"
          hint="Últimos pedidos carregados"
          value={String(orders.length)}
          tone="cyan"
        />
        <MetricCard
          icon={<ShoppingBag size={20} />}
          label="Pendentes"
          hint="Aguardando pagamento ou ação"
          value={String(pending)}
          tone="orange"
        />
        <MetricCard
          icon={<CheckCircle2 size={20} />}
          label="Pagos"
          hint="Prontos para envio"
          value={String(paid)}
          tone="green"
        />
      </section>

      <Panel>
        <PanelHeader
          title="Pedidos"
          text="Detalhes, frete, pagamento e atualização de status."
          badge={`${filtered.length} exibidos`}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} count={orders.length} href="/admin?tab=orders" label="Todos" />
          {orderStatuses.map((status) => (
            <FilterChip
              key={status}
              active={filter === status}
              count={orders.filter((order) => order.status === status).length}
              href={`/admin?tab=orders&status=${status}`}
              label={orderStatusLabels[status]}
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<PackageCheck size={28} />}
            title={orders.length === 0 ? "Nenhum pedido ainda" : "Nenhum pedido neste filtro"}
            text={
              orders.length === 0
                ? "Os pedidos finalizados aparecem aqui."
                : "Troque o filtro para ver outros status."
            }
          />
        ) : (
          <div className="grid gap-4">
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showCustomer
                footer={
                  <form
                    action={updateOrderStatusAction}
                    className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="tab" value="orders" />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">
                        Status do pedido
                      </span>
                      <select className={adminInputClass} name="status" defaultValue={order.status}>
                        {orderStatuses.map((item) => (
                          <option key={item} value={item}>
                            {orderStatusLabels[item] ?? item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                      type="submit"
                    >
                      Atualizar status
                    </button>
                  </form>
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CustomersTab({ customers }: { customers: AdminCustomer[] }) {
  const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpentCents, 0);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<UsersRound size={20} />}
          label="Clientes cadastrados"
          hint="Base ativa no Neon"
          value={String(customers.length)}
          tone="cyan"
        />
        <MetricCard
          icon={<ShoppingBag size={20} />}
          label="Pedidos da base"
          hint="Histórico consolidado"
          value={String(customers.reduce((sum, customer) => sum + customer.orderCount, 0))}
          tone="green"
        />
        <MetricCard
          icon={<CircleDollarSign size={20} />}
          label="Receita vinculada"
          hint="Soma por cliente"
          value={formatCurrency(totalSpent)}
          tone="orange"
        />
      </section>

      <Panel>
        <PanelHeader title="Clientes" text="Compras, buylists e atividade de cada conta." badge={`${customers.length} contas`} />
        {customers.length === 0 ? (
          <EmptyState
            icon={<UsersRound size={28} />}
            title="Nenhum cliente no Neon"
            text="Cadastros e logins reais aparecem aqui quando o banco estiver configurado."
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)]">
            <div className="hidden grid-cols-[minmax(220px,1fr)_100px_100px_140px_130px] gap-4 border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] lg:grid">
              <span>Cliente</span>
              <span>Pedidos</span>
              <span>Buylists</span>
              <span>Total</span>
              <span>Última compra</span>
            </div>
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="grid gap-3 border-b border-[var(--line)] px-4 py-4 last:border-b-0 hover:bg-[var(--surface-soft)]/70 lg:grid-cols-[minmax(220px,1fr)_100px_100px_140px_130px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-xs font-bold text-[var(--accent)]">
                    {userInitials(customer.name || customer.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{customer.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{customer.email}</p>
                  </div>
                </div>
                <InfoValue label="Pedidos" value={String(customer.orderCount)} />
                <InfoValue label="Buylists" value={String(customer.buylistCount)} />
                <InfoValue label="Total" value={formatCurrency(customer.totalSpentCents)} />
                <InfoValue
                  label="Última compra"
                  value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "Sem compra"}
                />
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
        <MetricCard
          icon={<ShieldCheck size={20} />}
          label="Usuários internos"
          hint="Acesso admin"
          value={String(users.length)}
          tone="cyan"
        />
        <MetricCard
          icon={<ShoppingBag size={20} />}
          label="Pedidos criados"
          hint="Pela conta interna"
          value={String(users.reduce((sum, user) => sum + user.orderCount, 0))}
          tone="green"
        />
        <MetricCard
          icon={<Camera size={20} />}
          label="Buylists enviadas"
          hint="Pela conta interna"
          value={String(users.reduce((sum, user) => sum + user.buylistCount, 0))}
          tone="orange"
        />
      </section>

      <Panel>
        <PanelHeader
          title="Usuários internos"
          text="Admins e contas de operação ficam separados da base de clientes."
          badge={`${users.length} contas`}
        />
        {users.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={28} />}
            title="Nenhum usuário interno encontrado"
            text="Contas com role admin aparecem aqui quando existirem no Neon."
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)]">
            <div className="hidden grid-cols-[minmax(220px,1fr)_120px_100px_100px_140px] gap-4 border-b border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] lg:grid">
              <span>Usuário</span>
              <span>Perfil</span>
              <span>Pedidos</span>
              <span>Buylists</span>
              <span>Criado em</span>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                className="grid gap-3 border-b border-[var(--line)] px-4 py-4 last:border-b-0 hover:bg-[var(--surface-soft)]/70 lg:grid-cols-[minmax(220px,1fr)_120px_100px_100px_140px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white">
                    {userInitials(user.name || user.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{user.email}</p>
                  </div>
                </div>
                <InfoValue label="Perfil" value={user.role === "admin" ? "Admin" : user.role} />
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
  const acceptedBuylists = submissions.filter((submission) =>
    ["approved", "paid"].includes(submission.status)
  ).length;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<CircleDollarSign size={20} />}
          label="Receita registrada"
          hint={`${orders.length} pedidos`}
          value={formatCurrency(paidRevenue)}
          tone="cyan"
        />
        <MetricCard
          icon={<Boxes size={20} />}
          label="Valor parado"
          hint="Estoque atual"
          value={formatCurrency(inventoryValue)}
          tone="green"
        />
        <MetricCard
          icon={<ShieldCheck size={20} />}
          label="Risco de ruptura"
          hint="Baixo estoque"
          value={String(lowStockCards.length)}
          tone="red"
        />
        <MetricCard
          icon={<Camera size={20} />}
          label="Conversão buylist"
          hint="Aprovadas / pagas"
          value={`${Math.round((acceptedBuylists / conversionBase) * 100)}%`}
          tone="orange"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ReportPanel
          title="Estoque por jogo"
          rows={gameStats.map((item) => ({
            label: item.game,
            value: `${item.count} unidades`,
            percent: item.percent,
            className: item.barClass
          }))}
        />
        <ReportPanel
          title="Condição das cartas"
          rows={conditionStats.map((item) => ({
            label: item.condition,
            value: `${item.count} unidades`,
            percent: item.percent,
            className: item.barClass
          }))}
        />
        <ReportPanel
          title="Status de pedidos"
          rows={statusStats.map((item) => ({
            label: orderStatusLabels[item.status] ?? item.status,
            value: `${item.count} pedidos`,
            percent: item.percent,
            className: item.barClass
          }))}
        />
      </section>

      <Panel>
        <PanelHeader title="Recomendações imediatas" text="Leitura operacional a partir dos dados atuais." />
        <div className="grid gap-3 md:grid-cols-3">
          <PriorityCard
            href="/admin?tab=inventory&stock=low"
            label="Reposição"
            value={String(lowStockCards.length)}
            text="Priorize singles com demanda e menos de 4 unidades."
            urgent={lowStockCards.length > 0}
          />
          <PriorityCard
            href="/admin?tab=buylists&status=new"
            label="Compra de coleções"
            value={String(submissions.filter((item) => item.status === "new").length)}
            text="Novas buylists devem ser respondidas rápido para aumentar aceite."
            urgent={submissions.some((item) => item.status === "new")}
          />
          <PriorityCard
            href="/admin?tab=orders&status=pending"
            label="Operação"
            value={String(orders.filter((item) => item.status === "pending").length)}
            text="Pedidos pendentes merecem primeiro contato ou confirmação de pagamento."
            urgent={orders.some((item) => item.status === "pending")}
          />
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
    { label: "Catálogo carregado", value: `${cards.length} cartas`, ok: cards.length > 0 }
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel>
        <PanelHeader title="Checklist de ambiente" text="Itens importantes antes de publicar ou operar no Vercel." />
        <div className="grid gap-3">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">{check.label}</p>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">{check.value}</p>
              </div>
              <span
                className={`shrink-0 rounded-[var(--radius-control)] px-3 py-2 text-xs font-bold ${
                  check.ok
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "bg-[var(--gold)]/15 text-[var(--gold)]"
                }`}
              >
                {check.ok ? "OK" : "Atenção"}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Deploy</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Variáveis esperadas para produção.</p>
          </div>
          <Database className="text-[var(--accent)]" size={20} />
        </div>
        <div className="space-y-3 text-sm">
          {["DATABASE_URL", "ADMIN_EMAIL"].map((item) => (
            <div key={item} className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-3">
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
          <p className="mt-1 text-sm text-[var(--muted)]">
            Cadastro unitário ou importação em lote via ManaBox (CSV/TXT).
          </p>
        </div>
        <Plus className="text-[var(--accent)]" size={20} />
      </div>
      <NewCardEntry />
    </Panel>
  );
}

function DistributionPanel({
  gameStats,
  inventoryValue
}: {
  gameStats: ReturnType<typeof getGameStats>;
  inventoryValue: number;
}) {
  return (
    <Panel>
      <PanelHeader title="Cartas por jogo" text="Comparação de volume por jogo." />
      {gameStats.every((item) => item.count === 0) ? (
        <EmptyState icon={<Boxes size={28} />} title="Sem estoque" text="Cadastre cartas para ver a distribuição." />
      ) : (
        <>
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
        </>
      )}
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
      {topCards.length === 0 ? (
        <EmptyState icon={<TrendingUp size={28} />} title="Sem cartas" text="O ranking aparece quando houver inventário." />
      ) : (
        <div className="space-y-3">
          {topCards.map((card, index) => (
            <div
              key={card.id}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)]/15 text-xs font-bold text-[var(--accent)]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{card.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {card.stock} un. · {card.condition}
                  </p>
                </div>
              </div>
              <strong className="text-sm">{formatCurrency(card.stock * card.priceCents)}</strong>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecentOrdersPanel({ orders }: { orders: OrderSummary[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Pedidos recentes"
        text="Últimas compras criadas no site."
        action={
          <Link className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]" href="/admin?tab=orders">
            Ver todos
          </Link>
        }
      />
      {orders.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={28} />} title="Nenhum pedido recente" text="Pedidos finalizados aparecem aqui." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href="/admin?tab=orders"
              className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40 hover:bg-[var(--surface-soft)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--ink)]">
                    Pedido {order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <StatusBadge
                    label={orderStatusLabels[order.status] ?? order.status}
                    className={orderStatusStyles[order.status]}
                  />
                </div>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {order.customerEmail ?? "Cliente"} · {order.itemCount} itens
                  {order.items[0] ? ` · ${order.items[0].name}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[var(--ink)]">
                  {formatCurrency(order.totalCents || order.subtotalCents)}
                </p>
                <p className="text-xs text-[var(--muted)]">{formatDate(order.createdAt)}</p>
              </div>
            </Link>
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
  const stockTone =
    card.stock === 0
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : card.stock <= 3
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]";

  return (
    <form
      action={updateCardAction}
      className="group grid gap-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-soft)] p-3 transition hover:border-[var(--accent)]/45 hover:bg-[var(--surface-elevated)]"
    >
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="tab" value="inventory" />

      <div className="grid min-w-0 gap-4 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
        <div
          aria-label={`${card.name}. Passe o mouse para ampliar.`}
          className="group/preview relative h-28 w-[88px] overflow-visible rounded-[var(--radius-control)] outline-none"
          tabIndex={0}
        >
          <div className="absolute inset-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)]">
            <Image src={card.imageUrl} alt={card.name} fill unoptimized sizes="88px" className="object-cover" />
          </div>
          <div
            className={`pointer-events-none absolute left-full top-1/2 z-50 ml-4 hidden -translate-y-1/2 scale-95 gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-2 opacity-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ring-[var(--accent)]/25 transition duration-200 group-hover/preview:scale-100 group-hover/preview:opacity-100 group-focus/preview:scale-100 group-focus/preview:opacity-100 md:grid ${hasSecondFace ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {zoomUrls.map((url, index) => (
              <div
                key={`${card.id}-${index}`}
                className="relative aspect-[5/7] w-[min(240px,34vw)] overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)]"
              >
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
              <span className="rounded-md bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-bold text-[var(--accent)]">
                {card.game}
              </span>
              <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">
                {card.language}
              </span>
              <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">
                {card.finish}
              </span>
              <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${stockTone}`}>
                {card.stock === 0 ? "Sem estoque" : card.stock <= 3 ? "Baixo estoque" : `${card.stock} un.`}
              </span>
            </div>
            <p className="truncate text-base font-semibold text-[var(--ink)]" title={card.name}>
              {card.name}
            </p>
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
        <FieldLabel label="Preço">
          <input
            className={adminInputClass}
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={(card.priceCents / 100).toFixed(2)}
          />
        </FieldLabel>
        <FieldLabel label="Estoque">
          <input className={adminInputClass} name="stock" type="number" min="0" step="1" defaultValue={card.stock} />
        </FieldLabel>
        <FieldLabel label="Condição">
          <select className={adminInputClass} name="condition" defaultValue={card.condition}>
            {conditions.map((condition) => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </FieldLabel>
        <button
          className="h-11 w-full rounded-[var(--radius-control)] bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)] active:scale-95"
          type="submit"
        >
          Salvar
        </button>
        <button
          aria-label={`Excluir ${card.name} do estoque`}
          className="grid h-11 w-full place-items-center rounded-[var(--radius-control)] border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 active:scale-95"
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
    <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function ReportPanel({
  rows,
  title
}: {
  rows: Array<{ className: string; label: string; percent: number; value: string }>;
  title: string;
}) {
  return (
    <Panel>
      <PanelHeader title={title} text="Comparação objetiva por volume." />
      <div className="space-y-4">
        {rows.map((row) => (
          <DataBar
            key={row.label}
            accentClass={row.className}
            label={row.label}
            meta={`${row.percent}%`}
            percent={row.percent}
            value={row.value}
          />
        ))}
      </div>
    </Panel>
  );
}

type NavItemConfig = {
  tab: AdminTab;
  icon: ReactNode;
  label: string;
  badge?: number;
};

function getNavGroups(openSubmissions: number, pendingOrders: number): Array<{ label: string; items: NavItemConfig[] }> {
  return [
    {
      label: "Operação",
      items: [
        { tab: "overview", icon: <Gauge size={18} />, label: "Visão geral" },
        { tab: "inventory", icon: <Layers3 size={18} />, label: "Inventário" },
        { tab: "new-card", icon: <Plus size={18} />, label: "Nova carta" },
        { tab: "buylists", icon: <ClipboardList size={18} />, label: "Buylists", badge: openSubmissions || undefined },
        { tab: "orders", icon: <ShoppingBag size={18} />, label: "Pedidos", badge: pendingOrders || undefined }
      ]
    },
    {
      label: "Pessoas",
      items: [
        { tab: "customers", icon: <UsersRound size={18} />, label: "Clientes" },
        { tab: "internal-users", icon: <ShieldCheck size={18} />, label: "Usuários internos" }
      ]
    },
    {
      label: "Sistema",
      items: [
        { tab: "reports", icon: <BarChart3 size={18} />, label: "Relatórios" },
        { tab: "settings", icon: <Settings size={18} />, label: "Ajustes" }
      ]
    }
  ];
}

function getGameStats(cards: Array<{ game: Game; stock: number }>) {
  const items: Array<{ game: Game; barClass: string }> = [
    { game: "Magic", barClass: "bg-[var(--accent)]" },
    { game: "Pokemon", barClass: "bg-[var(--gold)]" },
    { game: "Yu-Gi-Oh!", barClass: "bg-sky-500" }
  ];
  const total = Math.max(
    cards.reduce((sum, card) => sum + card.stock, 0),
    1
  );

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
  const total = Math.max(
    cards.reduce((sum, card) => sum + card.stock, 0),
    1
  );

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

function inventoryHref({
  query,
  game,
  stock
}: {
  query: string;
  game: FilterGame;
  stock: "all" | "low" | "out";
}) {
  const params = new URLSearchParams({ tab: "inventory" });
  if (query) params.set("query", query);
  if (game !== "Todos") params.set("game", game);
  if (stock !== "all") params.set("stock", stock);
  return `/admin?${params.toString()}`;
}

function normalizeTab(value: string | string[] | undefined): AdminTab {
  return typeof value === "string" && tabs.includes(value as AdminTab) ? (value as AdminTab) : "overview";
}

function normalizeGame(value: string | string[] | undefined): FilterGame {
  return typeof value === "string" && (value === "Magic" || value === "Pokemon" || value === "Yu-Gi-Oh!")
    ? value
    : "Todos";
}

function normalizeStock(value: string | string[] | undefined): "all" | "low" | "out" {
  return typeof value === "string" && (value === "low" || value === "out") ? value : "all";
}

function normalizeOrderFilter(
  value: string | string[] | undefined
): "all" | (typeof orderStatuses)[number] {
  return typeof value === "string" && orderStatuses.includes(value as (typeof orderStatuses)[number])
    ? (value as (typeof orderStatuses)[number])
    : "all";
}

function normalizeBuylistFilter(
  value: string | string[] | undefined
): "all" | (typeof buylistStatuses)[number] {
  return typeof value === "string" && buylistStatuses.includes(value as (typeof buylistStatuses)[number])
    ? (value as (typeof buylistStatuses)[number])
    : "all";
}

function userInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function messageFor(code: string) {
  const messages: Record<string, string> = {
    "card-updated": "Carta atualizada com sucesso.",
    "card-created": "Carta cadastrada com sucesso.",
    "card-deleted": "Carta removida do estoque.",
    "buylist-updated": "Cotação atualizada com sucesso.",
    "order-updated": "Pedido atualizado com sucesso.",
    "demo-no-db": "Modo demo ativo. Configure o Neon para persistir esta alteração.",
    unauthorized: "Acesso restrito a administradores.",
    "invalid-card": "Dados da carta inválidos.",
    "invalid-new-card": "Selecione um print real retornado pela busca antes de cadastrar.",
    "invalid-buylist": "Dados da cotação inválidos.",
    "invalid-order": "Status do pedido inválido.",
    "no-db": "Banco indisponível."
  };

  return messages[code] ?? code;
}
