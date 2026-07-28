"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyLinkButton({
  label = "Copiar link do cliente",
  url
}: {
  label?: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
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
      {copied ? "Copiado" : label}
    </button>
  );
}
