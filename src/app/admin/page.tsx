import {
  AlertCircle,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Database,
  Gauge,
  Inbox,
  Layers3,
  LogOut,
  PackageCheck,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
  UserRound,
  UsersRound
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  consumeOfferLinkFlash,
  deleteCardAction,
  logoutAction,
  updateCardAction,
  updateOrderStatusAction
} from "@/app/actions";
import { BuylistAdminCard } from "@/components/admin/buylist-admin-card";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { AdminMobileNav } from "@/components/admin/mobile-nav";
import { NewCardEntry } from "@/components/admin/new-card-entry";
import { ShareOfferLinks } from "@/components/admin/share-offer-links";
import {
  AlertBanner,
  DataBar,
  EmptyState,
  FieldLabel,
  FilterChip,
  InfoValue,
  MetricCard,
  NavItem,
  NavSection,
  Panel,
  PanelHeader,
  PriorityCard,
  QueueRow,
  SignalRow,
  StatusBadge,
  adminInputClass,
  adminInputWithIconClass
} from "@/components/admin/ui";
import { AuthPanel } from "@/components/auth-panel";
import { OrderCard } from "@/components/order-card";
import { allowDemoAuth, currentUser, DEMO_ADMIN } from "@/lib/auth";
import {
  isAwaitingCustomerStatus,
  isInboundPendingStatus,
  isOpenBuylistStatus
} from "@/lib/buylist-flow";
import { buylistStatusLabels } from "@/lib/buylist-ui";
import { cardHasSecondFace, resolveCardBackImageUrl } from "@/lib/card-images";
import {
  getAdminCards,
  getAdminCustomers,
  getAdminOrders,
  getBuylistSubmissions,
  hasDatabase
} from "@/lib/db";
import { hasEmailProvider } from "@/lib/email";
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
const buylistStatuses = [
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
] as const;
const orderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
const tabs = [
  "overview",
  "pendencias",
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

const INVENTORY_PAGE_SIZE = 10;

const tabLabels: Record<AdminTab, { title: string; description: string }> = {
  overview: {
    title: "Visão geral",
    description: "Resumo operacional de estoque, pedidos e cotações."
  },
  pendencias: {
    title: "Pendências",
    description: "Fila do dia: pedidos, cotações e estoque que pedem ação agora."
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
  const tokenUrl = (await consumeOfferLinkFlash()) || "";
  const focusId = typeof params.focus === "string" ? params.focus : "";
  const query = typeof params.query === "string" ? params.query : "";
  const game = normalizeGame(params.game);
  const stock = normalizeStock(params.stock);
  const activeTab = normalizeTab(params.tab);
  const inventoryPageRequested = normalizePage(params.page);
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
            Voltar para a loja
          </Link>
          <div className="surface-card mt-8 overflow-hidden">
            <div className="border-b border-[var(--line)] bg-[#0b1220] px-6 py-6 text-slate-100 sm:px-8">
              <span className="grid h-12 w-12 place-items-center rounded-[var(--radius-control)] bg-teal-400 text-sm font-bold text-slate-950">
                OPS
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300">Acesso restrito</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Console operacional</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Área interna da loja. Não é a conta de cliente — use credenciais de operador.
              </p>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <AuthPanel loginOnly redirectTo="/admin" />
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                Precisa da conta de cliente?{" "}
                <Link className="font-semibold text-[var(--accent)]" href="/conta">
                  Ir para Conta
                </Link>
              </p>
              {allowDemoAuth() ? (
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  Demo local sem Neon: <span className="font-medium text-[var(--ink)]">{DEMO_ADMIN.email}</span> /{" "}
                  <span className="font-medium text-[var(--ink)]">{DEMO_ADMIN.password}</span>
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    );
  }

  const [allCards, inventoryMatches, submissions, orders, customers] = await Promise.all([
    getAdminCards({ limit: 10000 }),
    activeTab === "inventory"
      ? getAdminCards({ query, game, stock, limit: 10000 })
      : Promise.resolve([] as TcgCard[]),
    getBuylistSubmissions(),
    getAdminOrders(),
    getAdminCustomers()
  ]);

  const inventoryTotal = inventoryMatches.length;
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryTotal / INVENTORY_PAGE_SIZE));
  const inventoryPage = Math.min(Math.max(inventoryPageRequested, 1), inventoryTotalPages);
  const cards = inventoryMatches.slice(
    (inventoryPage - 1) * INVENTORY_PAGE_SIZE,
    inventoryPage * INVENTORY_PAGE_SIZE
  );

  const totalStock = allCards.reduce((sum, card) => sum + card.stock, 0);
  const inventoryValue = allCards.reduce((sum, card) => sum + card.stock * card.priceCents, 0);
  const lowStockCards = allCards.filter((card) => card.stock > 0 && card.stock <= 3);
  const outOfStockCards = allCards.filter((card) => card.stock === 0);
  const openSubmissions = submissions.filter((submission) => isOpenBuylistStatus(submission.status));
  const awaitingCustomer = submissions.filter((submission) => isAwaitingCustomerStatus(submission.status));
  const inboundPending = submissions.filter((submission) => isInboundPendingStatus(submission.status));
  const receiveQueue = submissions.filter((submission) =>
    ["received", "checking", "stocked"].includes(submission.status)
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
  const alertCount =
    openSubmissions.length +
    awaitingCustomer.length +
    inboundPending.length +
    receiveQueue.filter((item) => item.status !== "stocked").length +
    pendingOrders.length;
  const navGroups = getNavGroups(alertCount);
  const page = tabLabels[activeTab];
  const initials = userInitials(user.name || user.email);

  return (
    <main className="admin-console min-h-screen overflow-x-hidden text-[var(--ink)]">
      <div className="grid min-h-screen min-w-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="admin-sidebar hidden border-r lg:flex lg:flex-col">
          <div className="flex h-[84px] items-center gap-3 border-b border-[var(--line)] px-5">
            <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-teal-400 text-xs font-extrabold text-slate-950">
              OPS
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight">Mana Draw Ops</p>
              <p className="text-xs text-[var(--muted)]">Console operacional</p>
            </div>
          </div>

          <div className="px-4 pt-4">
            <div className="rounded-[var(--radius-control)] border border-teal-400/20 bg-teal-400/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">Sessão operador</p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{user.name || "Admin"}</p>
              <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
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

            <NavSection label="Trocar sessão">
              <Link
                className="flex items-center gap-3 rounded-[0.55rem] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                href="/"
              >
                <Store size={18} />
                Loja (vitrine)
              </Link>
              <Link
                className="flex items-center gap-3 rounded-[0.55rem] px-3 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                href="/conta"
              >
                <UserRound size={18} />
                Conta de cliente
              </Link>
              <form action={logoutAction}>
                <button
                  className="flex w-full items-center gap-3 rounded-[0.55rem] px-3 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
                  type="submit"
                >
                  <LogOut size={18} />
                  Encerrar sessão
                </button>
              </form>
            </NavSection>
          </nav>
        </aside>

        <section className="min-w-0 overflow-x-hidden pb-[calc(5.25rem+var(--safe-bottom))] lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur-md">
            <div className="flex min-h-[56px] items-center justify-between gap-3 px-3 py-2 sm:min-h-[64px] sm:gap-4 sm:px-6 lg:px-7">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="admin-mode-pill">Ops</span>
                  {alertCount > 0 ? (
                    <span className="hidden text-xs text-[var(--muted)] sm:inline">
                      {alertCount} na fila
                    </span>
                  ) : null}
                </div>
                <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{page.title}</h1>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                <form action="/admin" className="relative hidden w-[240px] xl:block" method="get">
                  <input type="hidden" name="tab" value="inventory" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                  <input
                    className={adminInputWithIconClass}
                    name="query"
                    placeholder="Buscar inventário…"
                    defaultValue={activeTab === "inventory" ? query : ""}
                  />
                </form>
                <Link
                  className="relative grid h-10 w-10 place-items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-teal-300/60 hover:text-teal-700 sm:h-10 sm:w-10"
                  href="/admin?tab=pendencias"
                  aria-label={`${alertCount} pendências`}
                  title="Pendências"
                >
                  <Bell size={17} />
                  {alertCount > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  ) : null}
                </Link>
                <span
                  className="grid h-10 w-10 place-items-center rounded-[var(--radius-control)] bg-[#0b1220] text-xs font-bold text-teal-300 lg:hidden"
                  title={`Operador ${user.name || user.email}`}
                >
                  {initials}
                </span>
              </div>
            </div>
          </header>

          <div className="admin-content mx-auto min-w-0 w-full px-3 py-4 sm:px-6 sm:py-5 lg:px-7">
            {(notice || error) && (
              <AlertBanner tone={error ? "error" : "success"}>
                <span className="inline-flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-2">
                    {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    {messageFor(error || notice)}
                  </span>
                  {tokenUrl ? (
                    <span className="text-sm">
                      Link do cliente:{" "}
                      <a className="font-semibold underline" href={tokenUrl}>
                        abrir
                      </a>
                    </span>
                  ) : null}
                </span>
              </AlertBanner>
            )}
            {tokenUrl ? (
              <div className="mb-5 space-y-3 rounded-[var(--radius-control)] border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-4">
                <p className="text-sm font-medium text-[var(--accent-strong)]">
                  {notice === "buylist-offered-email"
                    ? "E-mail enviado ao cliente com o link da oferta."
                    : notice === "buylist-offered-email-failed"
                      ? "Não foi possível enviar o e-mail automaticamente. Envie o link manualmente:"
                      : "O cliente ainda não recebe e-mail automático sem RESEND_API_KEY. Envie o link agora:"}
                </p>
                {focusId ? (
                  (() => {
                    const focused = submissions.find((item) => item.id === focusId);
                    if (!focused) {
                      return <CopyLinkButton url={tokenUrl} />;
                    }
                    return (
                      <ShareOfferLinks
                        customerEmail={focused.email}
                        customerName={focused.customerName}
                        offerLabel={
                          focused.offerCents != null ? formatCurrency(focused.offerCents) : "sua oferta"
                        }
                        url={tokenUrl}
                      />
                    );
                  })()
                ) : (
                  <CopyLinkButton url={tokenUrl} />
                )}
                <p className="break-all text-xs text-[var(--muted)]">{tokenUrl}</p>
              </div>
            ) : null}

            {activeTab === "overview" && (
              <OverviewTab
                awaitingCustomer={awaitingCustomer}
                cards={allCards}
                gameStats={gameStats}
                inboundPending={inboundPending}
                inventoryValue={inventoryValue}
                lowStockCards={lowStockCards}
                openSubmissions={openSubmissions}
                orders={orders}
                outOfStockCount={outOfStockCards.length}
                paidRevenue={paidRevenue}
                pendingOrders={pendingOrders}
                receiveQueue={receiveQueue}
                submissions={submissions}
                topCards={topCards}
                totalStock={totalStock}
              />
            )}
            {activeTab === "pendencias" && (
              <PendenciasTab
                awaitingCustomer={awaitingCustomer}
                inboundPending={inboundPending}
                lowStockCards={lowStockCards}
                openSubmissions={openSubmissions}
                pendingOrders={pendingOrders}
                receiveQueue={receiveQueue}
                tokenUrl={tokenUrl}
                focusId={focusId}
              />
            )}
            {activeTab === "inventory" && (
              <InventoryTab
                cards={cards}
                game={game}
                gameStats={gameStats}
                inventoryValue={inventoryValue}
                page={inventoryPage}
                query={query}
                stock={stock}
                topCards={topCards}
                totalCount={inventoryTotal}
                totalPages={inventoryTotalPages}
              />
            )}
            {activeTab === "new-card" && (
              <NewCardTab gameStats={gameStats} inventoryValue={inventoryValue} topCards={topCards} />
            )}
            {activeTab === "buylists" && (
              <BuylistsTab
                filter={buylistFilter}
                focusId={focusId}
                openCount={openSubmissions.length}
                submissions={submissions}
                tokenUrl={tokenUrl}
              />
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
      <AdminMobileNav
        activeTab={activeTab}
        alertCount={alertCount}
        operatorName={user.name || user.email}
      />
    </main>
  );
}

function OverviewTab({
  awaitingCustomer,
  cards,
  gameStats,
  inboundPending,
  inventoryValue,
  lowStockCards,
  openSubmissions,
  orders,
  outOfStockCount,
  paidRevenue,
  pendingOrders,
  receiveQueue,
  submissions,
  topCards,
  totalStock
}: {
  awaitingCustomer: BuylistSubmission[];
  cards: TcgCard[];
  gameStats: ReturnType<typeof getGameStats>;
  inboundPending: BuylistSubmission[];
  inventoryValue: number;
  lowStockCards: TcgCard[];
  openSubmissions: BuylistSubmission[];
  orders: OrderSummary[];
  outOfStockCount: number;
  paidRevenue: number;
  pendingOrders: OrderSummary[];
  receiveQueue: BuylistSubmission[];
  submissions: BuylistSubmission[];
  topCards: TcgCard[];
  totalStock: number;
}) {
  const qcQueue = receiveQueue.filter((item) => item.status !== "stocked");
  const dayQueue = buildDayQueue({
    awaitingCustomer,
    inboundPending,
    lowStockCards,
    openSubmissions,
    pendingOrders,
    receiveQueue: qcQueue
  });

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Visão operacional
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
            O que precisa de ação agora
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {cards.length} prints · {totalStock} un. · {submissions.length} cotações
        </p>
      </section>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<CircleDollarSign size={20} />}
          label="Valor em estoque"
          hint="Preço × unidades"
          value={formatCurrency(inventoryValue)}
          tone="cyan"
        />
        <MetricCard
          icon={<Boxes size={20} />}
          label="Prints ativos"
          hint={`${outOfStockCount} sem estoque`}
          value={String(cards.length)}
          tone="green"
        />
        <MetricCard
          icon={<Camera size={20} />}
          label="Cotações abertas"
          hint={`${awaitingCustomer.length} aguardando cliente`}
          value={String(openSubmissions.length)}
          tone="orange"
        />
        <MetricCard
          icon={<ShoppingBag size={20} />}
          label="Pedidos pendentes"
          hint={`${formatCurrency(paidRevenue)} em pedidos recentes`}
          value={String(pendingOrders.length)}
          tone="red"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
        <Panel>
          <PanelHeader
            title="Fila do dia"
            text="Pendências ordenadas por impacto operacional."
            badge={`${dayQueue.length} itens`}
            tone={dayQueue.length > 0 ? "gold" : "muted"}
            action={
              <Link className="text-sm font-semibold text-[var(--accent)]" href="/admin?tab=pendencias">
                Abrir pendências
              </Link>
            }
          />
          {dayQueue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={28} />}
              title="Fila limpa"
              text="Sem cotações, pedidos ou reposição urgente no momento."
            />
          ) : (
            <div className="min-w-0">
              <div className="mb-1 hidden grid-cols-[88px_minmax(0,1.2fr)_minmax(0,1fr)_72px] gap-3 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] sm:grid">
                <span>Tipo</span>
                <span>Item</span>
                <span>Detalhe</span>
                <span className="text-right">Urgência</span>
              </div>
              {dayQueue.map((row) => (
                <QueueRow
                  key={row.id}
                  href={row.href}
                  type={row.type}
                  title={row.title}
                  detail={row.detail}
                  urgency={row.urgency}
                />
              ))}
            </div>
          )}
        </Panel>

        <div className="grid gap-4">
          <DistributionPanel gameStats={gameStats} inventoryValue={inventoryValue} />
          <Panel>
            <PanelHeader title="Sinais rápidos" text="Atalhos da operação." />
            <div className="divide-y divide-[var(--line)]">
              <SignalRow label="Estoque baixo" value={lowStockCards.length} tone={lowStockCards.length > 0 ? "warn" : "muted"} />
              <SignalRow label="Aguardando cliente" value={awaitingCustomer.length} tone={awaitingCustomer.length > 0 ? "info" : "muted"} />
              <SignalRow label="Em trânsito" value={inboundPending.length} tone={inboundPending.length > 0 ? "info" : "muted"} />
              <SignalRow label="Receber / QC" value={qcQueue.length} tone={qcQueue.length > 0 ? "danger" : "muted"} />
              <SignalRow label="Sem estoque" value={outOfStockCount} tone={outOfStockCount > 0 ? "warn" : "muted"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/40"
                href="/admin?tab=inventory&stock=low"
              >
                Reposição
              </Link>
              <Link
                className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/40"
                href="/admin?tab=pendencias"
              >
                Fila completa
              </Link>
              <Link
                className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/40"
                href="/admin?tab=new-card"
              >
                Nova carta
              </Link>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <TopCardsPanel topCards={topCards} />
        <RecentOrdersPanel orders={orders.slice(0, 5)} />
      </section>
    </div>
  );
}

type DayQueueItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  urgency: "Alta" | "Média" | "Baixa";
  href: string;
  rank: number;
};

function buildDayQueue({
  awaitingCustomer,
  inboundPending,
  lowStockCards,
  openSubmissions,
  pendingOrders,
  receiveQueue
}: {
  awaitingCustomer: BuylistSubmission[];
  inboundPending: BuylistSubmission[];
  lowStockCards: TcgCard[];
  openSubmissions: BuylistSubmission[];
  pendingOrders: OrderSummary[];
  receiveQueue: BuylistSubmission[];
}): DayQueueItem[] {
  const items: DayQueueItem[] = [];

  for (const submission of openSubmissions.slice(0, 4)) {
    items.push({
      id: `buy-open-${submission.id}`,
      type: "Buylist",
      title: `Lote ${submission.game} · ${submission.customerName}`,
      detail: buylistStatusLabels[submission.status] ?? submission.status,
      urgency: "Alta",
      href: `/admin?tab=pendencias&focus=${submission.id}`,
      rank: 1
    });
  }

  for (const submission of receiveQueue.slice(0, 3)) {
    items.push({
      id: `buy-qc-${submission.id}`,
      type: "QC",
      title: `Lote recebido · ${submission.customerName}`,
      detail: buylistStatusLabels[submission.status] ?? submission.status,
      urgency: "Alta",
      href: `/admin?tab=pendencias&focus=${submission.id}`,
      rank: 1
    });
  }

  for (const order of pendingOrders.slice(0, 3)) {
    items.push({
      id: `ord-${order.id}`,
      type: "Pedido",
      title: `Pedido ${order.id.slice(0, 8).toUpperCase()}`,
      detail: `${formatCurrency(order.totalCents || order.subtotalCents)} · pagamento pendente`,
      urgency: "Alta",
      href: "/admin?tab=pendencias",
      rank: 2
    });
  }

  for (const submission of inboundPending.slice(0, 2)) {
    items.push({
      id: `buy-in-${submission.id}`,
      type: "Buylist",
      title: `Lote ${submission.game} · ${submission.customerName}`,
      detail: buylistStatusLabels[submission.status] ?? "Em trânsito",
      urgency: "Média",
      href: `/admin?tab=pendencias&focus=${submission.id}`,
      rank: 3
    });
  }

  for (const submission of awaitingCustomer.slice(0, 2)) {
    items.push({
      id: `buy-wait-${submission.id}`,
      type: "Buylist",
      title: `Oferta · ${submission.customerName}`,
      detail:
        submission.offerCents != null
          ? `Oferta ${formatCurrency(submission.offerCents)} · aguarda aceite`
          : "Aguarda aceite do cliente",
      urgency: "Média",
      href: `/admin?tab=pendencias&focus=${submission.id}`,
      rank: 3
    });
  }

  for (const card of lowStockCards.slice(0, 3)) {
    items.push({
      id: `stock-${card.id}`,
      type: "Estoque",
      title: `${card.name} · ${card.condition}`,
      detail: `${card.stock} un. · reposição`,
      urgency: card.stock === 1 ? "Alta" : "Média",
      href: "/admin?tab=inventory&stock=low",
      rank: card.stock === 1 ? 2 : 4
    });
  }

  return items.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title)).slice(0, 8);
}

