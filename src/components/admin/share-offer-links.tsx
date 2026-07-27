"use client";

import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";

export function ShareOfferLinks({
  customerEmail,
  customerName,
  offerLabel,
  url
}: {
  customerEmail: string;
  customerName: string;
  offerLabel: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const subject = encodeURIComponent(`Oferta Mana Draw · ${offerLabel}`);
  const body = encodeURIComponent(
    `Olá, ${customerName}!\n\nTemos uma oferta de ${offerLabel} pelo seu lote.\n\nVeja e responda por este link:\n${url}\n\nMana Draw`
  );
  const mailto = `mailto:${encodeURIComponent(customerEmail)}?subject=${subject}&body=${body}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Olá, ${customerName}! Oferta Mana Draw de ${offerLabel}:\n${url}`
  )}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-soft)]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copie o link:", url);
          }
        }}
      >
        {copied ? <Check size={16} className="text-[var(--accent)]" /> : <Copy size={16} />}
        {copied ? "Copiado" : "Copiar link"}
      </button>
      <a
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-soft)]"
        href={mailto}
      >
        <Mail size={16} />
        Abrir e-mail
      </a>
      <a
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-soft)]"
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
      >
        <MessageCircle size={16} />
        WhatsApp
      </a>
    </div>
  );
}
