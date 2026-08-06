import type { Game } from "@/lib/types";

export type MagicSealedType =
  | "booster_box"
  | "collector_booster_box"
  | "set_booster_box"
  | "bundle"
  | "commander_deck"
  | "starter_kit"
  | "secret_lair"
  | "other";

export type PokemonSealedType =
  | "booster_box"
  | "elite_trainer_box"
  | "collection_box"
  | "tin"
  | "blister"
  | "ultra_premium"
  | "booster_pack"
  | "other";

export type YugiohSealedType =
  | "booster_box"
  | "structure_deck"
  | "tin"
  | "collector_tin"
  | "booster_pack"
  | "other";

export type SealedType = MagicSealedType | PokemonSealedType | YugiohSealedType;

export const MAGIC_SEALED_TYPES: ReadonlyArray<{ value: MagicSealedType; label: string }> = [
  { value: "booster_box", label: "Booster Box" },
  { value: "collector_booster_box", label: "Collector Booster Box" },
  { value: "set_booster_box", label: "Set Booster Box" },
  { value: "bundle", label: "Bundle" },
  { value: "commander_deck", label: "Commander Deck" },
  { value: "starter_kit", label: "Starter Kit" },
  { value: "secret_lair", label: "Secret Lair" },
  { value: "other", label: "Outro" }
];

export const POKEMON_SEALED_TYPES: ReadonlyArray<{ value: PokemonSealedType; label: string }> = [
  { value: "booster_box", label: "Booster Box" },
  { value: "elite_trainer_box", label: "Elite Trainer Box" },
  { value: "collection_box", label: "Collection Box" },
  { value: "tin", label: "Lata / Tin" },
  { value: "blister", label: "Blister" },
  { value: "ultra_premium", label: "Ultra-Premium Collection" },
  { value: "booster_pack", label: "Booster Pack" },
  { value: "other", label: "Outro" }
];

export const YUGIOH_SEALED_TYPES: ReadonlyArray<{ value: YugiohSealedType; label: string }> = [
  { value: "booster_box", label: "Booster Box" },
  { value: "structure_deck", label: "Structure Deck" },
  { value: "tin", label: "Tin / Mega Tin" },
  { value: "collector_tin", label: "Collector's Tin" },
  { value: "booster_pack", label: "Booster Pack" },
  { value: "other", label: "Outro" }
];

export function sealedTypesForGame(game: Game) {
  if (game === "Magic") return MAGIC_SEALED_TYPES;
  if (game === "Pokemon") return POKEMON_SEALED_TYPES;
  return YUGIOH_SEALED_TYPES;
}

export function isValidSealedType(game: Game, value: string): value is SealedType {
  return sealedTypesForGame(game).some((item) => item.value === value);
}

export function sealedTypeLabel(game: Game, value: string | null | undefined) {
  if (!value) return "Selado";
  const found = sealedTypesForGame(game).find((item) => item.value === value);
  return found?.label ?? value;
}

/** True for sealed catalog products (kind, type, or Selado tag). */
export function isSealedProduct(card: {
  productKind?: string | null;
  sealedType?: string | null;
  tags?: string[] | null;
}) {
  if (card.productKind === "sealed") return true;
  if (card.sealedType) return true;
  return (card.tags ?? []).some((tag) => tag.trim().toLowerCase() === "selado");
}

/** Infere o tipo selado a partir do nome do produto (heurística por jogo). */
export function inferSealedType(game: Game, productName: string): SealedType {
  const n = productName.toLowerCase();

  if (game === "Magic") {
    if (/secret\s*lair/.test(n)) return "secret_lair";
    if (/collector\s*booster/.test(n)) return "collector_booster_box";
    if (/set\s*booster/.test(n)) return "set_booster_box";
    if (/commander|precon|deck\b/.test(n) && !/booster/.test(n)) return "commander_deck";
    if (/starter|beginner|spellslinger/.test(n)) return "starter_kit";
    if (/bundle|gift\s*bundle|gift\s*edition/.test(n)) return "bundle";
    if (/booster\s*(box|display)|draft\s*booster|play\s*booster/.test(n)) return "booster_box";
    return "other";
  }

  if (game === "Pokemon") {
    if (/ultra[-\s]?premium/.test(n)) return "ultra_premium";
    if (/elite\s*trainer|etb\b|pokemon\s*center\s*elite/.test(n)) return "elite_trainer_box";
    if (/\btin\b|lata\b/.test(n)) return "tin";
    if (/blister|3[-\s]?pack|sleeved\s*booster/.test(n)) return "blister";
    if (/collection\s*box|illustration\s*collection|build\s*&\s*battle|premium\s*collection/.test(n)) {
      return "collection_box";
    }
    if (/booster\s*box|booster\s*display/.test(n)) return "booster_box";
    if (/booster\s*pack/.test(n)) return "booster_pack";
    return "other";
  }

  // Yu-Gi-Oh!
  if (/structure\s*deck/.test(n)) return "structure_deck";
  if (/collector'?s?\s*tin/.test(n)) return "collector_tin";
  if (/\btin\b|mega\s*tin/.test(n)) return "tin";
  if (/booster\s*box|booster\s*display/.test(n)) return "booster_box";
  if (/booster\s*pack/.test(n)) return "booster_pack";
  return "other";
}

export function tcgplayerProductLine(game: Game) {
  if (game === "Magic") return "magic";
  if (game === "Pokemon") return "pokemon";
  return "yugioh";
}

export function tcgplayerImageUrl(productId: number | string) {
  const id = String(productId).replace(/\.0$/, "");
  return `https://product-images.tcgplayer.com/fit-in/400x400/${id}.jpg`;
}
