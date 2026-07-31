"use client";

import { Check, Loader2, Package, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUsd } from "@/lib/format";
import {
  isValidSealedType,
  sealedTypeLabel,
  sealedTypesForGame,
  type SealedType
} from "@/lib/sealed";
import type { SealedSuggestion } from "@/lib/sealed-lookup";
import type { Game, TcgCard } from "@/lib/types";

const games: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];
const languages: TcgCard["language"][] = ["PT", "EN", "JP"];

const inputClass =
  "field-input h-11 w-full min-w-0 rounded-[var(--radius-control)] px-3 text-sm placeholder:text-[var(--muted)]";
const labelClass = "grid gap-1 text-sm font-medium text-[var(--muted)]";

export function SealedAutocomplete() {
  const [game, setGame] = useState<Game>("Magic");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [sealedType, setSealedType] = useState<SealedType>("booster_box");
  const [language, setLanguage] = useState<TcgCard["language"]>("EN");
  const [price, setPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("Selado");
  const [suggestions, setSuggestions] = useState<SealedSuggestion[]>([]);
  const [selected, setSelected] = useState<SealedSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<SealedSuggestion | null>(null);
  const searchGenRef = useRef(0);

  const typeOptions = useMemo(() => sealedTypesForGame(game), [game]);
  const canSearch = query.trim().length >= 2;

  const helperText = useMemo(() => {
    if (!canSearch) return "Digite pelo menos 2 letras para buscar o produto.";
    if (isLoading) return "Buscando produtos selados no TCGPlayer...";
    if (lookupError) return lookupError;
    if (selected) return "Produto selecionado — revise preço e estoque antes de cadastrar.";
    if (suggestions.length > 0) {
      return `${suggestions.length} produto${suggestions.length === 1 ? "" : "s"} encontrado${suggestions.length === 1 ? "" : "s"}. Toque para preencher.`;
    }
    return "Nenhum produto selado encontrado para esta busca.";
  }, [canSearch, isLoading, lookupError, selected, suggestions.length]);

  useEffect(() => {
    if (!typeOptions.some((item) => item.value === sealedType)) {
      setSealedType(typeOptions[0]?.value ?? "other");
    }
  }, [game, sealedType, typeOptions]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setLookupError(null);
      setIsOpen(false);
      return;
    }

    // Já selecionou este produto — não buscar de novo nem reabrir a lista.
    if (selectedRef.current && selectedRef.current.name === trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const gen = ++searchGenRef.current;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setLookupError(null);
      try {
        const response = await fetch(
          `/api/sealed-lookup?game=${encodeURIComponent(game)}&query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (gen !== searchGenRef.current || selectedRef.current) return;

        if (response.status === 401) {
          setSuggestions([]);
          setLookupError("Faça login como admin para buscar produtos.");
          setIsOpen(false);
          return;
        }
        if (!response.ok) {
          setSuggestions([]);
          setLookupError("Falha ao buscar produtos. Tente de novo.");
          setIsOpen(false);
          return;
        }
        const data = (await response.json()) as { suggestions?: SealedSuggestion[] };
        if (gen !== searchGenRef.current || selectedRef.current) return;

        const next = data.suggestions ?? [];
        setSuggestions(next);
        setIsOpen(next.length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError" && gen === searchGenRef.current && !selectedRef.current) {
          setSuggestions([]);
          setLookupError("Falha de rede ao buscar produtos.");
          setIsOpen(false);
        }
      } finally {
        if (gen === searchGenRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [game, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function applySuggestion(suggestion: SealedSuggestion) {
    selectedRef.current = suggestion;
    searchGenRef.current += 1;
    setSelected(suggestion);
    setQuery(suggestion.name);
    setName(suggestion.name);
    setCollectionName(suggestion.setName);
    setSealedType(
      isValidSealedType(game, suggestion.sealedType)
        ? suggestion.sealedType
        : typeOptions[0]?.value ?? "other"
    );
    setLanguage(suggestion.language);
    setImageUrl(suggestion.imageUrl);
    setTags(suggestion.tags.join(", "));
    setMarketPrice(
      suggestion.marketPriceCents > 0
        ? (suggestion.marketPriceCents / 100).toFixed(2)
        : ""
    );
    if (!price) {
      setPrice(
        suggestion.marketPriceCents > 0
          ? (suggestion.marketPriceCents / 100).toFixed(2)
          : ""
      );
    }
    setSuggestions([]);
    setIsOpen(false);
    setIsLoading(false);
    setLookupError(null);
    searchInputRef.current?.blur();
  }

  return (
    <div ref={rootRef} className="grid gap-3">
      <div className="grid gap-1">
        <span className="text-sm font-medium text-[var(--muted)]">Jogo</span>
        <div className="grid grid-cols-3 gap-2">
          {games.map((item) => (
            <button
              key={item}
              type="button"
              className={`h-10 rounded-[var(--radius-control)] border px-2 text-xs font-bold transition sm:text-sm ${
                game === item
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              onClick={() => {
                selectedRef.current = null;
                setGame(item);
                setSelected(null);
                setSuggestions([]);
                setIsOpen(false);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <input type="hidden" name="game" value={game} />
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium text-[var(--muted)]" htmlFor="sealed-search">
          Buscar produto selado
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            size={16}
          />
          <input
            id="sealed-search"
            ref={searchInputRef}
            className={`${inputClass} pl-9 pr-10`}
            placeholder="Ex.: Obsidian Flames Elite Trainer Box"
            value={query}
            onChange={(event) => {
              selectedRef.current = null;
              setSelected(null);
              setQuery(event.target.value);
            }}
            onFocus={() => {
              if (suggestions.length > 0 && !selectedRef.current) setIsOpen(true);
            }}
            autoComplete="off"
            enterKeyHint="search"
          />
          {isLoading ? (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]"
              size={16}
            />
          ) : null}
        </div>

        <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted)]">
          {selected ? (
            <Check className="mt-0.5 shrink-0 text-emerald-600" size={14} />
          ) : (
            <Package className="mt-0.5 shrink-0" size={14} />
          )}
          <span className={lookupError ? "font-semibold text-rose-700" : selected ? "font-semibold text-emerald-800" : ""}>
            {helperText}
          </span>
        </div>

        {!selected && isOpen && suggestions.length > 0 ? (
          <ul
            className="max-h-[min(24rem,55vh)] overflow-auto rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg"
            role="listbox"
            aria-label="Sugestões de produtos selados"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.externalId} role="option">
                <button
                  type="button"
                  className="grid w-full grid-cols-[56px_1fr] gap-2 rounded-md px-2 py-2.5 text-left transition hover:bg-[var(--surface-hover)] active:scale-[0.99]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applySuggestion(suggestion)}
                >
                  <span className="relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)]">
                    <Image
                      src={suggestion.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-contain p-0.5"
                      sizes="56px"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]">
                      {suggestion.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                      {suggestion.setName} · {sealedTypeLabel(game, suggestion.sealedType)}
                      {suggestion.marketPriceCents > 0
                        ? ` · ${formatUsd(suggestion.marketPriceCents)}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <label className={labelClass}>
        Nome do produto
        <input
          className={inputClass}
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Coleção / set
          <input
            className={inputClass}
            name="setName"
            required
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Tipo selado
          <select
            className={inputClass}
            name="sealedType"
            value={sealedType}
            onChange={(e) => setSealedType(e.target.value as SealedType)}
          >
            {typeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Idioma
          <select
            className={inputClass}
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as TcgCard["language"])}
          >
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Preço (R$)
          <input
            className={inputClass}
            name="price"
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label className={labelClass}>
          Mercado ref. (USD)
          <input
            className={inputClass}
            name="marketPrice"
            inputMode="decimal"
            value={marketPrice}
            onChange={(e) => setMarketPrice(e.target.value)}
            placeholder="0.00"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Estoque
          <input
            className={inputClass}
            name="stock"
            type="number"
            min={0}
            required
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Tags
          <input
            className={inputClass}
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Selado, Booster Box"
          />
        </label>
      </div>

      <input type="hidden" name="imageUrl" value={imageUrl} />

      {imageUrl ? (
        <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)]">
          <Image
            src={imageUrl}
            alt={name || "Produto selado"}
            fill
            unoptimized
            className="object-contain p-2"
            sizes="160px"
          />
        </div>
      ) : null}

      {selected ? (
        <>
          <input type="hidden" name="externalId" value={selected.externalId} />
          <input type="hidden" name="source" value={selected.source} />
        </>
      ) : (
        <>
          <input type="hidden" name="externalId" value={`manual:${name || "sealed"}`} />
          <input type="hidden" name="source" value="manual" />
        </>
      )}

      {selected && selected.marketPriceCents > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          Referência TCGPlayer: {formatUsd(selected.marketPriceCents)} (mercado em USD).
        </p>
      ) : null}
    </div>
  );
}
