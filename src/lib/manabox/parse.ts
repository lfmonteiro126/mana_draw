import { extractCardIdentity } from "@/lib/deck/parse";
import type { CardCondition, TcgCard } from "@/lib/types";

export type ManaBoxParsedRow = {
  line: number;
  name: string;
  quantity: number;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  scryfallId?: string;
  foil?: boolean;
  etched?: boolean;
  rarity?: string;
  condition?: CardCondition;
  language?: TcgCard["language"];
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  raw: string;
};

export type ManaBoxParseResult = {
  format: "csv" | "txt";
  rows: ManaBoxParsedRow[];
  warnings: string[];
};

const CSV_ALIASES: Record<string, string[]> = {
  name: ["name", "card name", "card_name", "nome"],
  setCode: ["set code", "set_code", "setcode", "codigo", "código", "edition code"],
  setName: ["set name", "set_name", "setname", "set", "edition", "colecao", "coleção"],
  collectorNumber: [
    "collector number",
    "collector_number",
    "card number",
    "card_number",
    "number",
    "numero",
    "número"
  ],
  foil: ["foil", "foiling", "finish"],
  rarity: ["rarity", "raridade"],
  quantity: ["quantity", "qty", "count", "quantidade", "qtd"],
  scryfallId: ["scryfall id", "scryfall_id", "scryfallid", "uuid"],
  condition: ["condition", "condicao", "condição"],
  language: ["language", "lang", "idioma"],
  purchasePrice: ["purchase price", "purchase_price", "price", "preco", "preço"],
  purchaseCurrency: [
    "purchase price currency",
    "purchase_price_currency",
    "purchase currency",
    "currency",
    "moeda"
  ]
};

const MAX_ROWS = 500;

export function parseManaBoxInput(raw: string): ManaBoxParseResult {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) {
    return { format: "txt", rows: [], warnings: ["Arquivo vazio."] };
  }

  if (looksLikeCsv(text)) {
    return parseManaBoxCsv(text);
  }

  return parseManaBoxTxt(text);
}

function looksLikeCsv(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
  if (!firstLine.includes(",")) return false;
  const headers = splitCsvLine(firstLine).map(normalizeHeader);
  return (
    headers.some((header) => CSV_ALIASES.name.includes(header)) ||
    headers.some((header) => CSV_ALIASES.scryfallId.includes(header))
  );
}

function parseManaBoxCsv(text: string): ManaBoxParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const warnings: string[] = [];
  if (lines.length < 2) {
    return { format: "csv", rows: [], warnings: ["CSV sem linhas de dados."] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const index = buildColumnIndex(headers);

  if (index.name == null && index.scryfallId == null) {
    return {
      format: "csv",
      rows: [],
      warnings: ["CSV ManaBox precisa da coluna Name ou Scryfall ID."]
    };
  }

  const rows: ManaBoxParsedRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      warnings.push(`Limite de ${MAX_ROWS} linhas atingido; restante ignorado.`);
      break;
    }

    const cols = splitCsvLine(lines[i]);
    if (cols.every((col) => !col.trim())) continue;

    const name = (index.name != null ? cols[index.name] : "")?.trim() ?? "";
    const scryfallId = cleanScryfallId(index.scryfallId != null ? cols[index.scryfallId] : "");
    if (!name && !scryfallId) {
      warnings.push(`Linha ${i + 1}: sem nome nem Scryfall ID.`);
      continue;
    }

    const foilRaw = (index.foil != null ? cols[index.foil] : "")?.trim() ?? "";
    const foilInfo = parseFoil(foilRaw);
    const quantity = parseQuantity(index.quantity != null ? cols[index.quantity] : "1");
    const purchasePrice = parseMoney(index.purchasePrice != null ? cols[index.purchasePrice] : "");
    const purchaseCurrency =
      (index.purchaseCurrency != null ? cols[index.purchaseCurrency] : "")?.trim().toUpperCase() ||
      null;

    rows.push({
      line: i + 1,
      name: name || `Scryfall ${scryfallId?.slice(0, 8)}`,
      quantity,
      setCode: cleanOptional(index.setCode != null ? cols[index.setCode] : ""),
      setName: cleanOptional(index.setName != null ? cols[index.setName] : ""),
      collectorNumber: cleanOptional(
        index.collectorNumber != null ? cols[index.collectorNumber] : ""
      ),
      scryfallId,
      foil: foilInfo.foil,
      etched: foilInfo.etched,
      rarity: cleanOptional(index.rarity != null ? cols[index.rarity] : ""),
      condition: mapCondition(index.condition != null ? cols[index.condition] : ""),
      language: mapLanguage(index.language != null ? cols[index.language] : ""),
      purchasePrice,
      purchaseCurrency,
      raw: lines[i]
    });
  }

  return { format: "csv", rows, warnings };
}

