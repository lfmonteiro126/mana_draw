"use client";

import { Camera, Check, ChevronLeft, ChevronRight, Send, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { createBuylistAction } from "@/app/actions";
import type { Game } from "@/lib/types";

const initialState = { ok: false, message: "" };
const games: Game[] = ["Magic", "Yu-Gi-Oh!", "Pokemon"];

export function BuylistForm() {
  const [state, formAction, pending] = useActionState(createBuylistAction, initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(0);

  const previews = useMemo(
    () => files.slice(0, 4).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [files]
  );

  return (
    <form action={formAction} className="surface-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)]/12 text-[var(--accent)]">
            <Camera size={18} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink)]">Enviar lote para cotação</h3>
            <p className="text-xs text-[var(--muted)]">Resposta em até 24h úteis.</p>
          </div>
        </div>
        <span className="rounded-[var(--radius-control)] bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--accent)] sm:hidden">
          {step + 1}/3
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {["Dados", "Fotos", "Detalhes"].map((label, index) => (
          <button
            key={label}
            className={`flex h-9 items-center justify-center gap-1 rounded-[var(--radius-control)] border text-xs font-semibold transition ${
              step === index
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            type="button"
            onClick={() => setStep(index)}
          >
            {step > index ? <Check size={13} /> : null}
            {label}
          </button>
        ))}
      </div>

      <div className={step === 0 ? "grid gap-3 sm:grid-cols-2" : "hidden sm:grid sm:grid-cols-2 sm:gap-3"}>
        <input className="field-input h-11 rounded-[var(--radius-control)] px-3 text-sm" name="customerName" placeholder="Seu nome" />
        <input className="field-input h-11 rounded-[var(--radius-control)] px-3 text-sm" name="email" placeholder="Email para retorno" type="email" />
        <select className="field-input h-11 rounded-[var(--radius-control)] px-3 text-sm sm:col-span-2" name="game" defaultValue="Magic">
          {games.map((game) => (
            <option key={game} value={game}>
              {game}
            </option>
          ))}
        </select>
      </div>

      <div className={step === 1 ? "grid gap-3" : "hidden sm:mt-3 sm:grid sm:gap-3"}>
        <label className="flex min-h-28 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)]">
          <UploadCloud size={18} />
          {files.length > 0 ? `${files.length} foto(s) selecionada(s)` : "Adicionar fotos do lote"}
          <input
            className="sr-only"
            name="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))}
          />
        </label>
      </div>

      <textarea
        className={`${step === 2 ? "mt-0" : "hidden sm:mt-3 sm:block"} field-input min-h-32 w-full rounded-[var(--radius-control)] p-3 text-sm`}
        name="notes"
        placeholder="Liste cartas principais, condições, idiomas e qualquer observação importante."
      />

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {previews.map((preview) => (
            <div key={preview.url} className="relative aspect-square overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-slate-100">
              <Image src={preview.url} alt={preview.name} fill unoptimized className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[var(--muted)]">
          Até 4 imagens, 3MB cada. Em produção, use armazenamento em S3/R2.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-4 text-sm font-semibold text-[var(--ink)] transition active:scale-95 disabled:opacity-40 sm:hidden"
            disabled={step === 0}
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
          {step < 2 ? (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 sm:hidden"
              type="button"
              onClick={() => setStep((current) => Math.min(2, current + 1))}
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Enviando..." : "Enviar cotação"}
              {pending ? null : <Send size={16} />}
            </button>
          )}
          <button
            className="hidden h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 disabled:opacity-50 sm:inline-flex"
            disabled={pending}
            type="submit"
          >
            {pending ? "Enviando..." : "Enviar cotação"}
            {pending ? null : <Send size={16} />}
          </button>
        </div>
      </div>

      {state.message && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm ${
            state.ok ? "bg-[var(--accent)]/10 text-[var(--accent-strong)]" : "bg-rose-50 text-rose-700"
          }`}
        >
          {!state.ok && <X size={16} />}
          {state.message}
        </div>
      )}
    </form>
  );
}
