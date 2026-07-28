"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload
} from "lucide-react";
import { useMemo, useState } from "react";
import { FieldLabel, adminInputClass } from "@/components/admin/ui";
import { formatCurrency, formatUsd } from "@/lib/format";
import type { BulkPriceMode, ResolvedImportRow } from "@/lib/manabox";
import type { CardCondition, TcgCard } from "@/lib/types";

const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const languages: TcgCard["language"][] = ["PT", "EN", "JP"];

type PreviewResponse = {
  ok: boolean;
  message?: string;
  format?: "csv" | "txt";
  warnings?: string[];
  rows?: ResolvedImportRow[];
  summary?: {
    total: number;
    ok: number;
    errors: number;
    quantity: number;
  };
};

type ImportResponse = {
  ok: boolean;
  message?: string;
  summary?: {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ line: number; name: string; message: string }>;
  };
};

export function BulkCardImport() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [defaultCondition, setDefaultCondition] = useState<CardCondition>("NM");
  const [defaultLanguage, setDefaultLanguage] = useState<TcgCard["language"]>("EN");
  const [priceMode, setPriceMode] = useState<BulkPriceMode>("zero");
  const [fixedPrice, setFixedPrice] = useState("");
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<ResolvedImportRow[]>([]);
  const [format, setFormat] = useState<"csv" | "txt" | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse["summary"] | null>(null);

  const okRows = useMemo(() => rows.filter((row) => row.status === "ok"), [rows]);
  const errorRows = useMemo(() => rows.filter((row) => row.status === "error"), [rows]);

  async function onFileChange(file: File | null) {
    setImportResult(null);
    setRows([]);
    setError(null);
    if (!file) {
      setFileName(null);
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".txt")) {
      setError("Envie um arquivo .csv ou .txt exportado do ManaBox.");
      return;
    }
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
  }

  async function preview() {
    setLoading("preview");
    setError(null);
    setImportResult(null);
    try {
      const response = await fetch("/api/admin/cards/bulk-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          defaultCondition,
          defaultLanguage,
          priceMode,
          fixedPrice
        })
      });
      const payload = (await response.json()) as PreviewResponse;
      if (!payload.ok) {
        setRows([]);
        setWarnings(payload.warnings ?? []);
        setError(payload.message || "Não foi possível ler o arquivo.");
        return;
      }
      setFormat(payload.format ?? null);
      setWarnings(payload.warnings ?? []);
      setRows(payload.rows ?? []);
    } catch {
      setError("Falha de rede ao pré-visualizar.");
    } finally {
      setLoading(null);
    }
  }

  async function confirmImport() {
    if (okRows.length === 0) return;
    setLoading("import");
    setError(null);
    try {
      const response = await fetch("/api/admin/cards/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: okRows })
      });
      const payload = (await response.json()) as ImportResponse;
      if (!payload.ok) {
        setError(payload.message || "Falha ao importar.");
        return;
      }
      setImportResult(payload.summary ?? null);
    } catch {
      setError("Falha de rede ao importar.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <FileSpreadsheet className="text-[var(--accent)]" size={17} />
              Importar ManaBox
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Aceita CSV da coleção e TXT no formato Arena/ManaBox. Preferimos Scryfall ID quando existir.
            </p>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]">
            <Upload size={14} />
            {fileName ? "Trocar arquivo" : "Escolher arquivo"}
            <input
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              type="file"
              onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {fileName ? (
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">Arquivo: {fileName}</p>
        ) : null}
        <textarea
          className={`${adminInputClass} mt-3 min-h-36 font-mono text-xs`}
          placeholder={`Exemplo CSV ManaBox:\nName,Set code,Collector number,Foil,Quantity,Scryfall ID,Condition,Language\nLightning Bolt,m10,146,,4,...,NM,en\n\nOu TXT:\n4 Lightning Bolt (M10) 146\n1 Sol Ring`}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setImportResult(null);
            setRows([]);
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FieldLabel label="Condição padrão">
          <select
            className={adminInputClass}
            value={defaultCondition}
            onChange={(event) => setDefaultCondition(event.target.value as CardCondition)}
          >
            {conditions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Idioma padrão">
          <select
            className={adminInputClass}
            value={defaultLanguage}
            onChange={(event) => setDefaultLanguage(event.target.value as TcgCard["language"])}
          >
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Preço de venda">
          <select
            className={adminInputClass}
            value={priceMode}
            onChange={(event) => setPriceMode(event.target.value as BulkPriceMode)}
          >
            <option value="zero">Deixar R$ 0 (ajustar depois)</option>
            <option value="purchase_brl">Usar preço de compra se for BRL</option>
            <option value="fixed">Valor fixo para todas</option>
          </select>
        </FieldLabel>
        {priceMode === "fixed" ? (
          <FieldLabel label="Valor fixo (BRL)">
            <input
              className={adminInputClass}
              min="0"
              step="0.01"
              type="number"
              value={fixedPrice}
              onChange={(event) => setFixedPrice(event.target.value)}
            />
          </FieldLabel>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
          disabled={!content.trim() || loading !== null}
          type="button"
          onClick={() => void preview()}
        >
          {loading === "preview" ? <Loader2 className="animate-spin" size={16} /> : null}
          Pré-visualizar
        </button>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-60"
          disabled={okRows.length === 0 || loading !== null}
          type="button"
          onClick={() => void confirmImport()}
        >
          {loading === "import" ? <Loader2 className="animate-spin" size={16} /> : null}
          Importar {okRows.length > 0 ? `${okRows.length} carta(s)` : ""}
        </button>
      </div>

      {error ? (
        <p className="flex items-start gap-2 text-sm text-rose-600">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          {error}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-[var(--radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {importResult ? (
        <div className="rounded-[var(--radius-control)] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} />
            Importação concluída
          </p>
          <p className="mt-1">
            {importResult.created} novas · {importResult.updated} estoque somado
            {importResult.errors.length > 0 ? ` · ${importResult.errors.length} erro(s) ao gravar` : ""}
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted)]">
            <span>
              Formato {format?.toUpperCase() ?? "—"} · {okRows.length} ok · {errorRows.length} erro(s) ·{" "}
              {okRows.reduce((sum, row) => sum + row.quantity, 0)} un.
            </span>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Carta</th>
                  <th className="px-3 py-2 font-semibold">Qtd</th>
                  <th className="px-3 py-2 font-semibold">Detalhe</th>
                  <th className="px-3 py-2 font-semibold">Mercado</th>
                  <th className="px-3 py-2 font-semibold">Venda</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.line}-${row.name}`} className="border-t border-[var(--line)]">
                    <td className="px-3 py-2 text-[var(--muted)]">{row.line}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-[var(--ink)]">{row.name}</p>
                      <p className="text-[var(--muted)]">
                        {row.setName}
                        {row.finish === "Foil" ? " · Foil" : ""}
                        {row.condition ? ` · ${row.condition}` : ""}
                        {row.language ? ` · ${row.language}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2">{row.quantity}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{row.rarity || "—"}</td>
                    <td className="px-3 py-2">
                      {row.marketPriceCents > 0 ? formatUsd(row.marketPriceCents) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.priceCents > 0 ? formatCurrency(row.priceCents) : "R$ 0"}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === "ok" ? (
                        <span className="font-semibold text-emerald-700">OK</span>
                      ) : (
                        <span className="font-semibold text-rose-600">{row.message || "Erro"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--ink)]">Melhorias sugeridas</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
          <li>Marcar linhas na prévia e importar só a seleção.</li>
          <li>Markup automático a partir do USD Scryfall + câmbio configurável.</li>
          <li>Exportar CSV só com as linhas que falharam para corrigir no ManaBox.</li>
          <li>Importar binders/listas com tag do nome da lista.</li>
          <li>Fila assíncrona para lotes grandes (&gt;500) com progresso.</li>
        </ul>
      </div>
    </div>
  );
}
