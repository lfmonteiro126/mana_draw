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
    <form action={formAction} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-[var(--ink)]">Enviar lote para cotacao</h3>
        </div>
        <span className="rounded-md bg-[var(--accent)]/15 px-2 py-1 text-xs font-semibold text-[var(--accent)] sm:hidden">
          {step + 1}/3
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {["Dados", "Fotos", "Detalhes"].map((label, index) => (
          <button
            key={label}
            className={`flex h-9 items-center justify-center gap-1 rounded-md border text-xs font-semibold transition ${
              step === index
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-[var(--surface-hover)]/30 text-[var(--muted)]"
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
        <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="customerName" placeholder="Seu nome" />
        <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="email" placeholder="Email para retorno" type="email" />
        <select className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="game" defaultValue="Magic">
          {games.map((game) => (
            <option key={game} value={game}>
              {game}
            </option>
          ))}
        </select>
      </div>

      <div className={step === 1 ? "grid gap-3" : "hidden sm:grid sm:gap-3"}>
        <label className="flex min-h-28 items-center justify-center gap-2 rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-hover)]/20 p-4 text-sm font-medium text-[var(--muted)] hover:border-white hover:text-white transition cursor-pointer">
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
        className={`${step === 2 ? "mt-0" : "hidden sm:block sm:mt-3"} min-h-32 w-full rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 p-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]`}
        name="notes"
        placeholder="Liste cartas principais, condicoes, idiomas e qualquer observacao importante."
      />

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {previews.map((preview) => (
            <div key={preview.url} className="relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-stone-800">
              <Image src={preview.url} alt={preview.name} fill unoptimized className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[var(--muted)]">
          Ate 4 imagens, 3MB cada. Em producao, substitua o armazenamento em banco por S3/R2.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/30 px-4 text-sm font-semibold text-[var(--ink)] transition active:scale-95 disabled:opacity-40 sm:hidden"
            disabled={step === 0}
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
          {step < 2 ? (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition active:scale-95 sm:hidden"
              type="button"
              onClick={() => setStep((current) => Math.min(2, current + 1))}
            >
              Continuar
              <ChevronRight size={16} />
            </button>
          ) : (
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition active:scale-95 disabled:opacity-50" disabled={pending} type="submit">
              {pending ? "Enviando..." : "Enviar cotacao"}
              {pending ? null : <Send size={16} />}
            </button>
          )}
          <button className="hidden h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition active:scale-95 disabled:opacity-50 sm:inline-flex" disabled={pending} type="submit">
            {pending ? "Enviando..." : "Enviar cotacao"}
            {pending ? null : <Send size={16} />}
          </button>
        </div>
      </div>

      {state.message && (
        <div className={`mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${state.ok ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-red-500/15 text-red-400"}`}>
          {!state.ok && <X size={16} />}
          {state.message}
        </div>
      )}
    </form>
  );
}
