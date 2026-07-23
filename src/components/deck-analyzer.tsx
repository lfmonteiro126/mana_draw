"use client";

import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Swords,
  TriangleAlert,
  WandSparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { DeckAnalysis, DeckAnalyzeResponse } from "@/lib/deck";

const SAMPLE = `// Commander
1 Atraxa, Praetors' Voice

// Mainboard
1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Exotic Orchard
1 Path of Ancestry
1 Reliquary Tower
1 Swords to Plowshares
1 Path to Exile
1 Counterspell
1 Swan Song
1 Rhystic Study
1 Deepglow Skate
1 Contagion Engine
1 Inexorable Tide
1 Evolution Sage
1 Tekuthal, Inquiry Dominus
1 Bloated Contaminator
1 Venerated Rotpriest
1 Vraska, Betrayal's Sting
1 Smothering Tithe
1 Cyclonic Rift
1 Cultivate
1 Kodama's Reach
1 Eternal Witness
1 Beast Within
1 Assassin's Trophy
1 Teferi's Protection
1 Doubling Season
1 Plains
1 Island
1 Swamp
1 Forest
`;

export function DeckAnalyzer() {
  const [list, setList] = useState("");
  const [commanderName, setCommanderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<DeckAnalysis | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/deck-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list,
          commanderName: commanderName || undefined
        })
      });
      const payload = (await response.json()) as DeckAnalyzeResponse;
      if (!payload.ok) {
        setError(payload.message);
        return;
      }
      setAnalysis(payload.analysis);
    } catch {
      setError("Não foi possível analisar agora. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pb-10">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Mana Draw">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white">
              NM
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">Mana Draw</span>
              <span className="block text-xs text-[var(--muted)]">Analisador Commander</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
          >
            <ArrowLeft size={16} />
            Loja
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 text-sm font-semibold text-[var(--accent)]">Commander</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            Analisador de deck
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
            Cole sua lista (Moxfield, Archidekt, MTGO…). Estimamos bracket, curva,
            sinergia, arquétipos e melhorias — focado só em Commander.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-[var(--muted)]">Decklist</span>
              <textarea
                className="min-h-[280px] w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 py-3 font-mono text-xs leading-5 text-[var(--ink)] outline-none focus:border-[var(--accent)] sm:min-h-[360px] sm:text-sm"
                placeholder={`// Commander\n1 Seu Comandante\n\n// Mainboard\n1 Sol Ring\n1 Command Tower\n...`}
                value={list}
                onChange={(event) => setList(event.target.value)}
              />
            </label>

            <label className="mt-4 grid gap-2">
              <span className="text-sm font-medium text-[var(--muted)]">
                Comandante (opcional, se a lista não tiver seção)
              </span>
              <input
                className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                placeholder="Ex.: Atraxa, Praetors' Voice"
                value={commanderName}
                onChange={(event) => setCommanderName(event.target.value)}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || list.trim().length < 20}
                onClick={runAnalysis}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <WandSparkles size={16} />}
                {loading ? "Analisando…" : "Analisar deck"}
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                onClick={() => setList(SAMPLE)}
              >
                Usar exemplo
              </button>
            </div>

            {error && (
              <p className="mt-4 flex items-start gap-2 text-sm text-rose-300">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="min-w-0">
            {!analysis && !loading && (
              <div className="grid h-full min-h-[320px] place-items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)]/40 p-8 text-center">
                <div>
                  <Swords className="mx-auto mb-3 text-[var(--muted)]" size={32} />
                  <p className="font-semibold text-[var(--ink)]">Pronto para ler sua lista</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    O resultado aparece aqui: bracket, curva, papéis, sinergia e sugestões.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="grid h-full min-h-[320px] place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-3 animate-spin text-[var(--accent)]" size={28} />
                  <p className="font-semibold text-[var(--ink)]">Consultando Scryfall e montando o relatório…</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Listas grandes podem levar alguns segundos.</p>
                </div>
              </div>
            )}

            {analysis && <AnalysisReport analysis={analysis} />}
          </div>
        </div>
      </section>
    </main>
  );
}

