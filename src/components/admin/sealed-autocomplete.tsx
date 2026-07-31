"use client";

import { Check, Loader2, Package, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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

  const typeOptions = useMemo(() => sealedTypesForGame(game), [game]);

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
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/sealed-lookup?game=${encodeURIComponent(game)}&query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as { suggestions?: SealedSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setIsOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [game, query]);

  function applySuggestion(suggestion: SealedSuggestion) {
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
    setIsOpen(false);
  }

  return (
    <div className="grid gap-3">
      <label className={labelClass}>
        Jogo
        <select
          className={inputClass}
          name="game"
          value={game}
          onChange={(event) => {
            setGame(event.target.value as Game);
            setSelected(null);
            setSuggestions([]);
          }}
        >
          {games.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className={`${labelClass} relative`}>
        Buscar produto selado
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
          <input
            className={`${inputClass} pl-9 pr-10`}
            placeholder="Ex.: Obsidian Flames Elite Trainer Box"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            autoComplete="off"
          />
          {isLoading ? (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted)]"
              size={16}
            />
          ) : null}
        </div>
        {isOpen && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg">
            {suggestions.map((suggestion) => (
              <li key={suggestion.externalId}>
                <button
                  type="button"
                  className="grid w-full grid-cols-[52px_1fr] gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
                  onClick={() => applySuggestion(suggestion)}
                >
                  <span className="relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)]">
                    <Image
                      src={suggestion.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-contain p-0.5"
                      sizes="52px"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                      {suggestion.name}
                    </span>
                    <span className="block truncate text-xs text-[var(--muted)]">
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
      </label>

      {selected ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <Check size={14} />
          Imagem e dados preenchidos via TCGPlayer
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted)]">
          <Package size={14} />
          Digite o nome do produto — a imagem é buscada automaticamente.
        </div>
      )}

      <label className={labelClass}>
        Nome do produto
        <input className={inputClass} name="name" required value={name} onChange={(e) => setName(e.target.value)} />
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

      <label className={labelClass}>
        URL da imagem
        <input
          className={inputClass}
          name="imageUrl"
          required
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </label>

      {imageUrl ? (
        <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface-soft)]">
          <Image src={imageUrl} alt={name || "Produto selado"} fill unoptimized className="object-contain p-2" sizes="160px" />
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
