import type { DeckArchetype, DeckRole } from "./types";

/**
 * Lista oficial de Game Changers (Commander Brackets / WotC).
 * Fonte: Scryfall `is:gamechanger` — sincronizada em 2026-07-26 (53 cartas).
 * Toxic Deluge, Damnation, etc. NÃO estão nesta lista.
 */
export const GAME_CHANGERS = new Set(
  [
    "Ad Nauseam",
    "Ancient Tomb",
    "Aura Shards",
    "Biorhythm",
    "Bolas's Citadel",
    "Braids, Cabal Minion",
    "Chrome Mox",
    "Coalition Victory",
    "Consecrated Sphinx",
    "Crop Rotation",
    "Cyclonic Rift",
    "Demonic Tutor",
    "Drannith Magistrate",
    "Enlightened Tutor",
    "Farewell",
    "Field of the Dead",
    "Fierce Guardianship",
    "Force of Will",
    "Gaea's Cradle",
    "Gamble",
    "Gifts Ungiven",
    "Glacial Chasm",
    "Grand Arbiter Augustin IV",
    "Grim Monolith",
    "Humility",
    "Imperial Seal",
    "Intuition",
    "Jeska's Will",
    "Lion's Eye Diamond",
    "Mana Vault",
    "Mishra's Workshop",
    "Mox Diamond",
    "Mystical Tutor",
    "Narset, Parter of Veils",
    "Natural Order",
    "Necropotence",
    "Notion Thief",
    "Opposition Agent",
    "Orcish Bowmasters",
    "Panoptic Mirror",
    "Rhystic Study",
    "Seedborn Muse",
    "Serra's Sanctum",
    "Smothering Tithe",
    "Survival of the Fittest",
    "Teferi's Protection",
    "Tergrid, God of Fright",
    "Tergrid, God of Fright // Tergrid's Lantern",
    "Thassa's Oracle",
    "The One Ring",
    "The Tabernacle at Pendrell Vale",
    "Underworld Breach",
    "Vampiric Tutor",
    "Worldly Tutor"
  ].map((name) => normalizeCardKey(name))
);

export function isOfficialGameChanger(name: string) {
  const key = normalizeCardKey(name);
  if (GAME_CHANGERS.has(key)) return true;
  const front = key.split(" // ")[0]?.trim();
  return Boolean(front && GAME_CHANGERS.has(front));
}

function normalizeCardKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export const FAST_MANA = new Set(
  [
    "Mana Vault",
    "Chrome Mox",
    "Mox Diamond",
    "Mox Opal",
    "Lotus Petal",
    "Lion's Eye Diamond",
    "Grim Monolith",
    "Ancient Tomb",
    "City of Traitors",
    "Dark Ritual",
    "Cabal Ritual",
    "Seething Song",
    "Pyretic Ritual",
    "Simian Spirit Guide",
    "Elvish Spirit Guide",
    // Legadas / banidas: ainda detectamos se aparecerem na lista
    "Mana Crypt",
    "Jeweled Lotus"
  ].map((name) => normalizeCardKey(name))
);

export const EXTRA_TURN_HINTS = [
  "extra turn",
  "additional turn",
  "take an extra turn"
];

export const MASS_LAND_DENIAL_HINTS = [
  "destroy all lands",
  "each player sacrifices a land",
  "lands don't untap",
  "nonbasic lands are mountains",
  "armageddon",
  "ravages of war",
  "sundering titan",
  "strip mine",
  "wasteland",
  "ghost quarter"
];

export const ARCHETYPE_RULES: Array<{
  id: DeckArchetype;
  label: string;
  weight: number;
  test: (oracle: string, typeLine: string, name: string) => boolean;
}> = [
  {
    id: "tokens",
    label: "Tokens",
    weight: 1,
    test: (o) =>
      /create .* token|token creature|populate|parallel lives|anointed procession/i.test(o)
  },
  {
    id: "aristocrats",
    label: "Aristocrats",
    weight: 1.2,
    test: (o) =>
      /whenever .* (dies|is sacrificed)|sacrifice a creature|blood artist|zulaport|pitiless/i.test(
        o
      )
  },
  {
    id: "spellslinger",
    label: "Spellslinger",
    weight: 1,
    test: (o, t) =>
      /instant or sorcery|prowess|storm|magecraft/i.test(o) ||
      (/instant|sorcery/i.test(t) && /copy|storm|prowess/i.test(o))
  },
  {
    id: "voltron",
    label: "Voltron",
    weight: 1.1,
    test: (o) =>
      /equipped creature|aura|attach|double strike|hexproof|indestructible|commander creatures you control get/i.test(
        o
      )
  },
  {
    id: "landfall",
    label: "Landfall",
    weight: 1.2,
    test: (o) => /landfall|whenever a land enters|play an additional land/i.test(o)
  },
  {
    id: "reanimator",
    label: "Reanimator",
    weight: 1.1,
    test: (o) =>
      /return .* from (your )?graveyard|reanimate|uneath|living death|animate dead/i.test(o)
  },
  {
    id: "blink",
    label: "Blink / Flicker",
    weight: 1,
    test: (o) => /exile .* then return|flicker|blink|enters the battlefield/i.test(o) && /exile/i.test(o)
  },
  {
    id: "artifacts",
    label: "Artifacts / Affinity",
    weight: 1,
    test: (o, t) => /artifact/i.test(t) || /affinity|metalcraft|historic/i.test(o)
  },
  {
    id: "stax",
    label: "Stax / Hate",
    weight: 1.3,
    test: (o) =>
      /players can't|don't untap|skip (their|your)|unless .* pays|tax|rule of law|drannith|opposition agent/i.test(
        o
      )
  },
  {
    id: "combo",
    label: "Combo",
    weight: 1.2,
    test: (o) =>
      /infinite|win the game|you win|thassa's oracle|demonic consultation|underworld breach/i.test(o)
  },
  {
    id: "aggro",
    label: "Aggro / Stompy",
    weight: 0.8,
    test: (o, t) =>
      /haste|trample|power \+|creatures you control get \+/i.test(o) && /creature/i.test(t)
  },
  {
    id: "control",
    label: "Control",
    weight: 0.9,
    test: (o) => /counter target|destroy all|board wipe|wrath|cyclonic rift/i.test(o)
  },
  {
    id: "tribal",
    label: "Tribal",
    weight: 1,
    test: (o) =>
      /elf|goblin|zombie|vampire|dragon|mermaid|dinosaur|sliver|wizard|knight|angel|demon/i.test(
        o
      ) && /creatures you control|other .* you control get/i.test(o)
  },
  {
    id: "graveyard",
    label: "Graveyard / Dredge",
    weight: 1,
    test: (o) => /mill|dredge|escape|flashback|unearth|from your graveyard/i.test(o)
  },
  {
    id: "enchantress",
    label: "Enchantress",
    weight: 1.1,
    test: (o, t) => /enchantment/i.test(t) || /enchantress|constellation|aura/i.test(o)
  }
];