function PendenciasTab({
  awaitingCustomer,
  focusId,
  inboundPending,
  lowStockCards,
  openSubmissions,
  pendingOrders,
  receiveQueue,
  tokenUrl
}: {
  awaitingCustomer: BuylistSubmission[];
  focusId: string;
  inboundPending: BuylistSubmission[];
  lowStockCards: TcgCard[];
  openSubmissions: BuylistSubmission[];
  pendingOrders: OrderSummary[];
  receiveQueue: BuylistSubmission[];
  tokenUrl: string;
}) {
  const opsCount =
    openSubmissions.length +
    awaitingCustomer.length +
    inboundPending.length +
    receiveQueue.length +
    pendingOrders.length;
  const total = opsCount + lowStockCards.length;

  if (total === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="Nenhuma pendência no momento"
          text="Cotações, envios, recebimentos, QC, estoque e pedidos pendentes aparecem aqui."
          action={
            <Link
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)]"
              href="/admin?tab=overview"
            >
              Voltar à visão geral
            </Link>
          }
        />
      </Panel>
    );
  }

  const tokenFor = (id: string) => (focusId === id ? tokenUrl || null : null);

  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Fila operacional
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
            Pendências
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)]">{total} itens na fila</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Camera size={20} />} label="Analisar" hint="Novas / em análise" value={String(openSubmissions.length)} tone="cyan" />
        <MetricCard icon={<Inbox size={20} />} label="Aguardando cliente" hint="Oferta enviada" value={String(awaitingCustomer.length)} tone="orange" />
        <MetricCard icon={<PackageCheck size={20} />} label="Em trânsito" hint="Envio / retirada" value={String(inboundPending.length)} tone="green" />
        <MetricCard icon={<Boxes size={20} />} label="Receber / QC" hint="Na loja" value={String(receiveQueue.length)} tone="red" />
        <MetricCard icon={<ShoppingBag size={20} />} label="Pedidos" hint="Pendentes de pagamento" value={String(pendingOrders.length)} tone="orange" />
      </section>

      {pendingOrders.length > 0 ? (
        <Panel>
          <PanelHeader title="Pedidos pendentes" text="Atualize o status assim que o pagamento for confirmado." badge={`${pendingOrders.length}`} tone="gold" />
          <div className="grid gap-4">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showCustomer
                footer={
                  <form action={updateOrderStatusAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="tab" value="pendencias" />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Status do pedido</span>
                      <select className={adminInputClass} name="status" defaultValue={order.status}>
                        {orderStatuses.map((item) => (
                          <option key={item} value={item}>{orderStatusLabels[item] ?? item}</option>
                        ))}
                      </select>
                    </label>
                    <button className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white" type="submit">
                      Atualizar status
                    </button>
                  </form>
                }
              />
            ))}
          </div>
        </Panel>
      ) : null}

      {openSubmissions.length > 0 ? (
        <Panel>
          <PanelHeader title="Cotações para analisar" text="Defina a oferta e envie o link ao cliente." badge={`${openSubmissions.length}`} tone="gold" />
          <div className="grid gap-4 lg:grid-cols-2">
            {openSubmissions.map((submission) => (
              <BuylistAdminCard key={submission.id} submission={submission} tab="pendencias" tokenUrl={tokenFor(submission.id)} />
            ))}
          </div>
        </Panel>
      ) : null}

      {awaitingCustomer.length > 0 ? (
        <Panel>
          <PanelHeader title="Aguardando aceite do cliente" text="Oferta enviada — acompanhe ou reenvie o link." badge={`${awaitingCustomer.length}`} />
          <div className="grid gap-4 lg:grid-cols-2">
            {awaitingCustomer.map((submission) => (
              <BuylistAdminCard key={submission.id} submission={submission} tab="pendencias" tokenUrl={tokenFor(submission.id)} />
            ))}
          </div>
        </Panel>
      ) : null}

      {inboundPending.length > 0 ? (
        <Panel>
          <PanelHeader title="Lotes a caminho" text="Cliente aceitou — marque como recebido quando chegar." badge={`${inboundPending.length}`} />
          <div className="grid gap-4 lg:grid-cols-2">
            {inboundPending.map((submission) => (
              <BuylistAdminCard key={submission.id} submission={submission} tab="pendencias" tokenUrl={tokenFor(submission.id)} />
            ))}
          </div>
        </Panel>
      ) : null}

      {receiveQueue.length > 0 ? (
        <Panel>
          <PanelHeader title="Recebimento, QC e estoque" text="Conferir cartas, lançar estoque e marcar pagamento." badge={`${receiveQueue.length}`} tone="gold" />
          <div className="grid gap-4 lg:grid-cols-2">
            {receiveQueue.map((submission) => (
              <BuylistAdminCard key={submission.id} submission={submission} tab="pendencias" tokenUrl={tokenFor(submission.id)} />
            ))}
          </div>
        </Panel>
      ) : null}

      {lowStockCards.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Estoque baixo"
            text="Cartas com 1 a 3 unidades."
            badge={`${lowStockCards.length}`}
            action={<Link className="text-sm font-semibold text-[var(--accent)]" href="/admin?tab=inventory&stock=low">Abrir inventário</Link>}
          />
          <div className="grid gap-2">
            {lowStockCards.slice(0, 12).map((card) => (
              <div key={card.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{card.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{card.game} · {card.setName} · {card.condition}</p>
                </div>
                <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{card.stock} un.</span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function InventoryTab({
  cards,
  game,
  gameStats,
  inventoryValue,
  page,
  query,
  stock,
  topCards,
  totalCount,
  totalPages
}: {
  cards: TcgCard[];
  game: FilterGame;
  gameStats: ReturnType<typeof getGameStats>;
  inventoryValue: number;
  page: number;
  query: string;
  stock: "all" | "low" | "out";
  topCards: TcgCard[];
  totalCount: number;
  totalPages: number;
}) {
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * INVENTORY_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * INVENTORY_PAGE_SIZE, totalCount);

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.85fr)]">
      <Panel>
        <PanelHeader
          title="Inventário"
          text="Cards consolidados por print, condição, idioma e acabamento."
          badge={`${totalCount} itens`}
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
            cards.map((card) => (
              <InventoryRow
                key={card.id}
                card={card}
                game={game}
                page={page}
                query={query}
                stock={stock}
              />
            ))
          )}
        </div>

        {totalCount > 0 ? (
          <InventoryPagination
            game={game}
            page={page}
            query={query}
            rangeEnd={rangeEnd}
            rangeStart={rangeStart}
            stock={stock}
            totalCount={totalCount}
            totalPages={totalPages}
          />
        ) : null}
      </Panel>

      <div className="grid gap-6 self-start xl:sticky xl:top-24">
        <DistributionPanel gameStats={gameStats} inventoryValue={inventoryValue} />
        <TopCardsPanel topCards={topCards} />
      </div>
    </section>
  );
}

