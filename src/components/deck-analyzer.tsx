"use client";

import {
  ArrowLeft,
  Check,
  Flame,
  Home,
  Landmark,
  Layers,
  Loader2,
  ScrollText,
  Sparkles,
  Swords,
  TriangleAlert,
  WandSparkles,
  Zap
} from "lucide-react";
import { Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnalyzedCard, DeckAnalysis, DeckAnalyzeResponse } from "@/lib/deck";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap"
});

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

const COLOR_PIP: Record<string, string> = {
  W: "#f0e6d0",
  U: "#0e68ab",
  B: "#150b00",
  R: "#d3202a",
  G: "#00733e"
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
    if (selectedName) {
      return analysis.cards.find((card) => card.name === selectedName) ?? analysis.commander;
    }
    return analysis.commander ?? analysis.cards[0] ?? null;
  }, [analysis, selectedName]);

  useEffect(() => {
    if (analysis?.commander) setSelectedName(analysis.commander.name);
  }, [analysis]);

  useEffect(() => {
    document.body.classList.add("deck-lab");
    return () => document.body.classList.remove("deck-lab");
  }, []);

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
    <main
      className={`deck-app min-h-screen ${outfit.className} ${
        analysis ? "pb-[calc(7.5rem+var(--safe-bottom))] md:pb-16" : "pb-10"
      }`}
    >
      <header className="sticky top-0 z-40 border-b border-[var(--deck-stroke)] bg-[#070a10]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-3" aria-label="Mana Draw">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-xs font-bold tracking-wide text-white transition group-hover:bg-[var(--accent-strong)]">
              NM
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold tracking-wide text-[var(--ink)]">
                {analysis ? "Deck lab" : "Mana Draw"}
              </span>
              <span className="hidden text-[11px] text-[var(--muted)] sm:block">
                Commander analyzer
              </span>
            </span>
          </Link>

          {analysis ? (
            <div className="hidden items-center rounded-full border border-[var(--deck-stroke)] bg-[var(--deck-panel)]/90 p-1 md:flex">
              <ViewTab active={view === "visual"} onClick={() => setView("visual")}>
                <Layers size={13} />
                Visual stacks
              </ViewTab>
              <ViewTab active={view === "insights"} onClick={() => setView("insights")}>
                <Sparkles size={13} />
                Insights
              </ViewTab>
            </div>
          ) : (
            <p className="hidden text-xs text-[var(--muted)] md:block">
              Bracket · curva · sinergia · upgrades
            </p>
          )}

          <div className="flex items-center gap-2">
            {analysis && (
              <button
                type="button"
                onClick={() => setEditorOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--deck-stroke)] bg-[var(--deck-panel)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:border-white/20 hover:bg-[var(--deck-panel-2)] md:px-3.5"
                aria-label={editorOpen ? "Fechar lista" : "Editar lista"}
              >
                <ScrollText size={14} />
                <span className="hidden sm:inline">{editorOpen ? "Fechar lista" : "Editar lista"}</span>
              </button>
            )}
            <Link
              href="/"
              className="hidden h-9 items-center gap-2 rounded-full border border-[var(--deck-stroke)] bg-[var(--deck-panel)] px-3.5 text-xs font-semibold text-[var(--ink)] transition hover:border-white/20 hover:bg-[var(--deck-panel-2)] md:inline-flex"
            >
              <ArrowLeft size={14} />
              Loja
            </Link>
          </div>
        </div>
      </header>

      {(editorOpen || !analysis) && (
        <section className="border-b border-[var(--deck-stroke)] bg-[var(--deck-rail)]/70">
          <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.35fr_0.75fr] lg:items-end">
            <div className="deck-rise">
              {!analysis && (
                <div className="mb-5 max-w-2xl">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                    Commander analyzer
                  </p>
                  <h1 className="text-balance text-[2rem] font-semibold leading-[1.1] tracking-tight text-[var(--ink)] sm:text-[2.5rem]">
                    Leia o deck como um builder profissional.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
                    Cole a lista e abra visual stacks, preview da carta, bracket e um painel de insights —
                    pensado para mesa, não para planilha.
                  </p>
                </div>
              )}
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Decklist
                </span>
                <textarea
                  className="min-h-[160px] w-full resize-y rounded-2xl border border-[var(--deck-stroke)] bg-[#0b111a] px-4 py-3.5 font-mono text-[12px] leading-5 text-[var(--ink)] outline-none transition placeholder:text-white/25 focus:border-[var(--accent)]/60 focus:ring-4 focus:ring-teal-500/10 sm:min-h-[200px]"
                  placeholder={"// Commander\n1 Seu Comandante\n\n// Mainboard\n1 Sol Ring"}
                  value={list}
                  onChange={(event) => setList(event.target.value)}
                />
              </label>
            </div>

            <div className="deck-rise flex flex-col gap-3" style={{ animationDelay: "60ms" }}>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Comandante opcional
                </span>
                <input
                  className="h-11 w-full rounded-2xl border border-[var(--deck-stroke)] bg-[#0b111a] px-4 text-sm text-[var(--ink)] outline-none transition placeholder:text-white/25 focus:border-[var(--accent)]/60 focus:ring-4 focus:ring-teal-500/10"
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
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <WandSparkles size={16} />}
                  {loading ? "Analisando…" : "Analisar"}
                </button>
                <button
                  type="button"
                  onClick={() => setList(SAMPLE)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--deck-stroke)] bg-[var(--deck-panel)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--deck-panel-2)]"
                >
                  Exemplo
                </button>
              </div>
              {error && (
                <p className="flex items-start gap-2 text-sm text-rose-300">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {loading && !analysis && (
        <div className="mx-auto grid max-w-[1440px] place-items-center px-4 py-28">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 animate-spin text-[var(--accent)]" size={30} />
            <p className="text-base font-semibold text-[var(--ink)]">Compondo stacks e insights…</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Scryfall + heurísticas de bracket</p>
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="mx-auto grid max-w-[1440px] place-items-center px-4 py-24">
          <div className="deck-rise max-w-lg text-center">
            <div className="mx-auto mb-5 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.35rem] border border-[var(--deck-stroke)] bg-[var(--deck-panel)] shadow-[0_0_0_6px_var(--deck-glow)]">
              <Swords className="text-[var(--accent)]" size={26} />
            </div>
            <p className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Seu próximo brew começa aqui
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Cole uma lista Moxfield/Archidekt. O painel abre com stacks por tipo, preview lateral e
              barra de métricas — no mesmo espírito dos builders sérios.
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
        <div className="mx-auto max-w-[1440px] px-4 py-5 pb-6 sm:px-6 sm:py-6">
          <InsightsBoard analysis={analysis} />
        </div>
      )}

      {analysis && <StatusBar analysis={analysis} />}
      {analysis && (
        <MobileDeckDock
          view={view}
          editorOpen={editorOpen}
          onView={setView}
          onToggleEditor={() => setEditorOpen((open) => !open)}
        />
      )}
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
    <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="deck-rise hidden lg:sticky lg:top-[4.5rem] lg:block lg:self-start">
        <CardPreviewPanel card={selectedCard} analysis={analysis} />
      </aside>

      {selectedCard && (
        <MobileCardPeek card={selectedCard} analysis={analysis} />
      )}

      <div className="deck-rise min-w-0" style={{ animationDelay: "70ms" }}>
        <div className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Visual stacks
            </p>
            <p className="mt-1 truncate text-sm text-[var(--ink)]">
              {analysis.commander?.name ?? "Deck"} · <ColorIdentity colors={analysis.colorIdentity} />
            </p>
          </div>
          <p className="hidden shrink-0 text-xs text-[var(--muted)] sm:block">
            Deslize pelos tipos
          </p>
        </div>

        <div className="deck-stacks-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0 xl:grid xl:grid-cols-7 xl:overflow-visible xl:pb-0">
          {groups.map((group, index) => (
            <VisualStack
              key={group.id}
              group={group}
              selectedName={selectedCard?.name}
              onSelect={onSelect}
              delay={index * 35}
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
      <div className="rounded-3xl border border-dashed border-[var(--deck-stroke)] bg-[var(--deck-panel)]/40 p-8 text-center text-sm text-[var(--muted)]">
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
    <div className="overflow-hidden rounded-3xl border border-[var(--deck-stroke)] bg-[var(--deck-panel)] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div className="relative aspect-[5/7] w-full bg-[#05080e]">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            unoptimized
            className="object-cover"
            sizes="272px"
            priority
          />
        ) : null}
        <div className="deck-preview-sheen pointer-events-none absolute inset-0" />
      </div>

      <div className="space-y-3.5 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {card.section === "commander" ? "Commander" : "Maindeck"}
          </p>
          <h2 className="mt-1 text-[1.05rem] font-semibold leading-snug tracking-tight text-[var(--ink)]">
            {card.name}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{card.typeLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)]">
            CMC {card.cmc}
          </span>
          {card.manaCost ? (
            <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[11px] text-[var(--muted)]">
              {card.manaCost}
            </span>
          ) : null}
          <ColorIdentity colors={card.colorIdentity} />
        </div>

        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <span
                key={String(flag)}
                className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-200"
              >
                {flag}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--deck-stroke)] bg-[#0b111a] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            No deck
          </p>
          <p className="mt-1.5 text-sm font-medium text-[var(--ink)]">
            {analysis.archetypes[0]?.label ?? "Midrange"} · Bracket {analysis.bracket.bracket}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{analysis.bracket.summary}</p>
        </div>

        <Link
          href="/#catalogo"
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        >
          Buscar no catálogo
        </Link>
      </div>
    </div>
  );
}