export function detectRoles(oracle: string, typeLine: string, name: string): DeckRole[] {
  const roles = new Set<DeckRole>();
  const o = oracle.toLowerCase();
  const t = typeLine.toLowerCase();
  const n = normalizeCardKey(name);
  const isLand = /\bland\b/i.test(typeLine);

  if (isLand) roles.add("land");
  if (t.includes("creature")) roles.add("creature");
  if (t.includes("artifact") && !t.includes("creature")) roles.add("artifact");
  if (t.includes("enchantment") && !t.includes("creature")) roles.add("enchantment");
  if (t.includes("planeswalker")) roles.add("planeswalker");
  if (t.includes("instant")) roles.add("instant");
  if (t.includes("sorcery")) roles.add("sorcery");
  if (t.includes("battle")) roles.add("battle");

  // Terrenos com "Add {B}" NÃO contam como ramp — só aceleradores reais.
  if (!isLand) {
    const manaRockOrDork =
      (/add \{[wubrgc0-9/]+\}|add one mana|add \{.\}/i.test(o) ||
        /sol ring|arcane signet|talisman|fellwar|mind stone|thought vessel|commander['’]?s plate|everflowing chalice/i.test(
          n
        )) &&
      (t.includes("artifact") || t.includes("creature"));

    const landRamp =
      /search your library for .{0,60}land|put (a|up to .*) land .* onto the battlefield|rampant growth|cultivate|kodama's reach|nature's lore|three visits|farseek|sakura-tribe elder|wood elves|into the north/i.test(
        `${o} ${n}`
      );

    if (manaRockOrDork || landRamp || FAST_MANA.has(n)) {
      roles.add("ramp");
    }
  }

  if (
    !isLand &&
    /draw (a|one|two|three|x|\d+)? ?cards?|investigate|cantrip|rhystic study|mystic remora|brainstorm|ponder|preordain|night's whisper|sign in blood|read the bones|phyrexian arena|sylvan library|esper sentinel/i.test(
      `${o} ${n}`
    )
  ) {
    roles.add("draw");
  }

  if (
    !isLand &&
    /destroy target|exile target|deal \d+ damage to|fight target|goad|path to exile|swords to plowshares|assassin's trophy|beast within|generous gift|chaos warp/i.test(
      `${o} ${n}`
    ) &&
    !/destroy all|each creature|all creatures/i.test(o)
  ) {
    roles.add("removal");
  }

  if (
    !isLand &&
    /destroy all|each creature|all creatures|wrath|damnation|blasphemous|cyclonic rift|toxic deluge|farewell/i.test(
      `${o} ${n}`
    )
  ) {
    roles.add("boardWipe");
  }

  if (!isLand && /counter target/i.test(o)) roles.add("counterspell");

  if (
    !isLand &&
    (/search your library for (a|an|up to).*(card|creature|instant|sorcery|enchantment|artifact|permanent)/i.test(
      o
    ) ||
      /tutor|vampiric tutor|demonic tutor|enlightened tutor|worldly tutor|imperial seal|mystical tutor/i.test(
        `${o} ${n}`
      ))
  ) {
    roles.add("tutor");
  }

  if (isOfficialGameChanger(name)) roles.add("gameChanger");
  if (!isLand && FAST_MANA.has(n)) roles.add("fastMana");
  if (!isLand && EXTRA_TURN_HINTS.some((hint) => o.includes(hint))) roles.add("extraTurn");
  if (
    MASS_LAND_DENIAL_HINTS.some((hint) => o.includes(hint) || n.includes(hint)) ||
    /armageddon|ravages of war|sundering titan|strip mine|wasteland/i.test(n)
  ) {
    roles.add("landDenial");
  }

  if (
    !isLand &&
    /protection from|hexproof|indestructible|teferi's protection|silence|grand abolisher|lightning greaves|swiftfoot boots|darksteel plate/i.test(
      `${o} ${n}`
    )
  ) {
    roles.add("protection");
  }

  if (!isLand && /create .* token/i.test(o)) roles.add("tokenMaker");
  if (!isLand && /whenever .* dies|sacrifice a creature/i.test(o)) roles.add("sacrifice");

  return [...roles];
}
