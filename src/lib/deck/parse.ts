import type { ParsedDeckLine } from "./types";

const SECTION_MAP: Record<string, ParsedDeckLine["section"]> = {
  commander: "commander",
  commanders: "commander",
  "commander partners": "commander",
  partner: "commander",
  partners: "commander",
  main: "main",
  mainboard: "main",
  deck: "main",
  maybeboard: "maybe",
  maybe: "maybe",
  sideboard: "ignore",
  side: "ignore",
  consider: "maybe"
};

/**
 * Aceita formatos comuns: Moxfield, Archidekt, MTGO, Arena-like.
 * Exemplos:
 * 1 Sol Ring
 * 1 Sol Ring (CMM) 698
 * Sol Ring
 * // Commander
 * 1 Atraxa, Praetors' Voice
 */
export function parseDeckList(raw: string): ParsedDeckLine[] {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  let section: ParsedDeckLine["section"] = "main";
  const parsed: ParsedDeckLine[] = [];

  for (const original of lines) {
    const line = original.trim();
    if (!line) continue;

    if (line.startsWith("//") || line.startsWith("#")) {
      const label = line.replace(/^\/\/\s*|^#\s*/, "").trim().toLowerCase();
      section = SECTION_MAP[label] ?? section;
      continue;
    }

    if (/^(about|tokens|token)\b/i.test(line)) continue;

    const match = line.match(
      /^(?:(\d+)\s*x\s+|(\d+)x\s*|(\d+)\s+)?(.+?)(?:\s+\(([A-Za-z0-9]+)\)(?:\s+([A-Za-z0-9★☆✦]+))?)?(?:\s+\*\w+\*)?\s*$/i
    );

    if (!match?.[4]) continue;

    const name = cleanCardName(match[4]);
    if (!name || name.length < 2 || /^\d/.test(name)) continue;

    const quantity = Math.max(
      1,
      Number(match[1] || match[2] || match[3] || "1") || 1
    );

    parsed.push({
      quantity,
      name,
      setCode: match[5]?.toUpperCase(),
      collectorNumber: match[6],
      section: section === "ignore" ? "ignore" : section
    });
  }

  return parsed.filter((line) => line.section !== "ignore");
}

function cleanCardName(value: string) {
  return value
    .replace(/\s+\/\s+/g, " // ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+#\d+$/g, "")
    .trim();
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