function VisualStack({
  group,
  selectedName,
  onSelect,
  delay = 0
}: {
  group: StackGroup;
  selectedName?: string;
  onSelect: (name: string) => void;
  delay?: number;
}) {
  const featured =
    group.cards.find((card) => card.name === selectedName) ?? group.cards[0] ?? null;

  return (
    <div
      className="deck-rise deck-stack-pane w-[min(78vw,220px)] shrink-0 sm:w-[168px] xl:w-auto"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5">
        <span className="text-[var(--accent)]">{group.icon}</span>
        <h3 className="text-[12px] font-semibold tracking-wide text-[var(--ink)]">
          {group.label}
          <span className="ml-1 font-medium text-[var(--muted)]">{group.cards.length}</span>
        </h3>
      </div>

      {featured?.imageUrl && (
        <button
          type="button"
          onClick={() => onSelect(featured.name)}
          className="relative mb-2 aspect-[5/3.2] w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 outline-none transition hover:border-teal-300/40"
        >
          <Image
            src={featured.imageUrl}
            alt=""
            fill
            unoptimized
            className="object-cover object-[center_18%]"
            sizes="180px"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8">
            <p className="truncate text-[11px] font-semibold text-white">{featured.name}</p>
          </div>
        </button>
      )}

      <div className="max-h-[min(52vh,420px)] space-y-px overflow-y-auto overscroll-contain rounded-xl border border-[var(--deck-stroke)] bg-[#0b111a]/80 p-1 scrollbar-none">
        {group.cards.map((card) => {
          const selected = card.name === selectedName;
          return (
            <button
              key={`${group.id}-${card.name}`}
              type="button"
              onClick={() => onSelect(card.name)}
              className={`deck-stack-row flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left outline-none ${
                selected
                  ? "border-teal-400/35 bg-teal-400/10"
                  : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`min-w-0 flex-1 truncate text-[11px] font-medium ${
                  selected ? "text-teal-100" : "text-white/85"
                }`}
              >
                {card.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-white/40">
                {card.manaCost || (card.cmc > 0 ? String(card.cmc) : "—")}
              </span>
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
        <p className="text-[1.65rem] font-semibold tracking-tight text-[var(--ink)]">
          {analysis.bracket.label}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{analysis.bracket.summary}</p>
        <ul className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
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
            <div key={bin.label} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-[var(--muted)]">{bin.count || ""}</span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-teal-700 to-teal-400"
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
            <div
              key={archetype.id}
              className="rounded-2xl border border-[var(--deck-stroke)] bg-[#0b111a]/70 px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {index === 0 ? "Principal · " : ""}
                  {archetype.label}
                </p>
                <span className="text-xs tabular-nums text-[var(--muted)]">{archetype.score}</span>
              </div>
              {archetype.evidence.length > 0 && (
                <p className="mt-1 text-xs text-[var(--muted)]">{archetype.evidence.join(" · ")}</p>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Sinergia">
        <ul className="grid gap-2.5 text-sm leading-6 text-[var(--muted)]">
          {analysis.synergyNotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Pontos fortes">
        <div className="grid gap-3.5">
          {analysis.strengths.map((item) => (
            <div key={item.title}>
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Sparkles size={14} className="text-[var(--gold)]" />
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Sugestões">
        <div className="grid gap-2">
          {analysis.suggestions.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--deck-stroke)] bg-[#0b111a]/70 px-3.5 py-3"
            >
              <p className={`text-sm font-semibold ${severityTone(item.severity)}`}>{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
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
              <div
                key={role.role}
                className="rounded-2xl border border-[var(--deck-stroke)] bg-[#0b111a]/50 px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">{role.label}</p>
                  <span className="text-xs font-semibold tabular-nums text-[var(--accent)]">
                    {role.count}
                  </span>
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
  return (
    <div className="deck-status-bar fixed inset-x-0 bottom-[calc(3.75rem+var(--safe-bottom))] z-40 md:bottom-0">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 overflow-x-auto px-4 py-2 text-[12px] text-white scrollbar-none sm:gap-4 sm:px-6 sm:py-2.5 sm:text-[13px]">
        <p className="shrink-0 font-semibold">
          {analysis.totalCards}
          <span className="ml-1.5 font-normal text-white/70">cartas</span>
        </p>
        <span className="hidden h-4 w-px shrink-0 bg-white/20 sm:block" />
        <p className="inline-flex shrink-0 items-center gap-1.5 font-semibold">
          <Check size={14} />
          Bracket {analysis.bracket.bracket}
        </p>
        <span className="hidden h-4 w-px shrink-0 bg-white/20 sm:block" />
        <p className="shrink-0 text-white/80">
          CMC <span className="font-semibold text-white">{analysis.averageCmc}</span>
        </p>
        <span className="hidden h-4 w-px shrink-0 bg-white/20 md:block" />
        <span className="hidden shrink-0 md:inline-flex">
          <ColorIdentity colors={analysis.colorIdentity} light />
        </span>
        <div className="ml-auto hidden shrink-0 items-center gap-3 text-[12px] text-white/85 lg:flex">
          <span>{analysis.landCount} lands</span>
          <span>{analysis.archetypes[0]?.label ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

function MobileDeckDock({
  view,
  editorOpen,
  onView,
  onToggleEditor
}: {
  view: ViewMode;
  editorOpen: boolean;
  onView: (view: ViewMode) => void;
  onToggleEditor: () => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3 md:hidden"
      style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}
      aria-label="Navegacao do analisador"
    >
      <div className="deck-mobile-dock mx-auto grid h-[3.55rem] max-w-md grid-cols-4 items-center rounded-2xl border border-white/[0.08] bg-[var(--deck-panel)]/95 px-1 backdrop-blur-2xl">
        <DockItem
          active={view === "visual" && !editorOpen}
          label="Visual"
          onClick={() => {
            onView("visual");
            if (editorOpen) onToggleEditor();
          }}
        >
          <Layers size={18} strokeWidth={view === "visual" && !editorOpen ? 2.25 : 1.75} />
        </DockItem>
        <DockItem
          active={view === "insights" && !editorOpen}
          label="Insights"
          onClick={() => {
            onView("insights");
            if (editorOpen) onToggleEditor();
          }}
        >
          <Sparkles size={18} strokeWidth={view === "insights" && !editorOpen ? 2.25 : 1.75} />
        </DockItem>
        <DockItem active={editorOpen} label="Lista" onClick={onToggleEditor}>
          <ScrollText size={18} strokeWidth={editorOpen ? 2.25 : 1.75} />
        </DockItem>
        <Link
          href="/"
          className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold text-[var(--muted)] transition active:scale-95"
        >
          <Home size={18} strokeWidth={1.75} />
          <span>Loja</span>
        </Link>
      </div>
    </nav>
  );
}

function DockItem({
  active,
  label,
  onClick,
  children
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)]"
      }`}
    >
      {children}
      <span>{label}</span>
      {active && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-[var(--accent)]" />}
    </button>
  );
}

function MobileCardPeek({
  card,
  analysis
}: {
  card: AnalyzedCard;
  analysis: DeckAnalysis;
}) {
  return (
    <div className="deck-rise sticky top-14 z-30 -mx-4 border-y border-[var(--deck-stroke)] bg-[#070a10]/92 px-4 py-2.5 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
          {card.imageUrl ? (
            <Image src={card.imageUrl} alt="" fill unoptimized className="object-cover" sizes="40px" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{card.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
            CMC {card.cmc}
            {card.manaCost ? ` · ${card.manaCost}` : ""} · Bracket {analysis.bracket.bracket}
          </p>
        </div>
        <ColorIdentity colors={card.colorIdentity} />
      </div>
    </div>
  );
}

function ColorIdentity({
  colors,
  light = false
}: {
  colors: string[];
  light?: boolean;
}) {
  if (!colors.length) {
    return <span className={light ? "text-white/70" : "text-[var(--muted)]"}>—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {colors.map((color) => (
        <span
          key={color}
          title={color}
          className="inline-block h-3.5 w-3.5 rounded-full border border-black/40 shadow-sm"
          style={{ background: COLOR_PIP[color] ?? "#64748b" }}
        />
      ))}
    </span>
  );
}

function buildStackGroups(analysis: DeckAnalysis): StackGroup[] {
  const commanders = [
    ...(analysis.commander ? [analysis.commander] : []),
    ...analysis.partners
  ];
  const main = analysis.cards.filter((card) => card.section === "main");

  const buckets: StackGroup[] = [
    { id: "commander", label: "Commander", icon: <Swords size={13} />, cards: commanders },
    {
      id: "planeswalkers",
      label: "Planeswalkers",
      icon: <Sparkles size={13} />,
      cards: main.filter((card) => /planeswalker/i.test(card.typeLine))
    },
    {
      id: "creatures",
      label: "Creatures",
      icon: <Swords size={13} />,
      cards: main.filter(
        (card) => /creature/i.test(card.typeLine) && !/planeswalker/i.test(card.typeLine)
      )
    },
    {
      id: "instants",
      label: "Instants",
      icon: <Zap size={13} />,
      cards: main.filter((card) => /instant/i.test(card.typeLine))
    },
    {
      id: "sorceries",
      label: "Sorceries",
      icon: <Flame size={13} />,
      cards: main.filter((card) => /sorcery/i.test(card.typeLine))
    },
    {
      id: "artifacts",
      label: "Artifacts",
      icon: <Layers size={13} />,
      cards: main.filter(
        (card) => /artifact/i.test(card.typeLine) && !/creature/i.test(card.typeLine)
      )
    },
    {
      id: "enchantments",
      label: "Enchantments",
      icon: <Sparkles size={13} />,
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
      icon: <Landmark size={13} />,
      cards: main.filter((card) => /land/i.test(card.typeLine))
    }
  ];

  const used = new Set(buckets.flatMap((group) => group.cards.map((card) => card.name)));
  const other = main.filter((card) => !used.has(card.name));
  if (other.length) {
    buckets.push({
      id: "other",
      label: "Other",
      icon: <ScrollText size={13} />,
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
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold tracking-wide transition ${
        active
          ? "bg-[var(--accent)] text-white shadow-[0_0_0_1px_rgba(20,184,166,0.35)]"
          : "text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[var(--deck-stroke)] bg-[var(--deck-panel)] p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function severityTone(severity: "info" | "warn" | "critical") {
  if (severity === "critical") return "text-rose-300";
  if (severity === "warn") return "text-amber-300";
  return "text-[var(--ink)]";
}
