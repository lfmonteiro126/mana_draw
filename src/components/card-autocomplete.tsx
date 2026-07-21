"use client";

import {
  Check,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  WandSparkles,
  Zap
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CardCondition, CardSuggestion, Game, TcgCard } from "@/lib/types";

const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const languages: TcgCard["language"][] = ["PT", "EN", "JP"];
const finishes: TcgCard["finish"][] = ["Normal", "Foil", "Holo", "Secret"];
const presetKey = "mana-draw-card-catalog-presets";

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]";
const labelClass = "grid gap-1 text-sm font-medium text-[var(--muted)]";

type PriceMode = "market" | "under" | "over" | "manual";

type CatalogPresets = {
  condition: CardCondition;
  language: TcgCard["language"];
  finish: TcgCard["finish"];
  stock: string;
  priceMode: PriceMode;
};

const defaultPresets: CatalogPresets = {
  condition: "NM",
  language: "PT",
  finish: "Normal",
  stock: "1",
  priceMode: "market"
};

export function CardAutocomplete() {
  const [game, setGame] = useState<Game>("Magic");
  const [name, setName] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [rarity, setRarity] = useState("");
  const [condition, setCondition] = useState<CardCondition>(defaultPresets.condition);
  const [language, setLanguage] = useState<TcgCard["language"]>(defaultPresets.language);
  const [finish, setFinish] = useState<TcgCard["finish"]>(defaultPresets.finish);
  const [price, setPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [stock, setStock] = useState(defaultPresets.stock);
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>(defaultPresets.priceMode);
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<CardSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const canSearch = name.trim().length >= 2;
  const helperText = useMemo(() => {
    if (!canSearch) return "Digite pelo menos 2 letras para buscar prints.";
    if (isLoading) return "Buscando nas bases externas...";
    if (suggestions.length > 0) return `${suggestions.length} prints encontrados. Clique no correto para preencher.`;
    return "Sem prints para esta busca.";
  }, [canSearch, isLoading, suggestions.length]);

  useEffect(() => {
    const stored = window.localStorage.getItem(presetKey);
    if (!stored) return;

    try {
      const presets = JSON.parse(stored) as Partial<CatalogPresets>;
      if (conditions.includes(presets.condition as CardCondition)) setCondition(presets.condition as CardCondition);
      if (languages.includes(presets.language as TcgCard["language"])) setLanguage(presets.language as TcgCard["language"]);
      if (finishes.includes(presets.finish as TcgCard["finish"])) setFinish(presets.finish as TcgCard["finish"]);
      if (presets.stock && Number.isInteger(Number(presets.stock))) setStock(presets.stock);
      if (["market", "under", "over", "manual"].includes(String(presets.priceMode))) setPriceMode(presets.priceMode as PriceMode);
    } catch {
      window.localStorage.removeItem(presetKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      presetKey,
      JSON.stringify({ condition, language, finish, stock, priceMode })
    );
  }, [condition, finish, language, priceMode, stock]);

  useEffect(() => {
    const selectedPrintIsCurrent =
      selectedSuggestion &&
      selectedSuggestion.game === game &&
      selectedSuggestion.name === name &&
      selectedSuggestion.setName === collectionName;

    if (selectedPrintIsCurrent) {
      setIsOpen(false);
      return;
    }

    if (!canSearch) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams({ game, query: name });
        const response = await fetch(`/api/card-lookup?${params}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as { suggestions?: CardSuggestion[] };
        setSuggestions(payload.suggestions ?? []);
        setIsOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSearch, collectionName, game, name, selectedSuggestion]);

  function applySuggestion(suggestion: CardSuggestion) {
    const nextMarketPrice = suggestion.marketPriceCents > 0
      ? (suggestion.marketPriceCents / 100).toFixed(2)
      : "";

    setSelectedSuggestion(suggestion);
    setGame(suggestion.game);
    setName(suggestion.name);
    setCollectionName(suggestion.setName);
    setRarity(suggestion.rarity);
    setLanguage(suggestion.language);
    setFinish(suggestion.finish);
    setMarketPrice(nextMarketPrice);
    setPrice(applyPriceMode(nextMarketPrice, priceMode));
    setImageUrl(suggestion.imageUrl);
    setTags(suggestion.tags.join(", "));
    setSuggestions([]);
    setIsOpen(false);
  }

  function updatePriceMode(nextMode: PriceMode) {
    setPriceMode(nextMode);
    if (nextMode !== "manual") setPrice(applyPriceMode(marketPrice, nextMode));
  }

  function changeStock(delta: number) {
    setStock((current) => String(Math.max(0, Number(current || 0) + delta)));
  }

  function resetForNextCard() {
    setName("");
    setCollectionName("");
    setRarity("");
    setPrice("");
    setMarketPrice("");
    setImageUrl("");
    setTags("");
    setSuggestions([]);
    setSelectedSuggestion(null);
    setIsOpen(false);
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Zap size={17} className="text-[var(--accent)]" />
            Catalogador rapido
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)]"
            type="button"
            onClick={resetForNextCard}
          >
            <RotateCcw size={14} />
            Limpar busca
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {games.map((item) => (
            <button
              key={item}
              className={`h-10 rounded-lg border px-2 text-xs font-bold transition sm:text-sm ${
                game === item
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              type="button"
              onClick={() => {
                setGame(item);
                setSuggestions([]);
                setSelectedSuggestion(null);
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <input
            className="h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-10 pr-10 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            name="name"
            placeholder="Escaneie/digite o nome da carta"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSelectedSuggestion(null);
            }}
            onFocus={() => setIsOpen(!selectedSuggestion && suggestions.length > 0)}
            autoComplete="off"
            required
          />
          {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]" size={18} />}

          {isOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-14 z-30 max-h-[460px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xl">
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.source}-${suggestion.externalId}`}
                    className="grid w-full grid-cols-[54px_1fr] gap-3 rounded-lg p-2 text-left transition hover:bg-[var(--surface-hover)]"
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <span
                      className="block aspect-[3/4] rounded-md border border-[var(--line)] bg-[var(--surface-soft)] bg-cover bg-center"
                      style={{ backgroundImage: `url(${suggestion.imageUrl})` }}
                    />
                    <span className="min-w-0">
                      <span className="flex items-start justify-between gap-2">
                        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{suggestion.name}</span>
                        {selectedSuggestion?.externalId === suggestion.externalId ? <Check size={15} className="shrink-0 text-[var(--accent)]" /> : null}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted)]">{suggestion.setName} · {suggestion.rarity}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <span className="inline-flex rounded-md bg-[var(--surface-hover)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">{suggestion.printLabel}</span>
                        <span className="inline-flex rounded-md bg-[var(--accent)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--accent)]">
                          {suggestion.marketPriceCents > 0 ? `R$ ${(suggestion.marketPriceCents / 100).toFixed(2)}` : "Sem preco"}
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--muted)]">
          <WandSparkles className="shrink-0 text-[var(--accent)]" size={15} />
          {helperText}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[150px_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3">
          {imageUrl ? (
            <div className="relative aspect-[5/7] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
              <Image
                src={imageUrl}
                alt={name || "Carta selecionada"}
                fill
                unoptimized
                sizes="150px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="grid aspect-[5/7] place-items-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-4 text-center text-xs text-[var(--muted)]">
              Selecione um print para ver a imagem.
            </div>
          )}
          <p className="mt-3 truncate text-sm font-semibold text-[var(--ink)]">{name || "Nenhuma carta"}</p>
          <p className="truncate text-xs text-[var(--muted)]">{collectionName || "Colecao ainda nao definida"}</p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <QuickSelect label="Condicao" value={condition} values={conditions} onChange={(value) => setCondition(value as CardCondition)} />
            <QuickSelect label="Idioma" value={language} values={languages} onChange={(value) => setLanguage(value as TcgCard["language"])} />
            <QuickSelect label="Acabamento" value={finish} values={finishes} onChange={(value) => setFinish(value as TcgCard["finish"])} />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
            <label className={labelClass}>
              Preco de venda
              <input className={inputClass} name="price" type="number" min="0" step="0.01" placeholder="Preco" value={price} onChange={(event) => {
                setPrice(event.target.value);
                setPriceMode("manual");
              }} required />
            </label>
            <label className={labelClass}>
              Preco mercado
              <input className={inputClass} name="marketPrice" type="number" min="0" step="0.01" placeholder="Mercado" value={marketPrice} onChange={(event) => {
                setMarketPrice(event.target.value);
                if (priceMode !== "manual") setPrice(applyPriceMode(event.target.value, priceMode));
              }} required />
            </label>
            <label className={labelClass}>
              Estoque
              <span className="grid grid-cols-[42px_1fr_42px] gap-2">
                <button className="grid h-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] transition hover:border-[var(--accent)]" type="button" onClick={() => changeStock(-1)}>
                  <Minus size={16} />
                </button>
                <input className={inputClass} name="stock" type="number" min="0" step="1" placeholder="Estoque" value={stock} onChange={(event) => setStock(event.target.value)} required />
                <button className="grid h-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] transition hover:border-[var(--accent)]" type="button" onClick={() => changeStock(1)}>
                  <Plus size={16} />
                </button>
              </span>
            </label>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-semibold text-[var(--muted)]">Precificacao rapida</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["market", "Mercado"],
                ["under", "-10%"],
                ["over", "+10%"],
                ["manual", "Manual"]
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  className={`h-10 rounded-lg border px-2 text-xs font-bold transition ${
                    priceMode === mode
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                  type="button"
                  onClick={() => updatePriceMode(mode as PriceMode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <details className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3" open={!selectedSuggestion}>
            <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">Dados do print</summary>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} name="setName" placeholder="Colecao" value={collectionName} onChange={(event) => setCollectionName(event.target.value)} required />
                <input className={inputClass} name="rarity" placeholder="Raridade" value={rarity} onChange={(event) => setRarity(event.target.value)} required />
              </div>
              <input className={inputClass} name="imageUrl" type="url" placeholder="URL da imagem" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} required />
              <input className={inputClass} name="tags" placeholder="Tags separadas por virgula" value={tags} onChange={(event) => setTags(event.target.value)} />
            </div>
          </details>
        </div>
      </div>

      <input type="hidden" name="condition" value={condition} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="finish" value={finish} />
    </div>
  );
}

function QuickSelect({
  label,
  onChange,
  value,
  values
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  values: string[];
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {values.map((item) => (
          <button
            key={item}
            className={`h-10 rounded-lg border px-2 text-xs font-bold transition ${
              value === item
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            type="button"
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function applyPriceMode(marketValue: string, mode: PriceMode) {
  const market = Number(marketValue);
  if (!Number.isFinite(market) || market <= 0) return marketValue;
  if (mode === "under") return (market * 0.9).toFixed(2);
  if (mode === "over") return (market * 1.1).toFixed(2);
  return market.toFixed(2);
}
