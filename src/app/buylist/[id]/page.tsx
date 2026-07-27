import Link from "next/link";
import {
  acceptBuylistOfferAction,
  declineBuylistOfferAction,
  updateBuylistInboundAction
} from "@/app/actions";
import { BuylistPhotoGallery } from "@/components/admin/buylist-photo-gallery";
import { StatusBadge, adminInputClass } from "@/components/admin/ui";
import { currentUser } from "@/lib/auth";
import {
  hashAcceptToken,
  isOfferExpired,
  normalizeBuylistStatus
} from "@/lib/buylist-flow";
import {
  buylistStatusLabels,
  buylistStatusStyles,
  inboundMethodLabels
} from "@/lib/buylist-ui";
import { getBuylistAcceptTokenHash, getBuylistSubmissionById } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

function messageFor(code: string) {
  const messages: Record<string, string> = {
    "offer-accepted": "Oferta aceita. Informe como vai enviar o lote.",
    "offer-declined": "Oferta recusada.",
    "inbound-saved": "Dados de envio salvos. Obrigado!",
    "offer-expired": "Esta oferta expirou. Fale com a loja.",
    unauthorized: "Link inválido ou sem permissão para ver esta cotação.",
    "invalid-buylist-transition": "Esta cotação não está mais aguardando essa ação.",
    "tracking-required": "Informe o código de rastreio.",
    "pickup-required": "Informe data e horário da retirada.",
    "demo-no-db": "Modo demo — configure o banco para persistir.",
    "no-db": "Banco indisponível."
  };
  return messages[code] ?? code;
}

export default async function BuylistOfferPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const notice = typeof query.notice === "string" ? query.notice : "";
  const error = typeof query.error === "string" ? query.error : "";

  const user = await currentUser();
  const submission = await getBuylistSubmissionById(id);

  let allowed = false;
  if (submission) {
    if (user && user.email.toLowerCase() === submission.email.toLowerCase()) {
      allowed = true;
    } else if (token) {
      const meta = await getBuylistAcceptTokenHash(id);
      if (
        meta?.hash &&
        hashAcceptToken(token) === meta.hash &&
        !(meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now())
      ) {
        allowed = true;
      }
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href={user ? "/conta" : "/"} className="text-sm font-semibold text-[var(--accent)]">
          {user ? "Voltar para a conta" : "Voltar para a loja"}
        </Link>

        {!submission || !allowed ? (
          <section className="surface-card mt-6 p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Cotação indisponível</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {messageFor(error || "unauthorized")} Entre com o e-mail da cotação ou use o link enviado pela loja.
            </p>
            {!user ? (
              <Link
                href={`/conta?redirectTo=${encodeURIComponent(`/buylist/${id}${token ? `?token=${token}` : ""}`)}`}
                className="mt-5 inline-flex h-11 items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Entrar na conta
              </Link>
            ) : null}
          </section>
        ) : (
          <BuylistCustomerPanel
            error={error}
            notice={notice}
            submission={submission}
            token={token}
          />
        )}
      </div>
    </main>
  );
}

function BuylistCustomerPanel({
  submission,
  token,
  notice,
  error
}: {
  submission: NonNullable<Awaited<ReturnType<typeof getBuylistSubmissionById>>>;
  token: string;
  notice: string;
  error: string;
}) {
  const status = normalizeBuylistStatus(submission.status);
  const expired = isOfferExpired(submission.offerExpiresAt);
  const canRespond = status === "offered" && !expired;
  const canShip = status === "awaiting_shipment" || status === "in_transit";

  return (
    <section className="surface-card mt-6 overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[var(--surface-soft)]/80 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Buylist</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Oferta da Mana Draw</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {submission.customerName} · {submission.game}
            </p>
          </div>
          <StatusBadge
            label={buylistStatusLabels[String(status)] ?? String(status)}
            className={buylistStatusStyles[String(status)]}
          />
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {(notice || error) && (
          <p
            className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-[var(--accent)]/25 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
            }`}
          >
            {messageFor(error || notice)}
          </p>
        )}

        <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Valor oferecido</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {submission.offerCents != null ? formatCurrency(submission.offerCents) : "—"}
          </p>
          {submission.offerExpiresAt ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Válida até {new Date(submission.offerExpiresAt).toLocaleString("pt-BR")}
              {expired ? " (expirada)" : ""}
            </p>
          ) : null}
          {submission.offerNote ? (
            <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{submission.offerNote}</p>
          ) : null}
        </div>

        {submission.notes ? (
          <div>
            <p className="text-sm font-semibold">Seu lote</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{submission.notes}</p>
          </div>
        ) : null}

        <BuylistPhotoGallery customerName={submission.customerName} photos={submission.photoUrls} />

        {canRespond ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={acceptBuylistOfferAction}>
              <input type="hidden" name="id" value={submission.id} />
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="h-12 w-full rounded-[var(--radius-control)] bg-[var(--accent)] text-sm font-bold text-white hover:bg-[var(--accent-strong)]"
              >
                Aceitar oferta
              </button>
            </form>
            <form action={declineBuylistOfferAction}>
              <input type="hidden" name="id" value={submission.id} />
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="h-12 w-full rounded-[var(--radius-control)] border border-rose-200 bg-rose-50 text-sm font-bold text-rose-800"
              >
                Recusar
              </button>
            </form>
          </div>
        ) : null}

        {canShip ? (
          <form action={updateBuylistInboundAction} className="grid gap-3 border-t border-[var(--line)] pt-5">
            <input type="hidden" name="id" value={submission.id} />
            <input type="hidden" name="token" value={token} />
            <h2 className="text-lg font-semibold">Como vai enviar o lote?</h2>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[var(--muted)]">Método</span>
              <select
                className={adminInputClass}
                name="inboundMethod"
                defaultValue={submission.inboundMethod ?? "mail"}
                required
              >
                <option value="mail">{inboundMethodLabels.mail}</option>
                <option value="pickup">{inboundMethodLabels.pickup}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[var(--muted)]">Código de rastreio (se Correios)</span>
              <input
                className={adminInputClass}
                name="trackingCode"
                defaultValue={submission.trackingCode ?? ""}
                placeholder="AA123456789BR"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[var(--muted)]">Data/hora da retirada (se loja)</span>
              <input
                className={adminInputClass}
                name="pickupAt"
                type="datetime-local"
                defaultValue={
                  submission.pickupAt
                    ? new Date(submission.pickupAt).toISOString().slice(0, 16)
                    : ""
                }
              />
            </label>
            <button
              type="submit"
              className="h-11 rounded-[var(--radius-control)] bg-[var(--ink)] text-sm font-semibold text-white"
            >
              Salvar envio
            </button>
          </form>
        ) : null}

        {status === "declined" ? (
          <p className="text-sm text-[var(--muted)]">Esta oferta foi recusada.</p>
        ) : null}
        {["received", "checking", "stocked", "paid"].includes(String(status)) ? (
          <p className="text-sm text-[var(--muted)]">
            Status atual: {buylistStatusLabels[String(status)]}. A loja cuida do restante.
          </p>
        ) : null}
      </div>
    </section>
  );
}
