"use client";

import { Loader2, Search, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CardCondition, CardSuggestion, Game, TcgCard } from "@/lib/types";

const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const conditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const languages: TcgCard["language"][] = ["PT", "EN", "JP"];
const finishes: TcgCard["finish"][] = ["Normal", "Foil", "Holo", "Secret"];

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]";

export function CardAutocomplete() {
  const [game, setGame] = useState<Game>("Magic");
  const [name, setName] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [rarity, setRarity] = useState("");
  const [language, setLanguage] = useState<TcgCard["language"]>("PT");
  const [finish, setFinish] = useState<TcgCard["finish"]>("Normal");
  const [price, setPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const canSearch = name.trim().length >= 2;
  const helperText = useMemo(() => {
    if (!canSearch) return "Digite pelo menos 2 letras para buscar.";
    if (isLoading) return "Buscando nas bases externas...";
    if (suggestions.length > 0) return `${suggestions.length} sugestoes encontradas.`;
    return "Sem sugestoes para esta busca.";
  }, [canSearch, isLoading, suggestions.length]);

  useEffect(() => {
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
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canSearch, game, name]);

  function applySuggestion(suggestion: CardSuggestion) {
    const nextPrice = suggestion.marketPriceCents > 0
      ? (suggestion.marketPriceCents / 100).toFixed(2)
      : "";

    setGame(suggestion.game);
    setName(suggestion.name);
    setCollectionName(suggestion.setName);
    setRarity(suggestion.rarity);
    setLanguage(suggestion.language);
    setFinish(suggestion.finish);
    setMarketPrice(nextPrice);
    setPrice(nextPrice);
    setImageUrl(suggestion.imageUrl);
    setTags(suggestion.tags.join(", "));
    setIsOpen(false);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <input
            className="h-11 w-full rounded-lg border border-[var(--line)] bg-white pl-10 pr-10 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            name="name"
            placeholder="Buscar carta por nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={() => setIsOpen(suggestions.length > 0)}
            autoComplete="off"
            required
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]" size={18} />
          )}

          {isOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-30 max-h-80 overflow-auto rounded-lg border border-[var(--line)] bg-white p-2 shadow-2xl">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.source}-${suggestion.externalId}`}
                  className="grid w-full grid-cols-[44px_1fr] gap-3 rounded-lg p-2 text-left transition hover:bg-[#f2efe7]"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(suggestion)}
                >
                  <span
                    className="block aspect-[3/4] rounded-md border border-[var(--line)] bg-[#faf9f6] bg-cover bg-center"
                    style={{ backgroundImage: `url(${suggestion.imageUrl})` }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                      {suggestion.name}
                    </span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {suggestion.setName} · {suggestion.rarity}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <span className="inline-flex rounded-md bg-[#f2efe7] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                        {suggestion.printLabel}
                      </span>
                      <span className="inline-flex rounded-md bg-[#e8f5f2] px-2 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">
                        {suggestion.marketPriceCents > 0
                          ? `Mercado ${(suggestion.marketPriceCents / 100).toFixed(2)}`
                          : "Sem preco"}
                      </span>
                      <span className="inline-flex rounded-md bg-[#f2efe7] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                        {suggestion.source}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <select className={inputClass} name="game" value={game} onChange={(event) => setGame(event.target.value as Game)}>
          {games.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-[#faf9f6] px-3 py-2 text-xs font-medium text-[var(--muted)]">
        <WandSparkles className="shrink-0 text-[var(--accent)]" size={15} />
        {helperText}
      </div>

      <select className={inputClass} name="condition" defaultValue="NM">
        {conditions.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>

      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputClass} name="setName" placeholder="Colecao" value={collectionName} onChange={(event) => setCollectionName(event.target.value)} required />
        <input className={inputClass} name="rarity" placeholder="Raridade" value={rarity} onChange={(event) => setRarity(event.target.value)} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select className={inputClass} name="language" value={language} onChange={(event) => setLanguage(event.target.value as TcgCard["language"])}>
          {languages.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={inputClass} name="finish" value={finish} onChange={(event) => setFinish(event.target.value as TcgCard["finish"])}>
          {finishes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input className={inputClass} name="price" type="number" min="0" step="0.01" placeholder="Preco" value={price} onChange={(event) => setPrice(event.target.value)} required />
        <input className={inputClass} name="marketPrice" type="number" min="0" step="0.01" placeholder="Mercado" value={marketPrice} onChange={(event) => setMarketPrice(event.target.value)} required />
        <input className={inputClass} name="stock" type="number" min="0" step="1" placeholder="Estoque" value={stock} onChange={(event) => setStock(event.target.value)} required />
      </div>

      <input className={inputClass} name="imageUrl" type="url" placeholder="URL da imagem" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} required />
      <input className={inputClass} name="tags" placeholder="Tags separadas por virgula" value={tags} onChange={(event) => setTags(event.target.value)} />
    </div>
  );
}
