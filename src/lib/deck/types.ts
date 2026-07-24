export type DeckRole =
  | "land"
  | "creature"
  | "artifact"
  | "enchantment"
  | "planeswalker"
  | "instant"
  | "sorcery"
  | "battle"
  | "ramp"
  | "draw"
  | "removal"
  | "boardWipe"
  | "counterspell"
  | "tutor"
  | "gameChanger"
  | "fastMana"
  | "extraTurn"
  | "landDenial"
  | "protection"
  | "tokenMaker"
  | "sacrifice";

export type DeckArchetype =
  | "tokens"
  | "aristocrats"
  | "spellslinger"
  | "voltron"
  | "landfall"
  | "reanimator"
  | "blink"
  | "artifacts"
  | "stax"
  | "combo"
  | "aggro"
  | "control"
  | "tribal"
  | "graveyard"
  | "enchantress"
  | "midrange"
  | "unknown";

export type CommanderBracket = 1 | 2 | 3 | 4 | 5;

export type ParsedDeckLine = {
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  section: "commander" | "main" | "maybe" | "ignore";
};

export type ScryfallCardData = {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  color_identity: string[];
  colors?: string[];
  legalities?: { commander?: string };
  image_uris?: { small?: string; normal?: string; art_crop?: string };
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    image_uris?: { small?: string; normal?: string; art_crop?: string };
  }>;
  keywords?: string[];
};

export type AnalyzedCard = {
  name: string;
  quantity: number;
  section: "commander" | "main";
  cmc: number;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  colorIdentity: string[];
  imageUrl: string;
  artCropUrl: string;
  legal: boolean;
  roles: DeckRole[];
  isGameChanger: boolean;
  isFastMana: boolean;
};

export type ManaCurveBin = {
  label: string;
  cmc: number;
  count: number;
};

export type RoleBreakdown = {
  role: DeckRole;
  label: string;
  count: number;
  cards: string[];
};

export type ArchetypeScore = {
  id: DeckArchetype;
  label: string;
  score: number;
  evidence: string[];
};

export type BracketAssessment = {
  bracket: CommanderBracket;
  label: string;
  confidence: "baixa" | "media" | "alta";
  summary: string;
  signals: string[];
};

export type DeckSuggestion = {
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  relatedCards?: string[];
};

export type DeckStrength = {
  title: string;
  detail: string;
};

export type DeckAnalysis = {
  commander: AnalyzedCard | null;
  partners: AnalyzedCard[];
  cards: AnalyzedCard[];
  colorIdentity: string[];
  totalCards: number;
  maindeckCount: number;
  expectedMaindeck: 99 | 98;
  manaCurve: ManaCurveBin[];
  averageCmc: number;
  landCount: number;
  roles: RoleBreakdown[];
  archetypes: ArchetypeScore[];
  bracket: BracketAssessment;
  strengths: DeckStrength[];
  suggestions: DeckSuggestion[];
  synergyNotes: string[];
  unresolvedNames: string[];
  illegals: string[];
  colorIdentityViolations: string[];
  duplicates: string[];
  analyzedAt: string;
};

export type DeckAnalyzeRequest = {
  list: string;
  commanderName?: string;
};

export type DeckAnalyzeResponse =
  | { ok: true; analysis: DeckAnalysis }
  | { ok: false; message: string };