function AnalysisReport({ analysis }: { analysis: DeckAnalysis }) {
  const maxCurve = Math.max(...analysis.manaCurve.map((bin) => bin.count), 1);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            {analysis.commander?.imageUrl ? (
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-[var(--line)]">
                <Image
                  src={analysis.commander.imageUrl}
                  alt={analysis.commander.name}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ) : (
              <div className="grid h-28 w-20 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface-soft)] text-xs text-[var(--muted)]">
                N/A
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Comandante</p>
              <h2 className="text-xl font-semibold text-[var(--ink)]">
                {analysis.commander?.name ?? "Não identificado"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Identidade: {analysis.colorIdentity.length ? analysis.colorIdentity.join("") : "—"}
                {" · "}
                {analysis.maindeckCount}/{analysis.expectedMaindeck} no main
                {" · "}
                CMC médio {analysis.averageCmc}
              </p>
              {analysis.partners.length > 0 && (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Partner: {analysis.partners.map((card) => card.name).join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 sm:min-w-[220px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Bracket estimado</p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{analysis.bracket.label}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Confiança {analysis.bracket.confidence} · {analysis.bracket.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Curva de mana (não-terrenos)">
          <div className="flex h-40 items-end gap-2">
            {analysis.manaCurve.map((bin) => (
              <div key={bin.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-[var(--muted)]">{bin.count || ""}</span>
                <div
                  className="w-full rounded-t bg-[var(--accent)]/80"
                  style={{ height: `${Math.max(6, (bin.count / maxCurve) * 100)}%` }}
                  title={`${bin.label}: ${bin.count}`}
                />
                <span className="text-[11px] font-medium text-[var(--muted)]">{bin.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">{analysis.landCount} terrenos detectados</p>
        </Panel>

        <Panel title="Arquétipos sugeridos">
          <div className="grid gap-2">
            {analysis.archetypes.map((archetype, index) => (
              <div key={archetype.id} className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {index === 0 ? "Principal · " : ""}
                    {archetype.label}
                  </p>
                  <span className="text-xs text-[var(--muted)]">score {archetype.score}</span>
                </div>
                {archetype.evidence.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">{archetype.evidence.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Sinais do bracket">
        <ul className="grid gap-1.5 text-sm text-[var(--muted)]">
          {analysis.bracket.signals.map((signal) => (
            <li key={signal}>· {signal}</li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Pontos fortes">
          {analysis.strengths.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Poucos pontos fortes claros — foque nas sugestões ao lado.</p>
          ) : (
            <div className="grid gap-3">
              {analysis.strengths.map((item) => (
                <div key={item.title}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <Sparkles size={14} className="text-[var(--gold)]" />
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Sugestões e otimizações">
          <div className="grid gap-3">
            {analysis.suggestions.map((item) => (
              <div key={item.title} className="rounded-md border border-[var(--line)] bg-[var(--background)]/40 px-3 py-2">
                <p className={`text-sm font-semibold ${severityTone(item.severity)}`}>{item.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                {item.relatedCards && item.relatedCards.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.relatedCards.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Sinergia">
        <ul className="grid gap-2 text-sm text-[var(--muted)]">
          {analysis.synergyNotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Composição por papel">
        <div className="grid gap-2 sm:grid-cols-2">
          {analysis.roles.map((role) => (
            <div key={role.role} className="rounded-md border border-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">{role.label}</p>
                <span className="text-xs font-semibold text-[var(--accent)]">{role.count}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{role.cards.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Panel>

      <p className="text-xs text-[var(--muted)]">
        Análise heurística com dados Scryfall · {new Date(analysis.analyzedAt).toLocaleString("pt-BR")} ·
        Bracket é estimativa para alinhar mesa, não veredito oficial.
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">{title}</h3>
      {children}
    </section>
  );
}

function severityTone(severity: "info" | "warn" | "critical") {
  if (severity === "critical") return "text-rose-300";
  if (severity === "warn") return "text-amber-300";
  return "text-[var(--ink)]";
}
