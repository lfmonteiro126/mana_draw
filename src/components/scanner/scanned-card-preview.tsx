"use client";

import {
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Store,
  Wallet
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { formatCurrency, formatUsd } from "@/lib/format";
import type { ScannedCardResult } from "@/lib/scanner/scryfall";

type ScannedCardPreviewProps = {
  card: ScannedCardResult;
  onScanNext: () => void;
  onSelectForStore?: (card: ScannedCardResult) => void;
  onSelectForBuylist?: (card: ScannedCardResult) => void;
  onClose?: () => void;
  mode?: "store" | "buylist" | "general";
};

export function ScannedCardPreview({
  card,
  onScanNext,
  onSelectForStore,
  onSelectForBuylist
}: ScannedCardPreviewProps) {
  const [showBack, setShowBack] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeImageUrl = showBack && card.backImageUrl ? card.backImageUrl : card.imageUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignora erro de clipboard se bloqueado
    }
  };

  const rarityColor = {
    Mythic: "text-amber-400 border-amber-500/40 bg-amber-950/40",
    Rare: "text-yellow-400 border-yellow-500/40 bg-yellow-950/40",
    Uncommon: "text-slate-300 border-slate-400/40 bg-slate-800/60",
    Common: "text-zinc-400 border-zinc-600/40 bg-zinc-900/60"
  }[card.rarity] || "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-emerald-500/30 bg-zinc-950/95 p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 sm:p-6">
      {/* Glow de fundo */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Header do Reconhecimento */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Carta Reconhecida
          </span>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          MTG • {card.setCode} #{card.collectorNumber}
        </span>
      </div>

      {/* Corpo com Imagem da Carta e Metadados */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Imagem Scryfall */}
        <div className="relative mx-auto aspect-[5/7] w-48 shrink-0 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-lg">
          {activeImageUrl ? (
            <Image
              src={activeImageUrl}
              alt={card.name}
              fill
              unoptimized
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-zinc-500">
              Imagem Scryfall indisponível
            </div>
          )}

          {/* Botão de Virar Carta Dupla-Face */}
          {card.isDoubleSided && card.backImageUrl && (
            <button
              type="button"
              onClick={() => setShowBack(!showBack)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-zinc-950/80 px-2 py-1 text-[11px] font-medium text-white shadow backdrop-blur hover:bg-zinc-800 transition"
            >
              <RefreshCw className="h-3 w-3" />
              {showBack ? "Frente" : "Verso"}
            </button>
          )}
        </div>

        {/* Informações detalhadas */}
        <div className="flex flex-1 flex-col gap-2.5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight sm:text-xl">
                {card.name}
              </h3>
              <button
                type="button"
                onClick={handleCopy}
                title="Copiar nome da carta"
                className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-400">{card.typeLine || "Card"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${rarityColor}`}>
              {card.rarity}
            </span>
            <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-300">
              {card.setName}
            </span>
            {card.finish === "Foil" && (
              <span className="rounded-md border border-purple-500/40 bg-purple-950/40 px-2 py-0.5 text-xs font-semibold text-purple-300">
                Foil
              </span>
            )}
          </div>

          {/* Preço de Referência */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Cotação Scryfall de Referência
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {card.marketPriceCents > 0
                  ? formatCurrency(card.marketPriceCents)
                  : "Sob Consulta"}
              </span>
              {card.usdPrice > 0 && (
                <span className="text-xs text-zinc-400">
                  (~{formatUsd(card.usdPrice)})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onScanNext}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/90 px-4 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Escanear Próxima
        </button>

        {onSelectForBuylist && (
          <button
            type="button"
            onClick={() => onSelectForBuylist(card)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white shadow-lg shadow-amber-900/40 transition hover:bg-amber-500"
          >
            <Wallet className="h-3.5 w-3.5" />
            Adicionar ao Buylist
          </button>
        )}

        {onSelectForStore && (
          <button
            type="button"
            onClick={() => onSelectForStore(card)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500"
          >
            <Store className="h-3.5 w-3.5" />
            Ver Estoque da Loja
          </button>
        )}

        {card.scryfallUri && (
          <a
            href={card.scryfallUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white sm:h-10 sm:w-10"
            title="Abrir no Scryfall"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
