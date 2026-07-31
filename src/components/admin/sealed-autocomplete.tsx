"use client";

import { Check, Loader2, Package, Search, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const searchId = useId();
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
  const [lookupError, setLookupError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const typeOptions = useMemo(() => sealedTypesForGame(game), [game]);
  const canSearch = query.trim().length >= 2;
  const showSuggestions = !selected && suggestions.length > 0;

  const helperText = useMemo(() => {
    if (selected) return "Produto selecionado — revise preço e estoque antes de cadastrar.";
    if (!canSearch) return "Digite pelo menos 2 letras para buscar o produto.";
    if (isLoading) return "Buscando produtos selados no TCGPlayer...";
    if (lookupError) return lookupError;
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
    if (selectedIdRef.current) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setIsLoading(false);
      setLookupError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setLookupError(null);
      try {
        const response = await fetch(
          `/api/sealed-lookup?game=${encodeURIComponent(game)}&query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        if (requestId !== requestIdRef.current || selectedIdRef.current) return;

        if (response.status === 401) {
          setSuggestions([]);
          setLookupError("Faça login como admin para buscar produtos.");
          return;
        }
        if (!response.ok) {
          setSuggestions([]);
          setLookupError("Falha ao buscar produtos. Tente de novo.");
          return;
        }

        const data = (await response.json()) as { suggestions?: SealedSuggestion[] };
        if (requestId !== requestIdRef.current || selectedIdRef.current) return;
        setSuggestions(data.suggestions ?? []);
      } catch (error) {
        if (
          (error as Error).name !== "AbortError" &&
          requestId === requestIdRef.current &&
          !selectedIdRef.current
        ) {
          setSuggestions([]);
          setLookupError("Falha de rede ao buscar produtos.");
        }
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [game, query]);

  function clearSelection() {
    selectedIdRef.current = null;
    setSelected(null);
    setSuggestions([]);
    setLookupError(null);
  }

  function resetSearch() {
    clearSelection();
    setQuery("");
    setName("");
    setCollectionName("");
    setImageUrl("");
    setTags("Selado");
    setMarketPrice("");
    setPrice("");
    searchInputRef.current?.focus();
  }

  function applySuggestion(suggestion: SealedSuggestion) {
    // Trava imediata contra respostas atrasadas / toques duplicados.
    selectedIdRef.current = suggestion.externalId;
    requestIdRef.current += 1;

    setSelected(suggestion);
    setSuggestions([]);
    setIsLoading(false);
    setLookupError(null);
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
    setPrice((current) =>
      current
        ? current
        : suggestion.marketPriceCents > 0
          ? (suggestion.marketPriceCents / 100).toFixed(2)
          : ""
    );

    // Fecha teclado no mobile sem depender de blur→click.
    window.setTimeout(() => searchInputRef.current?.blur(), 0);
  }

  return (
    <div className="grid gap-3">
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
                clearSelection();
                setGame(item);
                setQuery("");
                setName("");
                setCollectionName("");
                setImageUrl("");
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <input type="hidden" name="game" value={game} />
      </div>

      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-[var(--muted)]" htmlFor={searchId}>
            Buscar produto selado
          </label>
          {(query || selected) && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              onClick={resetSearch}
            >
              <X size={14} />
              Limpar
            </button>
          )}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            size={16}
          />
          <input
            id={searchId}
            ref={searchInputRef}
            className={`${inputClass} pl-9 pr-10`}
            placeholder="Ex.: Obsidian Flames Elite Trainer Box"
            value={query}
            readOnly={Boolean(selected)}
            onChange={(event) => {
              if (selectedIdRef.current) clearSelection();
              setQuery(event.target.value);
            }}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
          {isLoading ? (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]"
              size={16}
            />
          ) : null}
        </div>

        <div
          className={`flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-xs ${
            selected
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : lookupError
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)]"
          }`}
        >
          {selected ? (
            <Check className="mt-0.5 shrink-0" size={14} />
          ) : (
            <Package className="mt-0.5 shrink-0" size={14} />
          )}
          <span className="font-medium">{helperText}</span>
        </div>

        {showSuggestions ? (
          <ul
            className="max-h-[min(22rem,50vh)] touch-pan-y overflow-auto overscroll-contain rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg"
            role="listbox"
            aria-label="Sugestões de produtos selados"
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.externalId} role="option">
                <button
                  type="button"
                  className="grid w-full grid-cols-[56px_1fr] gap-2 rounded-md px-2 py-3 text-left transition [-webkit-tap-highlight-color:transparent] hover:bg-[var(--surface-hover)] active:bg-[var(--accent)]/10"
                  onPointerDown={(event) => {
                    // Seleciona no toque/clique inicial — não depende de click (falha em alguns mobiles).
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    applySuggestion(suggestion);
                  }}
                >
                  <span className="pointer-events-none relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)]">
                    <Image
                      src={suggestion.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-contain p-0.5"
                      sizes="56px"
                    />
                  </span>
                  <span className="pointer-events-none min-w-0">
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
