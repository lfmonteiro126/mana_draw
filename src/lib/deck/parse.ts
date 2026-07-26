import type { ParsedDeckLine } from "./types";

const SECTION_MAP: Record<string, ParsedDeckLine["section"]> = {
  commander: "commander",
  commanders: "commander",
  comandante: "commander",
  comandantes: "commander",
  "commander partners": "commander",
  partner: "commander",
  partners: "commander",
  main: "main",
  mainboard: "main",
  "main board": "main",
  "main deck": "main",
  maindeck: "main",
  deck: "main",
  baralho: "main",
  principal: "main",
  maybeboard: "maybe",
  maybe: "maybe",
  consider: "maybe",
  sideboard: "ignore",
  side: "ignore",
  about: "ignore",
  tokens: "ignore",
  token: "ignore"
};

/**
 * Aceita formatos comuns: Moxfield, Archidekt, MTGO, Arena-like.
 */
export function parseDeckList(raw: string): ParsedDeckLine[] {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  let section: ParsedDeckLine["section"] = "main";
  const parsed: ParsedDeckLine[] = [];

  for (const original of lines) {
    const line = original.trim();
    if (!line) continue;

    const headerSection = readSectionHeader(line);
    if (headerSection) {
      section = headerSection;
      continue;
    }

    if (/^(https?:\/\/|\$|total|avg|deck\s*price|owned)/i.test(line)) continue;

    const match = line.match(/^(?:(\d+)\s*x\s+|(\d+)x\s*|(\d+)\s+)?(.+?)\s*$/i);
    if (!match?.[4]) continue;

    const extracted = extractCardIdentity(match[4]);
    if (!extracted.name || extracted.name.length < 2 || /^\d/.test(extracted.name)) continue;

    const quantity = Math.max(1, Number(match[1] || match[2] || match[3] || "1") || 1);

    parsed.push({
      quantity,
      name: extracted.name,
      setCode: extracted.setCode,
      collectorNumber: extracted.collectorNumber,
      section: section === "ignore" ? "ignore" : section
    });
  }

  return parsed.filter((line) => line.section !== "ignore");
}

function readSectionHeader(line: string): ParsedDeckLine["section"] | null {
  const cleaned = line
    .replace(/^\/\/\s*|^#\s*/i, "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/:\s*$/g, "")
    .trim()
    .toLowerCase();

  return SECTION_MAP[cleaned] ?? null;
}

/**
 * Remove set/collector/foil/preço e devolve nome limpo para o Scryfall.
 * Cobre Moxfield `(CMM) 698` e Archidekt `(Commander Masters) 698`.
 */
export function extractCardIdentity(raw: string) {
  let value = raw
    .replace(/\s+\/\s+/g, " // ")
    .replace(/\s{2,}/g, " ")
    .trim();

  value = value.replace(/\s+\*[A-Za-z]+\*/g, "").trim();
  value = value.replace(/\s+(?:R\$\s*)?\d+[.,]\d{2}$/g, "").trim();
  value = value.replace(/\s+#\d+$/g, "").trim();

  let setCode: string | undefined;
  let collectorNumber: string | undefined;

  const bracket = value.match(/\s+\[([A-Za-z0-9]+)\](?:\s+([A-Za-z0-9★☆✦\/-]+))?$/);
  if (bracket) {
    setCode = bracket[1].toUpperCase();
    collectorNumber = bracket[2];
    value = value.slice(0, bracket.index).trim();
  }

  // Archidekt / exports longos: (Commander Masters) 698
  const fullSetWithCollector = value.match(/\s+\(([^)]+)\)\s+([A-Za-z0-9★☆✦\/-]{1,12})$/);
  if (fullSetWithCollector) {
    const inside = fullSetWithCollector[1].trim();
    if (/^[A-Za-z0-9]{2,5}$/.test(inside)) {
      setCode = inside.toUpperCase();
    }
    collectorNumber = fullSetWithCollector[2];
    value = value.slice(0, fullSetWithCollector.index).trim();
  } else {
    // Moxfield curto: (CMM) ou (CMM) 698 já coberto; (CMM) sozinho
    const shortSet = value.match(/\s+\(([A-Za-z0-9]{2,5})\)$/);
    if (shortSet) {
      setCode = shortSet[1].toUpperCase();
      value = value.slice(0, shortSet.index).trim();
    }
  }

  return {
    name: value.trim(),
    setCode,
    collectorNumber
  };
}

export function collapseDeckLines(lines: ParsedDeckLine[]) {
  const map = new Map<string, ParsedDeckLine>();

  for (const line of lines) {
    if (line.section === "maybe") continue;
    const key = `${line.section}::${line.name.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      map.set(key, { ...line });
    }
  }

  return [...map.values()];
}