function parseManaBoxTxt(text: string): ManaBoxParseResult {
  const warnings: string[] = [];
  const rows: ManaBoxParsedRow[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    if (rows.length >= MAX_ROWS) {
      warnings.push(`Limite de ${MAX_ROWS} linhas atingido; restante ignorado.`);
      break;
    }

    const original = lines[i];
    const line = original.trim();
    if (!line) continue;
    if (/^(https?:\/\/|\/\/|#|\$|total|sideboard|maybeboard)/i.test(line)) continue;

    const match = line.match(/^(?:(\d+)\s*x\s+|(\d+)x\s*|(\d+)\s+)?(.+?)\s*$/i);
    if (!match?.[4]) continue;

    let rest = match[4].trim();
    const foil = /\b(foil|etched)\b/i.test(rest);
    const etched = /\betched\b/i.test(rest);
    rest = rest.replace(/\b(foil|etched)\b/gi, "").replace(/\s{2,}/g, " ").trim();

    const identity = extractCardIdentity(rest);
    if (!identity.name || identity.name.length < 2) {
      warnings.push(`Linha ${i + 1}: nome inválido.`);
      continue;
    }

    rows.push({
      line: i + 1,
      name: identity.name,
      quantity: Math.max(1, Number(match[1] || match[2] || match[3] || "1") || 1),
      setCode: identity.setCode,
      collectorNumber: identity.collectorNumber,
      foil,
      etched,
      raw: original
    });
  }

  return { format: "txt", rows, warnings };
}

function buildColumnIndex(headers: string[]) {
  const index: Partial<Record<keyof typeof CSV_ALIASES, number>> = {};
  for (const [field, aliases] of Object.entries(CSV_ALIASES)) {
    const found = headers.findIndex((header) => aliases.includes(header));
    if (found >= 0) index[field as keyof typeof CSV_ALIASES] = found;
  }
  return index;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current);
  return result;
}

function parseQuantity(value?: string) {
  const n = Number(String(value ?? "1").replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(999, Math.floor(n));
}

function parseMoney(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseFoil(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["false", "0", "no", "n", "regular", "normal", "nonfoil"].includes(normalized)) {
    return { foil: false, etched: false };
  }
  if (normalized.includes("etch")) return { foil: true, etched: true };
  if (["true", "1", "yes", "y", "foil", "foiled"].includes(normalized) || normalized.includes("foil")) {
    return { foil: true, etched: false };
  }
  return { foil: false, etched: false };
}

export function mapCondition(value?: string | null): CardCondition | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["nm", "near mint", "mint", "m"].includes(normalized)) return "NM";
  if (["sp", "lp", "lightly played", "slightly played", "excellent", "ex"].includes(normalized)) {
    return "SP";
  }
  if (["mp", "moderately played", "good", "gd"].includes(normalized)) return "MP";
  if (["hp", "heavily played", "played", "poor", "damaged", "dmg", "d"].includes(normalized)) {
    return "HP";
  }
  return undefined;
}

export function mapLanguage(value?: string | null): TcgCard["language"] | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["en", "eng", "english", "ingles", "inglês"].includes(normalized)) return "EN";
  if (["pt", "por", "portuguese", "portugues", "português", "pt-br", "br"].includes(normalized)) {
    return "PT";
  }
  if (["jp", "ja", "jpn", "japanese", "japones", "japonês"].includes(normalized)) return "JP";
  return undefined;
}

function cleanOptional(value?: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed || undefined;
}

function cleanScryfallId(value?: string) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export type ManaBoxValidation = {
  ok: boolean;
  format: "csv" | "txt";
  message: string;
  rowCount: number;
  quantity: number;
  withScryfallId: number;
  withSetAndNumber: number;
  nameOnly: number;
  warnings: string[];
  sample: Array<{
    line: number;
    name: string;
    quantity: number;
    setCode?: string;
    collectorNumber?: string;
    scryfallId?: string;
    foil?: boolean;
  }>;
};

/** Valida formato CSV/TXT localmente, sem chamar Scryfall. */
export function validateManaBoxInput(raw: string): ManaBoxValidation {
  const parsed = parseManaBoxInput(raw);
  const quantity = parsed.rows.reduce((sum, row) => sum + row.quantity, 0);
  const withScryfallId = parsed.rows.filter((row) => Boolean(row.scryfallId)).length;
  const withSetAndNumber = parsed.rows.filter(
    (row) => !row.scryfallId && Boolean(row.setCode && row.collectorNumber)
  ).length;
  const nameOnly = parsed.rows.filter(
    (row) => !row.scryfallId && !(row.setCode && row.collectorNumber)
  ).length;

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      format: parsed.format,
      message: parsed.warnings[0] || "Nenhuma carta reconhecida. Confira o formato ManaBox.",
      rowCount: 0,
      quantity: 0,
      withScryfallId: 0,
      withSetAndNumber: 0,
      nameOnly: 0,
      warnings: parsed.warnings,
      sample: []
    };
  }

  return {
    ok: true,
    format: parsed.format,
    message: `Arquivo ${parsed.format.toUpperCase()} válido: ${parsed.rows.length} linha(s), ${quantity} unidade(s).`,
    rowCount: parsed.rows.length,
    quantity,
    withScryfallId,
    withSetAndNumber,
    nameOnly,
    warnings: parsed.warnings,
    sample: parsed.rows.slice(0, 8).map((row) => ({
      line: row.line,
      name: row.name,
      quantity: row.quantity,
      setCode: row.setCode,
      collectorNumber: row.collectorNumber,
      scryfallId: row.scryfallId,
      foil: row.foil
    }))
  };
}

export const MANABOX_MAX_ROWS = MAX_ROWS;
