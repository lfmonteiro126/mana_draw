"use client";

import {
  ArrowLeft,
  Check,
  Flame,
  Landmark,
  Layers,
  Loader2,
  Mountain,
  ScrollText,
  Sparkles,
  Swords,
  TriangleAlert,
  WandSparkles,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnalyzedCard, DeckAnalysis, DeckAnalyzeResponse } from "@/lib/deck";

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

type ViewMode = "visual" | "insights";

type StackGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  cards: AnalyzedCard[];
};

export function DeckAnalyzer() {
  const [list, setList] = useState("");
  const [commanderName, setCommanderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<DeckAnalysis | null>(null);
  const [view, setView] = useState<ViewMode>("visual");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(true);

  const selectedCard = useMemo(() => {
    if (!analysis) return null;
    const pool = analysis.cards;
    if (selectedName) {
      return pool.find((card) => card.name === selectedName) ?? analysis.commander;
    }
    return analysis.commander ?? pool[0] ?? null;
  }, [analysis, selectedName]);

  useEffect(() => {
    if (analysis?.commander) setSelectedName(analysis.commander.name);
  }, [analysis]);

  async function runAnalysis() {
    setLoading(true);
    setError("");

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
      setEditorOpen(false);
      setView("visual");
    } catch {
      setError("Não foi possível analisar agora. Tente de novo em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`min-h-screen ${analysis ? "pb-[4.5rem]" : "pb-10"}`}>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Mana Draw">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--accent)] text-sm font-semibold text-white">
              NM
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold tracking-wide">Mana Draw</span>
              <span className="block text-xs text-[var(--muted)]">Analisador Commander</span>
            </span>
          </Link>

          {analysis && (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1">
              <ViewTab active={view === "visual"} onClick={() => setView("visual")}>
                <Layers size={14} />
                Visual
              </ViewTab>
              <ViewTab active={view === "insights"} onClick={() => setView("insights")}>
                <Sparkles size={14} />
                Análise
              </ViewTab>
            </div>
          )}

          <div className="flex items-center gap-2">
            {analysis && (
              <button
                type="button"
                onClick={() => setEditorOpen((open) => !open)}
                className="hidden h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] sm:inline-flex"
              >
                <ScrollText size={15} />
                {editorOpen ? "Ocultar lista" : "Editar lista"}
              </button>
            )}
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Loja</span>
            </Link>
          </div>
        </div>
      </header>

      {(editorOpen || !analysis) && (
        <section className="border-b border-[var(--line)] bg-[var(--surface)]/40">
          <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              {!analysis && (
                <div className="mb-4">
                  <p className="mb-1 text-sm font-semibold text-[var(--accent)]">Commander</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
                    Analisador de deck
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                    Cole a lista e veja stacks visuais, bracket, curva e sugestões — no estilo de um deck builder moderno.
                  </p>
                </div>
              )}
              <textarea
                className="min-h-[180px] w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 py-3 font-mono text-xs leading-5 text-[var(--ink)] outline-none focus:border-[var(--accent)] sm:min-h-[220px] sm:text-sm"
                placeholder={`// Commander\n1 Seu Comandante\n\n// Mainboard\n1 Sol Ring\n...`}
                value={list}
                onChange={(event) => setList(event.target.value)}
              />
            </div>

            <div className="flex flex-col justify-between gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[var(--muted)]">Comandante (opcional)</span>
                <input
                  className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  placeholder="Ex.: Atraxa, Praetors' Voice"
                  value={commanderName}
                  onChange={(event) => setCommanderName(event.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || list.trim().length < 20}
                  onClick={runAnalysis}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <WandSparkles size={16} />}
                  {loading ? "Analisando…" : "Analisar deck"}
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                  onClick={() => setList(SAMPLE)}
                >
                  Exemplo
                </button>
              </div>

              {error && (
                <p className="flex items-start gap-2 text-sm text-rose-300">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {loading && !analysis && (
        <div className="mx-auto grid max-w-[1400px] place-items-center px-4 py-24">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 animate-spin text-[var(--accent)]" size={32} />
            <p className="font-semibold text-[var(--ink)]">Montando visual stacks e relatório…</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Consultando Scryfall</p>
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="mx-auto grid max-w-[1400px] place-items-center px-4 py-20">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              <Swords className="text-[var(--accent)]" size={28} />
            </div>
            <p className="text-lg font-semibold text-[var(--ink)]">Pronto para o seu deck</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              O resultado abre em visual stacks com preview da carta, bracket na barra inferior e insights de sinergia.
            </p>
          </div>
        </div>
      )}

      {analysis && view === "visual" && (
        <DeckVisualBoard
          analysis={analysis}
          selectedCard={selectedCard}
          onSelect={setSelectedName}
        />
      )}

      {analysis && view === "insights" && (
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <InsightsBoard analysis={analysis} />
        </div>
      )}

      {analysis && <StatusBar analysis={analysis} />}
    </main>
  );
}

function DeckVisualBoard({
  analysis,
  selectedCard,
  onSelect
}: {
  analysis: DeckAnalysis;
  selectedCard: AnalyzedCard | null;
  onSelect: (name: string) => void;
}) {
  const groups = useMemo(() => buildStackGroups(analysis), [analysis]);

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-[73px] lg:self-start">
        <CardPreviewPanel card={selectedCard} analysis={analysis} />
      </aside>

      <div className="min-w-0 overflow-x-auto pb-2">
        <div className="flex min-w-max items-start gap-5 xl:min-w-0 xl:gap-4">
          {groups.map((group) => (
            <VisualStack
              key={group.id}
              group={group}
              selectedName={selectedCard?.name}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardPreviewPanel({
  card,
  analysis
}: {
  card: AnalyzedCard | null;
  analysis: DeckAnalysis;
}) {
  if (!card) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)]/50 p-6 text-center text-sm text-[var(--muted)]">
        Selecione uma carta no stack
      </div>
    );
  }

  const flags = [
    card.isGameChanger ? "Game Changer" : null,
    card.isFastMana ? "Fast mana" : null,
    card.roles.includes("tutor") ? "Tutor" : null,
    card.roles.includes("ramp") ? "Ramp" : null,
    card.roles.includes("draw") ? "Draw" : null,
    card.roles.includes("removal") ? "Remoção" : null
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="relative aspect-[5/7] w-full bg-black/40">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            unoptimized
            className="object-cover"
            sizes="260px"
            priority
          />
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {card.section === "commander" ? "Comandante" : "Maindeck"}
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-[var(--ink)]">{card.name}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{card.typeLine}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[var(--surface-hover)] px-2 py-1 text-[11px] font-semibold text-[var(--ink)]">
            CMC {card.cmc}
          </span>
          {card.colorIdentity.map((color) => (
            <span
              key={color}
              className="rounded-md bg-[var(--surface-hover)] px-2 py-1 text-[11px] font-semibold text-[var(--ink)]"
            >
              {color}
            </span>
          ))}
        </div>

        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <span
                key={String(flag)}
                className="rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]"
              >
                {flag}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-[var(--line)] bg-[var(--background)]/50 p-3">
          <p className="text-xs font-semibold text-[var(--muted)]">No contexto do deck</p>
          <p className="mt-1 text-sm text-[var(--ink)]">
            {analysis.archetypes[0]
              ? `Arquétipo líder: ${analysis.archetypes[0].label}`
              : "Sem arquétipo dominante"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{analysis.bracket.summary}</p>
        </div>

        <Link
          href="/#catalogo"
          className="flex h-10 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
        >
          Ver no catálogo
        </Link>
      </div>
    </div>
  );
}

function VisualStack({
  group,
  selectedName,
  onSelect
}: {
  group: StackGroup;
  selectedName?: string;
  onSelect: (name: string) => void;
}) {
  const peek = 28;
  const cardHeight = 168;
  const stackHeight = cardHeight + Math.max(0, group.cards.length - 1) * peek;

  return (
    <div className="w-[148px] shrink-0 xl:w-[min(160px,100%)] xl:flex-1 xl:min-w-[132px]">
      <div className="mb-3 flex items-center gap-2 px-0.5">
        <span className="text-[var(--accent)]">{group.icon}</span>
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          {group.label}
          <span className="ml-1 text-[var(--muted)]">({group.cards.length})</span>
        </h3>
      </div>

      <div className="relative" style={{ height: stackHeight }}>
        {group.cards.map((card, index) => {
          const selected = card.name === selectedName;
          return (
            <button
              key={`${group.id}-${card.name}-${index}`}
              type="button"
              onClick={() => onSelect(card.name)}
              className={`deck-stack-card absolute left-0 right-0 overflow-hidden rounded-lg border bg-black/30 text-left shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none ${
                selected
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                  : "border-white/10 hover:border-white/25"
              }`}
              style={{
                top: index * peek,
                zIndex: selected ? 30 : index + 1,
                height: cardHeight
              }}
              aria-label={card.name}
            >
              {card.imageUrl ? (
                <Image
                  src={card.imageUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover object-top"
                  sizes="160px"
                />
              ) : (
                <div className="grid h-full place-items-center bg-[var(--surface-soft)] px-2 text-center text-xs text-[var(--muted)]">
                  {card.name}
                </div>
              )}
              <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-2 pb-6 pt-1.5">
                <p className="truncate text-[11px] font-semibold text-white drop-shadow">{card.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InsightsBoard({ analysis }: { analysis: DeckAnalysis }) {
  const maxCurve = Math.max(...analysis.manaCurve.map((bin) => bin.count), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Bracket estimado">
        <p className="text-2xl font-semibold text-[var(--ink)]">{analysis.bracket.label}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{analysis.bracket.summary}</p>
        <ul className="mt-4 grid gap-1.5 text-sm text-[var(--muted)]">
          {analysis.bracket.signals.map((signal) => (
            <li key={signal} className="flex gap-2">
              <Check size={14} className="mt-1 shrink-0 text-[var(--accent)]" />
              <span>{signal}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Curva de mana">
        <div className="flex h-44 items-end gap-2">
          {analysis.manaCurve.map((bin) => (
            <div key={bin.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-[var(--muted)]">{bin.count || ""}</span>
              <div
                className="w-full rounded-t-md bg-[var(--accent)]"
                style={{ height: `${Math.max(8, (bin.count / maxCurve) * 100)}%` }}
              />
              <span className="text-[11px] font-medium text-[var(--muted)]">{bin.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          CMC médio {analysis.averageCmc} · {analysis.landCount} terrenos
        </p>
      </Panel>

      <Panel title="Arquétipos">
        <div className="grid gap-2">
          {analysis.archetypes.map((archetype, index) => (
            <div key={archetype.id} className="rounded-xl border border-[var(--line)] bg-[var(--background)]/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {index === 0 ? "Principal · " : ""}
                  {archetype.label}
                </p>
                <span className="text-xs text-[var(--muted)]">{archetype.score}</span>
              </div>
              {archetype.evidence.length > 0 && (
                <p className="mt-1 text-xs text-[var(--muted)]">{archetype.evidence.join(" · ")}</p>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Sinergia">
        <ul className="grid gap-2 text-sm text-[var(--muted)]">
          {analysis.synergyNotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Pontos fortes">
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
      </Panel>

      <Panel title="Sugestões">
        <div className="grid gap-2">
          {analysis.suggestions.map((item) => (
            <div key={item.title} className="rounded-xl border border-[var(--line)] bg-[var(--background)]/40 px-3 py-2.5">
              <p className={`text-sm font-semibold ${severityTone(item.severity)}`}>{item.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
              {item.relatedCards && item.relatedCards.length > 0 && (
                <p className="mt-1 text-xs text-[var(--muted)]">{item.relatedCards.join(" · ")}</p>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Composição por papel">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.roles.map((role) => (
              <div key={role.role} className="rounded-xl border border-[var(--line)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">{role.label}</p>
                  <span className="text-xs font-semibold text-[var(--accent)]">{role.count}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{role.cards.join(" · ")}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatusBar({ analysis }: { analysis: DeckAnalysis }) {
  const counts = useMemo(() => {
    const cards = analysis.cards.filter((card) => card.section === "main" || card.section === "commander");
    return {
      creatures: cards.filter((card) => /creature/i.test(card.typeLine)).length,
      instants: cards.filter((card) => /instant/i.test(card.typeLine)).length,
      sorceries: cards.filter((card) => /sorcery/i.test(card.typeLine)).length,
      artifacts: cards.filter((card) => /artifact/i.test(card.typeLine) && !/creature/i.test(card.typeLine)).length,
      enchantments: cards.filter((card) => /enchantment/i.test(card.typeLine) && !/creature/i.test(card.typeLine)).length,
      lands: cards.filter((card) => /land/i.test(card.typeLine)).length
    };
  }, [analysis.cards]);

  return (
    <div className="deck-status-bar fixed inset-x-0 bottom-0 z-40 border-t border-teal-500/20 bg-[#0c1520]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm sm:px-6">
        <p className="font-semibold text-[var(--ink)]">
          {analysis.totalCards} cartas
          <span className="ml-2 font-normal text-[var(--muted)]">
            {analysis.maindeckCount}/{analysis.expectedMaindeck} main
          </span>
        </p>

        <span className="hidden h-4 w-px bg-[var(--line)] sm:block" />

        <p className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent)]">
          <Check size={15} />
          Bracket {analysis.bracket.bracket}
        </p>

        <span className="hidden h-4 w-px bg-[var(--line)] sm:block" />

        <p className="text-[var(--muted)]">
          CMC médio <span className="font-semibold text-[var(--ink)]">{analysis.averageCmc}</span>
        </p>

        <span className="hidden h-4 w-px bg-[var(--line)] md:block" />

        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] sm:text-sm">
          <MetaCount icon={<Swords size={13} />} label={`${counts.creatures} criaturas`} />
          <MetaCount icon={<Zap size={13} />} label={`${counts.instants} instants`} />
          <MetaCount icon={<Flame size={13} />} label={`${counts.sorceries} sorceries`} />
          <MetaCount icon={<Layers size={13} />} label={`${counts.artifacts} artifacts`} />
          <MetaCount icon={<Sparkles size={13} />} label={`${counts.enchantments} ench.`} />
          <MetaCount icon={<Mountain size={13} />} label={`${counts.lands} lands`} />
        </div>
      </div>
    </div>
  );
}

function buildStackGroups(analysis: DeckAnalysis): StackGroup[] {
  const commanders = [
    ...(analysis.commander ? [analysis.commander] : []),
    ...analysis.partners
  ];
  const main = analysis.cards.filter((card) => card.section === "main");

  const buckets: StackGroup[] = [
    {
      id: "commander",
      label: "Commander",
      icon: <Swords size={14} />,
      cards: commanders
    },
    {
      id: "planeswalkers",
      label: "Planeswalkers",
      icon: <Sparkles size={14} />,
      cards: main.filter((card) => /planeswalker/i.test(card.typeLine))
    },
    {
      id: "creatures",
      label: "Creatures",
      icon: <Swords size={14} />,
      cards: main.filter(
        (card) => /creature/i.test(card.typeLine) && !/planeswalker/i.test(card.typeLine)
      )
    },
    {
      id: "instants",
      label: "Instants",
      icon: <Zap size={14} />,
      cards: main.filter((card) => /instant/i.test(card.typeLine))
    },
    {
      id: "sorceries",
      label: "Sorceries",
      icon: <Flame size={14} />,
      cards: main.filter((card) => /sorcery/i.test(card.typeLine))
    },
    {
      id: "artifacts",
      label: "Artifacts",
      icon: <Layers size={14} />,
      cards: main.filter(
        (card) => /artifact/i.test(card.typeLine) && !/creature/i.test(card.typeLine)
      )
    },
    {
      id: "enchantments",
      label: "Enchantments",
      icon: <Sparkles size={14} />,
      cards: main.filter(
        (card) =>
          /enchantment/i.test(card.typeLine) &&
          !/creature/i.test(card.typeLine) &&
          !/artifact/i.test(card.typeLine)
      )
    },
    {
      id: "lands",
      label: "Lands",
      icon: <Landmark size={14} />,
      cards: main.filter((card) => /land/i.test(card.typeLine))
    }
  ];

  const used = new Set(buckets.flatMap((group) => group.cards.map((card) => card.name)));
  const other = main.filter((card) => !used.has(card.name));
  if (other.length) {
    buckets.push({
      id: "other",
      label: "Other",
      icon: <ScrollText size={14} />,
      cards: other
    });
  }

  return buckets
    .map((group) => ({
      ...group,
      cards: [...group.cards].sort((a, b) => a.name.localeCompare(b.name))
    }))
    .filter((group) => group.cards.length > 0);
}

function ViewTab({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function MetaCount({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[var(--accent)]">{icon}</span>
      {label}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
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