function InventoryPagination({
  game,
  page,
  query,
  rangeEnd,
  rangeStart,
  stock,
  totalCount,
  totalPages
}: {
  game: FilterGame;
  page: number;
  query: string;
  rangeEnd: number;
  rangeStart: number;
  stock: "all" | "low" | "out";
  totalCount: number;
  totalPages: number;
}) {
  const pages = visiblePageNumbers(page, totalPages);

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--muted)]">
        {rangeStart}–{rangeEnd} de {totalCount}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          aria-disabled={page <= 1}
          className={`inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border px-2.5 text-sm font-semibold transition ${
            page <= 1
              ? "pointer-events-none border-[var(--line)] text-[var(--muted)] opacity-45"
              : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-soft)]"
          }`}
          href={inventoryHref({ query, game, stock, page: page - 1 })}
        >
          <ChevronLeft size={16} />
          Anterior
        </Link>
        {pages.map((item, index) =>
          item === "…" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-[var(--muted)]">
              …
            </span>
          ) : (
            <Link
              key={item}
              aria-current={item === page ? "page" : undefined}
              className={`grid h-9 min-w-9 place-items-center rounded-[var(--radius-control)] border px-2 text-sm font-semibold transition ${
                item === page
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-soft)]"
              }`}
              href={inventoryHref({ query, game, stock, page: item })}
            >
              {item}
            </Link>
          )
        )}
        <Link
          aria-disabled={page >= totalPages}
          className={`inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] border px-2.5 text-sm font-semibold transition ${
            page >= totalPages
              ? "pointer-events-none border-[var(--line)] text-[var(--muted)] opacity-45"
              : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-soft)]"
          }`}
          href={inventoryHref({ query, game, stock, page: page + 1 })}
        >
          Próxima
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function visiblePageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: Array<number | "…"> = [];
  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      result.push("…");
    }
    result.push(page);
  }
  return result;
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
          <PanelHeader title="Como cadastrar melhor" text="Use a busca unitária, o lote ManaBox ou o cadastro de produtos selados." />
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            {[
              ["1. Uma carta", "Busque o nome, escolha o print e revise preço BRL antes de publicar."],
              ["2. Em lote (ManaBox)", "Exporte CSV/TXT no app, pré-visualize matches no Scryfall e importe só o que estiver OK."],
              ["3. Produto selado", "Busque boxes, ETBs e tins — a imagem vem automaticamente do catálogo TCGPlayer."],
              ["4. Preço de venda", "Mercado Scryfall/TCGPlayer fica em USD; venda é BRL — no lote pode deixar R$ 0 e ajustar no inventário."]
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
  filter,
  focusId,
  tokenUrl
}: {
  submissions: BuylistSubmission[];
  openCount: number;
  filter: "all" | (typeof buylistStatuses)[number];
  focusId: string;
  tokenUrl: string;
}) {
  const filtered =
    filter === "all"
      ? submissions
      : submissions.filter((item) => item.status === filter || (filter === "offered" && item.status === "approved"));

  return (
    <Panel>
      <PanelHeader
        title="Cotações de buylist"
        text="Histórico completo do ciclo: oferta, envio, QC, estoque e pagamento."
        badge={`${openCount} para analisar`}
        tone="gold"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} count={submissions.length} href="/admin?tab=buylists" label="Todas" />
        {buylistStatuses.map((status) => (
          <FilterChip
            key={status}
            active={filter === status}
            count={submissions.filter((item) => item.status === status || (status === "offered" && item.status === "approved")).length}
            href={`/admin?tab=buylists&status=${status}`}
            label={buylistStatusLabels[status]}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Camera size={28} />}
          title={submissions.length === 0 ? "Nenhuma cotação recebida" : "Nenhuma cotação neste filtro"}
          text={submissions.length === 0 ? "Os lotes enviados pelo site aparecem aqui." : "Troque o filtro para ver outras cotações."}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((submission) => (
            <BuylistAdminCard
              key={submission.id}
              submission={submission}
              tab="buylists"
              tokenUrl={focusId === submission.id ? tokenUrl || null : null}
            />
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
    ["paid", "stocked"].includes(submission.status)
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
            href="/admin?tab=pendencias"
            label="Compra de coleções"
            value={String(submissions.filter((item) => item.status === "new").length)}
            text="Novas buylists devem ser respondidas rápido para aumentar aceite."
            urgent={submissions.some((item) => item.status === "new")}
          />
          <PriorityCard
            href="/admin?tab=pendencias"
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
    {
      label: "E-mail (Resend)",
      value: hasEmailProvider() ? "RESEND_API_KEY ok" : "Não configurado — ofertas só com link manual",
      ok: hasEmailProvider()
    },
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
          {["DATABASE_URL", "MERCADOPAGO_WEBHOOK_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "NEXT_PUBLIC_APP_URL"].map((item) => (
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
          <h2 className="text-lg font-semibold">Novo item</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Carta unitária, lote ManaBox ou produto selado com busca de imagem.
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
      <PanelHeader title="Mix de estoque" text="% de unidades por jogo." />
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

function InventoryRow({
  card,
  game,
  page,
  query,
  stock
}: {
  card: TcgCard;
  game: FilterGame;
  page: number;
  query: string;
  stock: "all" | "low" | "out";
}) {
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
      <input type="hidden" name="inv_page" value={String(page)} />
      <input type="hidden" name="inv_query" value={query} />
      <input type="hidden" name="inv_game" value={game} />
      <input type="hidden" name="inv_stock" value={stock} />

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
              {card.productKind === "sealed" ? (
                <span className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1 text-[11px] font-bold text-[var(--accent)]">
                  Selado
                </span>
              ) : (
                <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">
                  {card.finish}
                </span>
              )}
              <span className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--muted)]">
                {card.language}
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

function getNavGroups(alertCount: number): Array<{ label: string; items: NavItemConfig[] }> {
  return [
    {
      label: "Operação",
      items: [
        { tab: "overview", icon: <Gauge size={18} />, label: "Visão geral" },
        {
          tab: "pendencias",
          icon: <Inbox size={18} />,
          label: "Pendências",
          badge: alertCount > 0 ? alertCount : undefined
        },
        { tab: "inventory", icon: <Layers3 size={18} />, label: "Inventário" },
        { tab: "new-card", icon: <Plus size={18} />, label: "Nova carta" },
        { tab: "buylists", icon: <ClipboardList size={18} />, label: "Buylists" },
        { tab: "orders", icon: <ShoppingBag size={18} />, label: "Pedidos" }
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
  stock,
  page
}: {
  query: string;
  game: FilterGame;
  stock: "all" | "low" | "out";
  page?: number;
}) {
  const params = new URLSearchParams({ tab: "inventory" });
  if (query) params.set("query", query);
  if (game !== "Todos") params.set("game", game);
  if (stock !== "all") params.set("stock", stock);
  if (page && page > 1) params.set("page", String(page));
  return `/admin?${params.toString()}`;
}

function normalizePage(value: string | string[] | undefined) {
  if (typeof value !== "string") return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
    "sealed-created": "Produto selado cadastrado com sucesso.",
    "card-deleted": "Carta removida do estoque.",
    "buylist-updated": "Cotação atualizada com sucesso.",
    "buylist-offered": "Oferta salva. Envie o link ao cliente.",
    "buylist-offered-email": "Oferta enviada por e-mail ao cliente.",
    "buylist-offered-manual": "Oferta salva. Configure RESEND_API_KEY ou envie o link manualmente (copiar / e-mail / WhatsApp).",
    "buylist-offered-email-failed": "Oferta salva, mas o e-mail falhou. Envie o link manualmente.",
    "buylist-token": "Novo link gerado. Envie ao cliente.",
    "buylist-received": "Lote marcado como recebido.",
    "buylist-checking": "Conferência iniciada.",
    "buylist-line-saved": "Linha de conferência salva.",
    "buylist-line-deleted": "Linha removida.",
    "buylist-payout-saved": "Valor a pagar atualizado.",
    "buylist-stocked": "Cartas lançadas no estoque.",
    "buylist-already-stocked": "Este lote já foi lançado no estoque.",
    "buylist-paid": "Buylist marcada como paga.",
    "buylist-offer-required": "Informe um valor de oferta maior que zero.",
    "buylist-no-lines": "Adicione linhas aceitas antes de lançar no estoque.",
    "invalid-buylist-transition": "Transição de status inválida para este lote.",
    "invalid-buylist-line": "Dados da linha de conferência inválidos.",
    "order-updated": "Pedido atualizado com sucesso.",
    "demo-no-db": "Modo demo ativo. Configure o Neon para persistir esta alteração.",
    unauthorized: "Acesso restrito a administradores.",
    "invalid-card": "Dados da carta inválidos.",
    "invalid-new-card": "Selecione um print real retornado pela busca antes de cadastrar.",
    "invalid-new-sealed": "Preencha nome, tipo, imagem e preço do produto selado.",
    "invalid-buylist": "Dados da cotação inválidos.",
    "invalid-order": "Status do pedido inválido.",
    "no-db": "Banco indisponível."
  };

  return messages[code] ?? code;
}
