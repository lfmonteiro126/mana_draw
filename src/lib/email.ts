import { formatCurrency } from "@/lib/format";

export function hasEmailProvider() {
  return Boolean(process.env.RESEND_API_KEY);
}

function emailFrom() {
  return process.env.EMAIL_FROM?.trim() || "Mana Draw <onboarding@resend.dev>";
}

export async function sendBuylistOfferEmail(input: {
  to: string;
  customerName: string;
  game: string;
  offerCents: number;
  offerNote?: string | null;
  offerUrl: string;
  expiresAt?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, reason: "not-configured" as const };
  }

  const expiresLabel = input.expiresAt
    ? new Date(input.expiresAt).toLocaleString("pt-BR")
    : null;
  const noteBlock = input.offerNote
    ? `<p style="margin:16px 0 0;color:#334155;line-height:1.5">${escapeHtml(input.offerNote)}</p>`
    : "";

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#152033">
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#0f9f90;font-weight:700">Mana Draw · Buylist</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">Olá, ${escapeHtml(input.customerName)}!</h1>
      <p style="margin:0;color:#5b677a;line-height:1.6">
        Recebemos seu lote de <strong>${escapeHtml(input.game)}</strong> e temos uma oferta:
      </p>
      <p style="margin:20px 0;font-size:32px;font-weight:700;letter-spacing:-0.02em">${formatCurrency(input.offerCents)}</p>
      ${noteBlock}
      ${expiresLabel ? `<p style="margin:12px 0 0;color:#5b677a;font-size:14px">Válida até ${escapeHtml(expiresLabel)}</p>` : ""}
      <p style="margin:28px 0 12px">
        <a href="${escapeHtml(input.offerUrl)}" style="display:inline-block;background:#0f9f90;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">
          Ver oferta e responder
        </a>
      </p>
      <p style="margin:0;color:#5b677a;font-size:13px;line-height:1.5">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <a href="${escapeHtml(input.offerUrl)}" style="color:#0f9f90;word-break:break-all">${escapeHtml(input.offerUrl)}</a>
      </p>
    </div>
  `;

  const text = [
    `Olá, ${input.customerName}!`,
    "",
    `Recebemos seu lote de ${input.game} e temos uma oferta de ${formatCurrency(input.offerCents)}.`,
    input.offerNote ? `\n${input.offerNote}\n` : "",
    expiresLabel ? `Válida até ${expiresLabel}.` : "",
    "",
    `Ver oferta e responder: ${input.offerUrl}`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: `Oferta Mana Draw · ${input.game} · ${formatCurrency(input.offerCents)}`,
        html,
        text
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Resend buylist offer failed", response.status, body);
      return { ok: false as const, reason: "send-failed" as const };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("Resend buylist offer error", error);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

export async function sendEmailVerification(input: {
  to: string;
  name: string;
  verifyUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, reason: "not-configured" as const };
  }

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#152033">
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#0f9f90;font-weight:700">Mana Draw</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">Confirme seu e-mail</h1>
      <p style="margin:0;color:#5b677a;line-height:1.6">
        Olá, ${escapeHtml(input.name)}. Para proteger suas cotações de buylist, confirme este endereço:
      </p>
      <p style="margin:28px 0 12px">
        <a href="${escapeHtml(input.verifyUrl)}" style="display:inline-block;background:#0f9f90;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">
          Verificar e-mail
        </a>
      </p>
      <p style="margin:0;color:#5b677a;font-size:13px;line-height:1.5">
        Se você não criou uma conta, ignore esta mensagem.<br/>
        Link: <a href="${escapeHtml(input.verifyUrl)}" style="color:#0f9f90;word-break:break-all">${escapeHtml(input.verifyUrl)}</a>
      </p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: "Confirme seu e-mail · Mana Draw",
        html,
        text: `Olá, ${input.name}!\n\nConfirme seu e-mail: ${input.verifyUrl}\n`
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Resend verify email failed", response.status, body);
      return { ok: false as const, reason: "send-failed" as const };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("Resend verify email error", error);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
