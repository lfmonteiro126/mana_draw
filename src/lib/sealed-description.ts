import { inferSealedType, sealedTypeLabel, type SealedType } from "@/lib/sealed";
import type { Game, TcgCard } from "@/lib/types";

const languageLabel: Record<TcgCard["language"], string> = {
  PT: "português",
  EN: "inglês",
  JP: "japonês"
};

const typeBlurb: Record<string, string> = {
  booster_box:
    "Caixa fechada de fábrica com boosters oficiais — ideal para abrir em grupo ou abastecer a coleção com volume.",
  collector_booster_box:
    "Display de Collector Boosters com cartas premium, foils especiais e maior chance de hits de colecionador.",
  set_booster_box:
    "Display de Set Boosters focada em variedade da coleção, arts alternativas e experiência de abertura moderna.",
  bundle:
    "Bundle oficial com boosters, dados/spindown, lands e acessórios — ótimo ponto de partida para a coleção.",
  commander_deck:
    "Deck Commander pré-construído e pronto para jogar, com envelope de cartas e a identidade do comandante.",
  starter_kit:
    "Kit inicial com decks e boosters para começar a jogar rápido, sem montar lista do zero.",
  secret_lair:
    "Secret Lair selada com arts exclusivas e tiragem limitada — produto de colecionador.",
  elite_trainer_box:
    "Elite Trainer Box com boosters, sleeves, dados, divisórias e energia — o kit completo para jogar e colecionar.",
  collection_box:
    "Collection Box selada com boosters e itens promocionais da coleção.",
  tin: "Lata/tin selada com boosters e, em geral, carta promocional — formato compacto para presente ou coleção.",
  blister: "Blister selado com boosters (e frequentemente promo) — entrada acessível na coleção.",
  ultra_premium:
    "Ultra-Premium Collection com boosters, acessórios e itens exclusivos de alto valor para colecionadores.",
  booster_pack: "Booster pack individual selado — uma abertura rápida sem comprometer no display inteiro.",
  structure_deck:
    "Structure Deck pronto para duel, com lista temática e extras oficiais do Yu-Gi-Oh!.",
  collector_tin: "Collector's Tin selada com boosters e promo — formato premium de lata.",
  other: "Produto selado de fábrica, lacrado e pronto para envio ou retirada."
};

/**
 * Descrição de vitrine para produto selado (PT-BR).
 * Usa metadados da loja — não depende de Scryfall.
 */
export function buildSealedDescription(
  card: Pick<TcgCard, "name" | "game" | "setName" | "language" | "sealedType" | "tags">
) {
  const type = resolveSealedType(card);
  const typeName = sealedTypeLabel(card.game, type);
  const lang = languageLabel[card.language] ?? card.language;
  const set = card.setName?.trim() || "coleção oficial";
  const blurb = typeBlurb[type] ?? typeBlurb.other;

  return [
    `${card.name} é um produto selado de ${card.game} (${typeName}), edição ${set}, em ${lang}.`,
    blurb,
    gameIntro(card.game, set),
    "Item lacrado de fábrica, com estoque real na Mana Draw — envio rastreado ou retirada na loja."
  ].join(" ");
}

function resolveSealedType(
  card: Pick<TcgCard, "game" | "name" | "sealedType" | "tags">
): SealedType {
  if (card.sealedType) return card.sealedType;
  return inferSealedType(card.game, card.name || (card.tags ?? []).join(" "));
}

function gameIntro(game: Game, set: string) {
  if (game === "Magic") {
    return `Coleção ${set} de Magic: The Gathering — produto oficial Wizards of the Coast.`;
  }
  if (game === "Pokemon") {
    return `Coleção ${set} do Pokémon TCG — produto oficial The Pokémon Company.`;
  }
  return `Coleção ${set} de Yu-Gi-Oh! — produto oficial Konami.`;
}
