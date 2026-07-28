"use client";

import { Plus, Rows3 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createCardAction } from "@/app/actions";
import { BulkCardImport } from "@/components/admin/bulk-card-import";
import { CardAutocomplete } from "@/components/card-autocomplete";

type Mode = "single" | "bulk";

export function NewCardEntry() {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <ModeButton
          active={mode === "single"}
          icon={<Plus size={15} />}
          label="Uma carta"
          onClick={() => setMode("single")}
        />
        <ModeButton
          active={mode === "bulk"}
          icon={<Rows3 size={15} />}
          label="Em lote (ManaBox)"
          onClick={() => setMode("bulk")}
        />
      </div>

      {mode === "single" ? (
        <form action={createCardAction} className="grid gap-3">
          <input type="hidden" name="tab" value="new-card" />
          <CardAutocomplete />
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
            <input className="h-4 w-4 accent-[var(--accent)]" name="featured" type="checkbox" />
            Destacar na vitrine
          </label>
          <button
            className="h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)]"
            type="submit"
          >
            Cadastrar carta
          </button>
        </form>
      ) : (
        <BulkCardImport />
      )}
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-xs font-semibold transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
      }`}
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
