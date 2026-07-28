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
  backImageUrl?: string;
  isDoubleSided?: boolean;
  layout?: string;
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

export type OrderLineItem = {
  name: string;
  imageUrl: string;
  quantity: number;
  unitPriceCents: number;
  condition?: string | null;
  game?: string | null;
};

export type OrderSummary = {
  id: string;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  shippingMethod?: string | null;
  shippingServiceName?: string | null;
  shippingCompany?: string | null;
  shippingDays?: number | null;
  shippingPostalCode?: string | null;
  paymentProvider?: string | null;
  paymentStatus?: string | null;
  paymentId?: string | null;
  createdAt: string;
  itemCount: number;
  customerEmail?: string;
  items: OrderLineItem[];
};

export type BuylistItem = {
  game: Game;
  title: string;
  estimate: string;
  turnaround: string;
};

export type BuylistStatus =
  | "new"
  | "reviewing"
  | "offered"
  | "declined"
  | "awaiting_shipment"
  | "in_transit"
  | "received"
  | "checking"
  | "stocked"
  | "paid"
  | "cancelled"
  | "approved";

export type BuylistInboundMethod = "mail" | "pickup";

export type BuylistLineStatus = "pending" | "accepted" | "rejected" | "adjusted";

export type BuylistLine = {
  id: string;
  submissionId: string;
  name: string;
  game: Game;
  setName: string | null;
  conditionExpected: CardCondition | null;
  conditionReceived: CardCondition | null;
  qtyOffered: number;
  qtyAccepted: number;
  unitOfferCents: number;
  lineStatus: BuylistLineStatus;
  cardId: string | null;
  externalId: string | null;
  notes: string | null;
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
  offerNote: string | null;
  offerExpiresAt: string | null;
  payoutCents: number | null;
  inboundMethod: BuylistInboundMethod | null;
  trackingCode: string | null;
  pickupAt: string | null;
  customerAcceptedAt: string | null;
  customerDeclinedAt: string | null;
  receivedAt: string | null;
  stockedAt: string | null;
  paidAt: string | null;
  userId: string | null;
  hasAcceptToken: boolean;
  acceptTokenExpiresAt: string | null;
  photoUrls: string[];
  lines: BuylistLine[];
  createdAt: string;
  /** Token em claro só quando acabou de ser gerado (não persiste). */
  acceptToken?: string | null;
  customerUrl?: string | null;
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
  /** Moeda do marketPriceCents (Scryfall = USD). */
  marketCurrency?: "USD" | "EUR" | "BRL";
  marketUsd?: number | null;
  marketUsdFoil?: number | null;
  imageUrl: string;
  backImageUrl?: string;
  isDoubleSided?: boolean;
  layout?: string;
  tags: string[];
  finish: TcgCard["finish"];
  source: "Scryfall" | "Pokemon TCG" | "YGOPRODeck";
};

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orderCount: number;
  totalSpentCents: number;
  buylistCount: number;
  lastOrderAt: string | null;
  createdAt: string;
};
