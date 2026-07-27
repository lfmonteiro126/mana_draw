import {
  deleteBuylistLineAction,
  markBuylistPaidAction,
  markBuylistReceivedAction,
  regenerateBuylistTokenAction,
  startBuylistCheckingAction,
  stockBuylistAction,
  updateBuylistAction,
  updateBuylistPayoutAction,
  upsertBuylistLineAction
} from "@/app/actions";
import { BuylistPhotoGallery } from "@/components/admin/buylist-photo-gallery";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import {
  FieldLabel,
  StatusBadge,
  adminInputClass
} from "@/components/admin/ui";
import { buylistCustomerUrl } from "@/lib/buylist-flow";
import {
  buylistAdminSelectableStatuses,
  buylistLineStatusLabels,
  buylistStatusLabels,
  buylistStatusStyles,
  inboundMethodLabels
} from "@/lib/buylist-ui";
import { formatCurrency } from "@/lib/format";
import type { BuylistSubmission, CardCondition, Game } from "@/lib/types";

const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export function BuylistAdminCard({
  submission,
  tab,
  tokenUrl
}: {
  submission: BuylistSubmission;
  tab: "buylists" | "pendencias";
  tokenUrl?: string | null;
}) {
  const status = submission.status;
  const showOfferForm = ["new", "reviewing", "offered"].includes(status);
  const showReceive = ["awaiting_shipment", "in_transit"].includes(status);
  const showChecking = status === "received" || status === "checking";
  const showPaid = status === "stocked";
  const customerLink = tokenUrl || (submission.hasAcceptToken ? buylistCustomerUrl(submission.id) : null);

  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--ink)]">{submission.customerName}</p>
          <p className="truncate text-sm text-[var(--muted)]">
            {submission.email} · {submission.game} · {formatDate(submission.createdAt)}
          </p>
          {submission.offerCents != null ? (
            <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
              Oferta: {formatCurrency(submission.offerCents)}
              {submission.payoutCents != null && submission.payoutCents !== submission.offerCents
                ? ` · Pagar: ${formatCurrency(submission.payoutCents)}`
                : ""}
            </p>
          ) : null}
          {submission.inboundMethod ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {inboundMethodLabels[submission.inboundMethod] ?? submission.inboundMethod}
              {submission.trackingCode ? ` · ${submission.trackingCode}` : ""}
              {submission.pickupAt ? ` · ${new Date(submission.pickupAt).toLocaleString("pt-BR")}` : ""}
            </p>
          ) : null}
        </div>
        <StatusBadge
          label={buylistStatusLabels[status] ?? status}
          className={buylistStatusStyles[status]}
        />
      </div>

      {submission.notes ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{submission.notes}</p>
      ) : null}
      {submission.offerNote ? (
        <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--ink)]">
          Nota da oferta: {submission.offerNote}
        </p>
      ) : null}

      <BuylistPhotoGallery customerName={submission.customerName} photos={submission.photoUrls} />

      {customerLink ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CopyLinkButton url={customerLink} />
          <form action={regenerateBuylistTokenAction}>
            <input type="hidden" name="id" value={submission.id} />
            <input type="hidden" name="tab" value={tab} />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Gerar novo link
            </button>
          </form>
        </div>
      ) : null}

      {showOfferForm ? (
        <div className="mt-4 grid gap-3">
          <form action={updateBuylistAction} className="grid gap-3">
            <input type="hidden" name="id" value={submission.id} />
            <input type="hidden" name="tab" value={tab} />
            <input type="hidden" name="status" value="offered" />
            <FieldLabel label="Oferta R$">
              <input
                className={adminInputClass}
                name="offer"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                defaultValue={
                  submission.offerCents === null ? "" : (submission.offerCents / 100).toFixed(2)
                }
                required
              />
            </FieldLabel>
            <FieldLabel label="Nota da oferta (opcional)">
              <textarea
                className={`${adminInputClass} min-h-[72px] py-2`}
                name="offerNote"
                defaultValue={submission.offerNote ?? ""}
                placeholder="Ex.: compramos as rares NM; bulk fora."
              />
            </FieldLabel>
            <button
              className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
              type="submit"
            >
              Enviar oferta ao cliente
            </button>
          </form>
          {status === "new" ? (
            <form action={updateBuylistAction}>
              <input type="hidden" name="id" value={submission.id} />
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="status" value="reviewing" />
              <button
                className="h-10 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold text-[var(--muted)]"
                type="submit"
              >
                Só marcar em análise
              </button>
            </form>
          ) : null}
          {status === "offered" || status === "new" || status === "reviewing" ? (
            <form action={updateBuylistAction}>
              <input type="hidden" name="id" value={submission.id} />
              <input type="hidden" name="tab" value={tab} />
              <input type="hidden" name="status" value="declined" />
              <input
                type="hidden"
                name="offer"
                value={submission.offerCents === null ? "" : (submission.offerCents / 100).toFixed(2)}
              />
              <button
                className="h-10 rounded-[var(--radius-control)] border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800"
                type="submit"
              >
                Recusar cotação
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <form action={updateBuylistAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input type="hidden" name="id" value={submission.id} />
          <input type="hidden" name="tab" value={tab} />
          <select className={adminInputClass} name="status" defaultValue={status}>
            {buylistAdminSelectableStatuses.map((item) => (
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
      )}

      {showReceive ? (
        <form action={markBuylistReceivedAction} className="mt-3">
          <input type="hidden" name="id" value={submission.id} />
          <input type="hidden" name="tab" value={tab} />
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-control)] border border-[var(--accent)] bg-[var(--accent)]/10 px-4 text-sm font-semibold text-[var(--accent-strong)]"
          >
            Marcar lote como recebido
          </button>
        </form>
      ) : null}

      {status === "received" ? (
        <form action={startBuylistCheckingAction} className="mt-3">
          <input type="hidden" name="id" value={submission.id} />
          <input type="hidden" name="tab" value={tab} />
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900"
          >
            Iniciar conferência (QC)
          </button>
        </form>
      ) : null}

      {showChecking ? (
        <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
          <p className="text-sm font-semibold text-[var(--ink)]">Linhas conferidas</p>
          {submission.lines.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhuma carta conferida ainda.</p>
          ) : (
            <div className="space-y-2">
              {submission.lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--ink)]">{line.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {line.game} · {line.conditionReceived ?? "—"} · {line.qtyAccepted} un. ·{" "}
                        {formatCurrency(line.unitOfferCents)} ·{" "}
                        {buylistLineStatusLabels[line.lineStatus] ?? line.lineStatus}
                      </p>
                    </div>
                    <form action={deleteBuylistLineAction}>
                      <input type="hidden" name="submissionId" value={submission.id} />
                      <input type="hidden" name="lineId" value={line.id} />
                      <input type="hidden" name="tab" value={tab} />
                      <button type="submit" className="text-xs font-semibold text-rose-700">
                        Remover
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form action={upsertBuylistLineAction} className="grid gap-3 rounded-[var(--radius-control)] border border-dashed border-[var(--line)] p-3">
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="tab" value={tab} />
            <p className="text-sm font-semibold">Adicionar carta conferida</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldLabel label="Nome">
                <input className={adminInputClass} name="name" required placeholder="Nome da carta" />
              </FieldLabel>
              <FieldLabel label="Jogo">
                <select className={adminInputClass} name="game" defaultValue={submission.game}>
                  {games.map((game) => (
                    <option key={game} value={game}>
                      {game}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Coleção">
                <input className={adminInputClass} name="setName" placeholder="Opcional" />
              </FieldLabel>
              <FieldLabel label="Condição recebida">
                <select className={adminInputClass} name="conditionReceived" defaultValue="NM">
                  {conditions.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Qtd aceita">
                <input className={adminInputClass} name="qtyAccepted" type="number" min="0" step="1" defaultValue={1} required />
              </FieldLabel>
              <FieldLabel label="Valor unitário R$">
                <input className={adminInputClass} name="unitOffer" type="number" min="0" step="0.01" defaultValue="0" required />
              </FieldLabel>
              <FieldLabel label="Status da linha">
                <select className={adminInputClass} name="lineStatus" defaultValue="accepted">
                  {Object.entries(buylistLineStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <button
              type="submit"
              className="h-10 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
            >
              Salvar linha
            </button>
          </form>

          <form action={updateBuylistPayoutAction} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={submission.id} />
            <input type="hidden" name="tab" value={tab} />
            <FieldLabel label="Valor a pagar (override)">
              <input
                className={adminInputClass}
                name="payout"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  ((submission.payoutCents ?? submission.offerCents ?? 0) / 100).toFixed(2)
                }
              />
            </FieldLabel>
            <button
              type="submit"
              className="h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
            >
              Atualizar pagamento
            </button>
          </form>
        </div>
      ) : null}

      {status === "checking" && submission.lines.some((line) => line.qtyAccepted > 0) ? (
        <form action={stockBuylistAction} className="mt-3">
          <input type="hidden" name="id" value={submission.id} />
          <input type="hidden" name="tab" value={tab} />
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-control)] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
          >
            Lançar linhas aceitas no estoque
          </button>
        </form>
      ) : null}

      {showPaid ? (
        <form action={markBuylistPaidAction} className="mt-3">
          <input type="hidden" name="id" value={submission.id} />
          <input type="hidden" name="tab" value={tab} />
          <button
            type="submit"
            className="h-10 rounded-[var(--radius-control)] bg-teal-700 px-4 text-sm font-semibold text-white"
          >
            Marcar como paga ({formatCurrency(submission.payoutCents ?? submission.offerCents ?? 0)})
          </button>
        </form>
      ) : null}
    </article>
  );
}
