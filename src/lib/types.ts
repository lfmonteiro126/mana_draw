export type Game = "Magic" | "Yu-Gi-Oh!" | "Pokemon";

export type CardCondition = "NM" | "SP" | "MP" | "HP";

export type TcgCard = {
  id: string;
  name: string;
  game: Game;
  setName: string;
  rarity: string;
  condition: CardCondition;
  language: "PT" | "EN" | "JP";
  priceCents: number;
  marketPriceCents: number;
  stock: number;
  imageUrl: string;
  tags: string[];
  finish: "Normal" | "Foil" | "Holo" | "Secret";
};

export type SortMode = "relevance" | "price-asc" | "price-desc";

export type FilterGame = "Todos" | Game;

export type UserRole = "customer" | "admin";

export type StoreUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type OrderSummary = {
  id: string;
  status: string;
  subtotalCents: number;
  createdAt: string;
  itemCount: number;
  customerEmail?: string;
};

export type BuylistItem = {
  game: Game;
  title: string;
  estimate: string;
  turnaround: string;
};

export type BuylistSubmission = {
  id: string;
  customerName: string;
  email: string;
  game: Game;
  status: string;
  notes: string;
  photoCount: number;
  offerCents: number | null;
  photoUrls: string[];
  createdAt: string;
};

export type CardSuggestion = {
  externalId: string;
  name: string;
  game: Game;
  setName: string;
  printLabel: string;
  rarity: string;
  language: TcgCard["language"];
  marketPriceCents: number;
  imageUrl: string;
  tags: string[];
  finish: TcgCard["finish"];
  source: "Scryfall" | "Pokemon TCG" | "YGOPRODeck";
};
