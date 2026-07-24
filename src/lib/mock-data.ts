import type { BuylistItem, TcgCard } from "./types";

export const cards: TcgCard[] = [
  {
    id: "mtg-001",
    name: "Sol Ring",
    game: "Magic",
    setName: "Commander Masters",
    rarity: "Uncommon",
    condition: "NM",
    language: "EN",
    priceCents: 2390,
    marketPriceCents: 2690,
    stock: 8,
    imageUrl:
      "https://cards.scryfall.io/normal/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591",
    tags: ["Commander", "Artefato", "Staple"],
    finish: "Normal"
  },
  {
    id: "mtg-dfc-001",
    name: "Delver of Secrets // Insectile Aberration",
    game: "Magic",
    setName: "Innistrad",
    rarity: "Common",
    condition: "NM",
    language: "EN",
    priceCents: 890,
    marketPriceCents: 990,
    stock: 4,
    imageUrl:
      "https://cards.scryfall.io/normal/front/6/9/6904ea20-e504-47da-95a0-08739fdde260.jpg?1783908173",
    backImageUrl:
      "https://cards.scryfall.io/normal/back/6/9/6904ea20-e504-47da-95a0-08739fdde260.jpg?1783908173",
    isDoubleSided: true,
    layout: "transform",
    tags: ["Magic", "isd", "transform", "Blue"],
    finish: "Normal"
  },
  {
    id: "mtg-002",
    name: "Lightning Bolt",
    game: "Magic",
    setName: "Secret Lair",
    rarity: "Rare",
    condition: "SP",
    language: "EN",
    priceCents: 4490,
    marketPriceCents: 4990,
    stock: 3,
    imageUrl:
      "https://cards.scryfall.io/normal/front/7/7/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg?1783912538",
    tags: ["Burn", "Modern", "Legacy"],
    finish: "Foil"
  },
  {
    id: "pkm-001",
    name: "Charizard ex",
    game: "Pokemon",
    setName: "Obsidian Flames",
    rarity: "Special Illustration Rare",
    condition: "NM",
    language: "EN",
    priceCents: 39990,
    marketPriceCents: 42700,
    stock: 1,
    imageUrl: "https://images.pokemontcg.io/sv3/223_hires.png",
    tags: ["Fire", "Chase", "ex"],
    finish: "Holo"
  },
  {
    id: "pkm-002",
    name: "Pikachu",
    game: "Pokemon",
    setName: "Scarlet & Violet Promo",
    rarity: "Promo",
    condition: "NM",
    language: "PT",
    priceCents: 3490,
    marketPriceCents: 3890,
    stock: 12,
    imageUrl: "https://images.pokemontcg.io/svp/27_hires.png",
    tags: ["Promo", "Colecionavel", "Eletrico"],
    finish: "Holo"
  },
  {
    id: "ygo-001",
    name: "Blue-Eyes White Dragon",
    game: "Yu-Gi-Oh!",
    setName: "Legendary Duelists",
    rarity: "Ultra Rare",
    condition: "NM",
    language: "EN",
    priceCents: 6990,
    marketPriceCents: 7990,
    stock: 4,
    imageUrl: "https://images.ygoprodeck.com/images/cards/89631139.jpg",
    tags: ["Dragon", "Anime", "Classic"],
    finish: "Secret"
  },
  {
    id: "ygo-002",
    name: "Ash Blossom & Joyous Spring",
    game: "Yu-Gi-Oh!",
    setName: "Maximum Gold",
    rarity: "Premium Gold Rare",
    condition: "SP",
    language: "EN",
    priceCents: 5590,
    marketPriceCents: 5990,
    stock: 6,
    imageUrl: "https://images.ygoprodeck.com/images/cards/14558127.jpg",
    tags: ["Hand Trap", "Meta", "Staple"],
    finish: "Secret"
  }
];

export const buylist: BuylistItem[] = [
  {
    game: "Magic",
    title: "Staples Commander e Modern",
    estimate: "70% a 82% do preço de mercado",
    turnaround: "Cotação em até 24h"
  },
  {
    game: "Pokemon",
    title: "Chases, promos e coleções completas",
    estimate: "Pagamento instantâneo após conferência",
    turnaround: "Envio reverso disponível"
  },
  {
    game: "Yu-Gi-Oh!",
    title: "Meta staples e raridades antigas",
    estimate: "Bônus para lotes acima de 50 cartas",
    turnaround: "Triagem por vídeo ou presencial"
  }
];
