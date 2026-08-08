import { Camera, Check, ChevronLeft, ChevronRight, Send, Sparkles, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createBuylistAction } from "@/app/actions";
import { CardScannerModal } from "@/components/scanner/card-scanner-modal";
import { formatCurrency } from "@/lib/format";
import type { ScannedCardResult } from "@/lib/scanner/scryfall";
import type { Game } from "@/lib/types";

const initialState = { ok: false, message: "" };
const games: Game[] = ["Magic", "Yu-Gi-Oh!", "Pokemon"];

export function BuylistForm({
  defaultEmail = "",
  defaultName = ""
}: {
  defaultEmail?: string;
  defaultName?: string;
}) {
  const [state, formAction, pending] = useActionState(createBuylistAction, initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [customerName, setCustomerName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [notes, setNotes] = useState("");
  const [scannedCards, setScannedCards] = useState<ScannedCardResult[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [stepError, setStepError] = useState("");

  const previews = useMemo(
    () => files.slice(0, 4).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function canContinueFromStep0() {
    const nameOk = customerName.trim().length >= 2;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return nameOk && emailOk;
  }

  function goNext() {
    if (step === 0 && !canContinueFromStep0()) {
      setStepError("Informe nome e um email válido para continuar.");
      return;
    }
    setStepError("");
    setStep((current) => Math.min(2, current + 1));
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="surface-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] bg-[var(--accent)]/12 text-[var(--accent)]">
            <Camera size={18} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink)]">Enviar lote para cotação</h3>
            <p className="text-xs text-[var(--muted)]">
              {defaultEmail
                ? "Resposta na sua conta e por e-mail/link, em até 24h úteis."
                : "Use o mesmo e-mail da conta para ver a oferta em /conta."}
            </p>
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
            onClick={() => {
              if (index > 0 && !canContinueFromStep0()) {
                setStepError("Informe nome e um email válido para continuar.");
                setStep(0);
                return;
              }
              setStepError("");
              setStep(index);
            }}
          >
            {step > index ? <Check size={13} /> : null}
            {label}
          </button>
        ))}
      </div>

      <div className={step === 0 ? "grid gap-3 sm:grid-cols-2" : "hidden sm:grid sm:grid-cols-2 sm:gap-3"}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-[var(--muted)]">Nome</span>
          <input
            className="field-input h-11 rounded-[var(--radius-control)] px-3 text-sm"
            name="customerName"
            placeholder="Seu nome"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-[var(--muted)]">Email</span>
          <input
            className="field-input h-11 rounded-[var(--radius-control)] px-3 text-sm"
            name="email"
            placeholder="Email para retorno"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-[var(--muted)]">Jogo</span>
          <select className="field-input h-11 rounded-[var(--radius-control)] px-3 text-sm" name="game" defaultValue="Magic">
            {games.map((game) => (
              <option key={game} value={game}>
                {game}
              </option>
            ))}
          </select>
        </label>
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

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-emerald-500/30 bg-emerald-950/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-950/20 active:scale-95"
        >
          <Camera size={15} className="text-emerald-600" />
          Escanear Carta MTG pela Câmera
        </button>

        {scannedCards.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Sparkles size={13} />
            {scannedCards.length} carta(s) escaneada(s)
          </span>
        )}
      </div>

      <label className={`${step === 2 ? "mt-3 grid gap-1.5" : "hidden sm:mt-3 sm:grid sm:gap-1.5"} text-sm`}>
        <span className="font-medium text-[var(--muted)]">Observações e Lista de Cartas</span>
        <textarea
          className="field-input min-h-32 w-full rounded-[var(--radius-control)] p-3 text-sm font-mono text-xs"
          name="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Liste cartas principais, condições, idiomas ou use o Scanner pela Câmera acima."
        />
      </label>

      <CardScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="buylist"
        title="Scanner Buylist • Mana Draw"
        onSelectForBuylist={(scanned) => {
          setScannedCards((prev) => [...prev, scanned]);
          const line = `• 1x ${scanned.name} (${scanned.setCode} #${scanned.collectorNumber}) - Ref: ${
            scanned.marketPriceCents > 0 ? formatCurrency(scanned.marketPriceCents) : "Sob Consulta"
          }`;
          setNotes((prev) => (prev ? `${prev}\n${line}` : line));
          setScannerOpen(false);
        }}
      />

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {previews.map((preview, index) => (
            <div key={preview.url} className="relative aspect-square overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-slate-100">
              <Image src={preview.url} alt={preview.name} fill unoptimized className="object-cover" />
              <button
                type="button"
                aria-label={`Remover ${preview.name}`}
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-slate-950/65 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[var(--muted)]">Até 4 imagens, 3MB cada.</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-4 text-sm font-semibold text-[var(--ink)] transition active:scale-95 disabled:opacity-40 sm:hidden"
            disabled={step === 0}
            type="button"
            onClick={() => {
              setStepError("");
              setStep((current) => Math.max(0, current - 1));
            }}
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
          {step < 2 ? (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] active:scale-95 sm:hidden"
              type="button"
              onClick={goNext}
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
            disabled={pending || !canContinueFromStep0()}
            type="submit"
          >
            {pending ? "Enviando..." : "Enviar cotação"}
            {pending ? null : <Send size={16} />}
          </button>
        </div>
      </div>

      {stepError ? (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {stepError}
        </p>
      ) : null}

      {state.message ? (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-start gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm ${
            state.ok ? "bg-[var(--accent)]/10 text-[var(--accent-strong)]" : "bg-rose-50 text-rose-700"
          }`}
        >
          {!state.ok && <X size={16} />}
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
