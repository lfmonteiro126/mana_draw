import {
  BarChart3,
  Bell,
  Boxes,
  Camera,
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
  getAdminCustomers,
  getAdminOrders,
  getBuylistSubmissions,
  hasDatabase
} from "@/lib/db";
import { formatCurrency } from "@/lib/format";
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
    title: "Inventario",
    description: "Busque, filtre e ajuste preco, estoque e condicao das cartas."
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
    description: "Veja contas de compradores, recorrencia de compra e cotações vinculadas."
  },
  "internal-users": {
    title: "Usuarios internos",
    description: "Gerencie a visibilidade de admins e contas internas da operacao."
  },
  reports: {
    title: "Relatorios",
    description: "Indicadores para decidir reposicao, precificacao e prioridade."
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

  const [allCards, cards, submissions, orders, customers] = await Promise.all([
    getAdminCards(),
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
            {navItems.map((item) => (
              <NavItem key={item.tab} active={activeTab === item.tab} badge={item.badge} href={`/admin?tab=${item.tab}`} icon={item.icon} label={item.label} />
            ))}
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
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-7">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{page.title}</h1>
                  <span className="hidden items-center gap-2 text-sm text-[var(--muted)] sm:inline-flex">
                    <Sparkles size={15} />
                    Operacao TCG
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{page.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  className="hidden h-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] sm:inline-flex"
                  href="/"
                >
                  Loja
                </Link>
                <Link className="relative grid h-11 w-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]" href="/admin?tab=buylists" aria-label="Notificacoes">
                  <Bell size={18} />
                  {openSubmissions.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />}
                </Link>
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
                  NM
                </span>
              </div>
            </div>

            <nav className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-4 py-3 scrollbar-none lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.tab}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                    activeTab === item.tab
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
                  }`}
                  href={`/admin?tab=${item.tab}`}
                >
                  {item.icon}
                  {item.label}
                  {item.badge ? <span className="rounded bg-white/15 px-1.5 text-xs">{item.badge}</span> : null}
                </Link>
              ))}
            </nav>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-7">
            {(notice || error) && (
              <p className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-500/25 bg-red-500/15 text-red-300" : "border-[var(--accent)]/25 bg-[var(--accent)]/15 text-[var(--accent)]"}`}>
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
        <PanelHeader title="Inventario" text="Busque, filtre e ajuste preco, estoque e condicao." badge={`${cards.length} registros`} />
        <form className="mb-4 grid gap-3 lg:grid-cols-[minmax(180px,1fr)_160px_160px_auto]">
          <input type="hidden" name="tab" value="inventory" />
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input className={inputClassWithIcon} name="query" placeholder="Buscar carta, colecao ou tag" defaultValue={query} />
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
        <ReportPanel title="Estoque por jogo" rows={gameStats.map((item) => ({ label: item.game, value: `${item.count} cartas`, percent: item.percent, className: item.barClass }))} />
        <ReportPanel title="Condição das cartas" rows={conditionStats.map((item) => ({ label: item.condition, value: `${item.count} cartas`, percent: item.percent, className: item.barClass }))} />
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
      <PanelHeader title="Distribuicao por jogo" text="Quantidade de cartas no catalogo." />
      <div className="space-y-5">
        {gameStats.map((item) => <ProgressRow key={item.game} label={item.game} value={`${item.count} · ${item.percent}%`} percent={item.percent} className={item.barClass} />)}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-5">
        <span className="text-sm text-[var(--muted)]">Valor total</span>
        <strong className="text-2xl">{formatCurrency(inventoryValue)}</strong>
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
      <div className="space-y-4">
        {topCards.map((card, index) => (
          <div key={card.id} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{index + 1}</span>
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
  return (
    <form action={updateCardAction} className="grid gap-4 border-b border-[var(--line)] px-4 py-4 last:border-b-0 xl:grid-cols-[minmax(230px,1fr)_145px_105px_135px_105px] xl:items-center">
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="tab" value="inventory" />
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-hover)] text-sm font-bold text-[var(--ink)]">{card.name.slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--ink)]">{card.name}</p>
            <p className="truncate text-sm text-[var(--muted)]">{card.game} · {card.setName} · {card.finish}</p>
          </div>
        </div>
      </div>
      <FieldLabel label="Preco"><input className={inputClass} name="price" type="number" min="0" step="0.01" defaultValue={(card.priceCents / 100).toFixed(2)} /></FieldLabel>
      <FieldLabel label="Estoque"><input className={inputClass} name="stock" type="number" min="0" step="1" defaultValue={card.stock} /></FieldLabel>
      <FieldLabel label="Condicao">
        <select className={inputClass} name="condition" defaultValue={card.condition}>
          {conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
        </select>
      </FieldLabel>
      <button className="h-11 w-full rounded-lg bg-[var(--accent)] px-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]" type="submit">
        Salvar
      </button>
    </form>
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
      className={`flex items-center gap-3 rounded-lg px-3 py-3 transition ${
        active
          ? "bg-[var(--surface-hover)] text-[var(--ink)] before:-ml-3 before:h-7 before:w-1 before:rounded-r-full before:bg-[var(--accent)]"
          : "hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
      }`}
      href={href}
    >
      <span className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      {badge ? <span className="rounded-md bg-[var(--accent)]/15 px-2 py-0.5 text-xs text-[var(--accent)]">{badge}</span> : null}
    </Link>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="card-shadow rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">{children}</div>;
}

function PanelHeader({ badge, text, title, tone = "muted" }: { badge?: string; text: string; title: string; tone?: "muted" | "gold" }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{text}</p>
      </div>
      {badge ? (
        <span className={`w-fit rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs font-semibold ${tone === "gold" ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function MetricCard({ icon, label, trend, value, tone }: { icon: ReactNode; label: string; trend: string; value: string; tone: "cyan" | "green" | "orange" | "red" }) {
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
        <span className={`grid h-11 w-11 place-items-center rounded-lg ${toneClass}`}>{icon}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <strong className="text-3xl font-semibold tracking-tight text-[var(--ink)]">{value}</strong>
        <span className="pb-1 text-sm font-semibold text-[var(--accent)]">{trend}</span>
      </div>
    </div>
  );
}

function PriorityCard({ href, label, text, value }: { href: string; label: string; text: string; value: string }) {
  return (
    <Link className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]/60" href={href}>
      <strong className="text-3xl">{value}</strong>
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </Link>
  );
}

function ReportPanel({ rows, title }: { rows: Array<{ className: string; label: string; percent: number; value: string }>; title: string }) {
  return (
    <Panel>
      <PanelHeader title={title} text="Distribuicao atual dos dados." />
      <div className="space-y-5">
        {rows.map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} percent={row.percent} className={row.className} />)}
      </div>
    </Panel>
  );
}

function ProgressRow({ className, label, percent, value }: { className: string; label: string; percent: number; value: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-[var(--ink)]">{label}</span>
        <span className="text-[var(--muted)]">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${percent}%` }} />
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
      <span className="text-xs text-[var(--muted)] xl:hidden">{label}</span>
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
    { tab: "inventory" as const, icon: <Layers3 size={19} />, label: "Inventario" },
    { tab: "new-card" as const, icon: <Plus size={19} />, label: "Nova carta" },
    { tab: "buylists" as const, icon: <ClipboardList size={19} />, label: "Buylists", badge: openSubmissions },
    { tab: "orders" as const, icon: <ShoppingBag size={19} />, label: "Pedidos", badge: pendingOrders },
    { tab: "customers" as const, icon: <UsersRound size={19} />, label: "Clientes" },
    { tab: "internal-users" as const, icon: <ShieldCheck size={19} />, label: "Usuarios internos" },
    { tab: "reports" as const, icon: <BarChart3 size={19} />, label: "Relatorios" },
    { tab: "settings" as const, icon: <Settings size={19} />, label: "Ajustes" }
  ];
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
    return { ...item, count, percent: Math.round((count / total) * 100) };
  });
}

function getConditionStats(cards: Array<{ condition: CardCondition }>) {
  const items: Array<{ condition: CardCondition; barClass: string }> = [
    { condition: "NM", barClass: "bg-[var(--accent)]" },
    { condition: "SP", barClass: "bg-[var(--gold)]" },
    { condition: "MP", barClass: "bg-violet-400" },
    { condition: "HP", barClass: "bg-red-400" }
  ];
  const total = Math.max(cards.length, 1);

  return items.map((item) => {
    const count = cards.filter((card) => card.condition === item.condition).length;
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
const inputClassWithIcon =
  "h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]";
