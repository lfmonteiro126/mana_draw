import { ARCHETYPE_RULES, GAME_CHANGERS, detectRoles } from "./lists";
import { collapseDeckLines, parseDeckList } from "./parse";
import {
  cardImageUrl,
  cardOracleText,
  cardTypeLine,
  fetchScryfallCollection,
  normalizeName
} from "./scryfall";
import type {
  AnalyzedCard,
  ArchetypeScore,
  BracketAssessment,
  CommanderBracket,
  DeckAnalysis,
  DeckRole,
  DeckStrength,
  DeckSuggestion,
  ManaCurveBin,
  RoleBreakdown,
  ScryfallCardData
} from "./types";

const ROLE_LABELS: Record<DeckRole, string> = {
  land: "Terrenos",
  creature: "Criaturas",
  artifact: "Artefatos",
  enchantment: "Encantamentos",
  planeswalker: "Planeswalkers",
  instant: "Instantâneos",
  sorcery: "Feitiços",
  battle: "Batalhas",
  ramp: "Ramp / mana",
  draw: "Draw / card advantage",
  removal: "Remoção pontual",
  boardWipe: "Board wipes",
  counterspell: "Counterspells",
  tutor: "Tutors",
  gameChanger: "Game Changers",
  fastMana: "Fast mana",
  extraTurn: "Extra turns",
  landDenial: "Land denial",
  protection: "Proteção",
  tokenMaker: "Geradores de token",
  sacrifice: "Sacrifício / drains"
};

const BRACKET_LABELS: Record<CommanderBracket, string> = {
  1: "Bracket 1 · Exhibition",
  2: "Bracket 2 · Core",
  3: "Bracket 3 · Upgraded",
  4: "Bracket 4 · Optimized",
  5: "Bracket 5 · cEDH"
};

export async function analyzeCommanderDeck(input: {
  list: string;
  commanderName?: string;
}): Promise<DeckAnalysis> {
  const collapsed = collapseDeckLines(parseDeckList(input.list));
  if (collapsed.length === 0) {
    throw new Error("Cole uma decklist válida (uma carta por linha).");
  }

  const { found, unresolved } = await fetchScryfallCollection(collapsed.map((line) => line.name));

  const analyzed: AnalyzedCard[] = [];
  const duplicates: string[] = [];
  const seenMain = new Map<string, number>();

  for (const line of collapsed) {
    const card = found.get(normalizeName(line.name));
    if (!card) continue;

    const key = normalizeName(card.name);
    if (line.section === "main") {
      const previous = seenMain.get(key) ?? 0;
      if (previous > 0 && !isBasicLand(card)) {
        duplicates.push(card.name);
      }
      seenMain.set(key, previous + line.quantity);
    }

    analyzed.push(toAnalyzedCard(card, line.quantity, line.section === "commander" ? "commander" : "main"));
  }

  let commanders = analyzed.filter((card) => card.section === "commander");
  if (commanders.length === 0 && input.commanderName) {
    const named = analyzed.find(
      (card) => normalizeName(card.name) === normalizeName(input.commanderName!)
    );
    if (named) {
      named.section = "commander";
      commanders = [named];
    }
  }

  if (commanders.length === 0) {
    const legendary = analyzed.filter(
      (card) =>
        /legendary/i.test(card.typeLine) &&
        /creature|planeswalker/i.test(card.typeLine)
    );
    if (legendary.length === 1) {
      legendary[0].section = "commander";
      commanders = legendary;
    }
  }

  const commander = commanders[0] ?? null;
  const partners = commanders.slice(1);
  const colorIdentity = uniqueColors([
    ...(commander?.colorIdentity ?? []),
    ...partners.flatMap((card) => card.colorIdentity)
  ]);

  const maindeck = analyzed.filter((card) => card.section === "main");
  const maindeckCount = maindeck.reduce((sum, card) => sum + card.quantity, 0);
  const expectedMaindeck: 99 | 98 = partners.length > 0 ? 98 : 99;
  const totalCards =
    maindeckCount + (commander ? 1 : 0) + partners.reduce((sum, card) => sum + card.quantity, 0);

  const illegals = analyzed
    .filter((card) => !card.legal)
    .map((card) => card.name);

  const colorIdentityViolations =
    colorIdentity.length > 0
      ? maindeck
          .filter((card) => card.colorIdentity.some((color) => !colorIdentity.includes(color)))
          .map((card) => card.name)
      : [];

  const nonLand = maindeck.filter((card) => !card.roles.includes("land"));
  const manaCurve = buildManaCurve(nonLand);
  const averageCmc =
    nonLand.length === 0
      ? 0
      : round(
          nonLand.reduce((sum, card) => sum + card.cmc * card.quantity, 0) /
            nonLand.reduce((sum, card) => sum + card.quantity, 0)
        );

  const landCount = countRole(maindeck, "land");
  const roles = buildRoleBreakdown(maindeck);
  const archetypes = scoreArchetypes([...maindeck, ...commanders]);
  const bracket = assessBracket(maindeck, commanders);
  const strengths = findStrengths({
    maindeck,
    commanders,
    archetypes,
    averageCmc,
    landCount,
    roles
  });
  const suggestions = buildSuggestions({
    maindeck,
    maindeckCount,
    expectedMaindeck,
    landCount,
    averageCmc,
    roles,
    bracket,
    colorIdentityViolations,
    illegals,
    duplicates,
    unresolved,
    commander
  });
  const synergyNotes = buildSynergyNotes(archetypes, commanders, maindeck);

  return {
    commander,
    partners,
    cards: analyzed,
    colorIdentity,
    totalCards,
    maindeckCount,
    expectedMaindeck,
    manaCurve,
    averageCmc,
    landCount,
    roles,
    archetypes,
    bracket,
    strengths,
    suggestions,
    synergyNotes,
    unresolvedNames: unresolved,
    illegals,
    colorIdentityViolations: [...new Set(colorIdentityViolations)],
    duplicates: [...new Set(duplicates)],
    analyzedAt: new Date().toISOString()
  };
}

function toAnalyzedCard(
  card: ScryfallCardData,
  quantity: number,
  section: "commander" | "main"
): AnalyzedCard {
  const oracleText = cardOracleText(card);
  const typeLine = cardTypeLine(card);
  const roles = detectRoles(oracleText, typeLine, card.name);

  return {
    name: card.name,
    quantity,
    section,
    cmc: card.cmc ?? 0,
    typeLine,
    oracleText,
    colorIdentity: card.color_identity ?? [],
    imageUrl: cardImageUrl(card),
    legal: (card.legalities?.commander ?? "legal") === "legal",
    roles,
    isGameChanger: GAME_CHANGERS.has(card.name.toLowerCase()),
    isFastMana: roles.includes("fastMana")
  };
}

function buildManaCurve(cards: AnalyzedCard[]): ManaCurveBin[] {
  const bins = [
    { label: "0", cmc: 0 },
    { label: "1", cmc: 1 },
    { label: "2", cmc: 2 },
    { label: "3", cmc: 3 },
    { label: "4", cmc: 4 },
    { label: "5", cmc: 5 },
    { label: "6", cmc: 6 },
    { label: "7+", cmc: 7 }
  ];

  return bins.map((bin) => ({
    ...bin,
    count: cards.reduce((sum, card) => {
      const bucket = card.cmc >= 7 ? 7 : Math.floor(card.cmc);
      return sum + (bucket === bin.cmc ? card.quantity : 0);
    }, 0)
  }));
}

function buildRoleBreakdown(cards: AnalyzedCard[]): RoleBreakdown[] {
  const interesting: DeckRole[] = [
    "ramp",
    "draw",
    "removal",
    "boardWipe",
    "counterspell",
    "tutor",
    "gameChanger",
    "fastMana",
    "extraTurn",
    "landDenial",
    "protection",
    "tokenMaker",
    "sacrifice",
    "creature",
    "land"
  ];

  return interesting
    .map((role) => {
      const matches = cards.filter((card) => card.roles.includes(role));
      return {
        role,
        label: ROLE_LABELS[role],
        count: matches.reduce((sum, card) => sum + card.quantity, 0),
        cards: matches.map((card) => card.name).slice(0, 8)
      };
    })
    .filter((entry) => entry.count > 0);
}

function scoreArchetypes(cards: AnalyzedCard[]): ArchetypeScore[] {
  const scores = new Map<string, ArchetypeScore>();

  for (const rule of ARCHETYPE_RULES) {
    const evidence: string[] = [];
    let score = 0;
    for (const card of cards) {
      if (rule.test(card.oracleText, card.typeLine, card.name)) {
        score += rule.weight * card.quantity;
        if (evidence.length < 6) evidence.push(card.name);
      }
    }
    if (score > 0) {
      scores.set(rule.id, {
        id: rule.id,
        label: rule.label,
        score: round(score),
        evidence
      });
    }
  }

  const ranked = [...scores.values()].sort((a, b) => b.score - a.score);
  if (ranked.length === 0) {
    return [
      {
        id: "midrange",
        label: "Midrange / Goodstuff",
        score: 1,
        evidence: []
      }
    ];
  }

  if (ranked[0].score < 4) {
    ranked.push({
      id: "midrange",
      label: "Midrange / Goodstuff",
      score: 3,
      evidence: []
    });
  }

  return ranked.slice(0, 4);
}

function assessBracket(maindeck: AnalyzedCard[], commanders: AnalyzedCard[]): BracketAssessment {
  const pool = [...maindeck, ...commanders];
  const gameChangers = pool.filter((card) => card.isGameChanger);
  const tutors = countRole(pool, "tutor");
  const fastMana = countRole(pool, "fastMana");
  const extraTurns = countRole(pool, "extraTurn");
  const landDenial = countRole(pool, "landDenial");
  const comboSignals = pool.filter((card) =>
    /thassa's oracle|demonic consultation|underworld breach|ad nauseam|isochron|dramatic reversal|bolas's citadel/i.test(
      card.name + " " + card.oracleText
    )
  ).length;

  const signals: string[] = [];
  if (gameChangers.length) {
    signals.push(`${gameChangers.length} Game Changer(s): ${gameChangers.map((c) => c.name).slice(0, 5).join(", ")}`);
  } else {
    signals.push("Nenhum Game Changer detectado na lista atual");
  }
  signals.push(`${tutors} tutor(es)`);
  signals.push(`${fastMana} peça(s) de fast mana`);
  if (extraTurns) signals.push(`${extraTurns} efeito(s) de extra turn`);
  if (landDenial) signals.push(`${landDenial} efeito(s) de land denial`);
  if (comboSignals) signals.push(`${comboSignals} sinal(is) de combo clássico`);

  let bracket: CommanderBracket = 2;
  let confidence: BracketAssessment["confidence"] = "media";

  if (
    gameChangers.length >= 5 ||
    (gameChangers.length >= 3 && tutors >= 4 && fastMana >= 3) ||
    (comboSignals >= 2 && tutors >= 3 && fastMana >= 2)
  ) {
    bracket = 5;
  } else if (
    gameChangers.length >= 3 ||
    (gameChangers.length >= 2 && tutors >= 3) ||
    (fastMana >= 3 && tutors >= 3) ||
    extraTurns >= 2
  ) {
    bracket = 4;
  } else if (
    gameChangers.length >= 1 ||
    tutors >= 2 ||
    fastMana >= 2 ||
    landDenial >= 1 ||
    comboSignals >= 1
  ) {
    bracket = 3;
  } else if (tutors === 0 && fastMana === 0 && gameChangers.length === 0) {
    bracket = maindeck.length < 40 ? 1 : 2;
    if (averageNonLandCmc(maindeck) >= 4.2) bracket = 1;
  } else {
    bracket = 2;
  }

  // Exhibition: listas bem casuais
  if (
    bracket <= 2 &&
    gameChangers.length === 0 &&
    tutors === 0 &&
    fastMana === 0 &&
    landDenial === 0 &&
    averageNonLandCmc(maindeck) >= 3.8
  ) {
    bracket = 1;
    confidence = "media";
  }

  if (gameChangers.length + tutors + fastMana >= 8) confidence = "alta";
  if (pool.length < 50) confidence = "baixa";

  return {
    bracket,
    label: BRACKET_LABELS[bracket],
    confidence,
    summary: bracketSummary(bracket),
    signals
  };
}

function findStrengths(input: {
  maindeck: AnalyzedCard[];
  commanders: AnalyzedCard[];
  archetypes: ArchetypeScore[];
  averageCmc: number;
  landCount: number;
  roles: RoleBreakdown[];
}): DeckStrength[] {
  const strengths: DeckStrength[] = [];
  const ramp = countRole(input.maindeck, "ramp");
  const draw = countRole(input.maindeck, "draw");
  const removal = countRole(input.maindeck, "removal");
  const top = input.archetypes[0];

  if (input.commanders[0]) {
    strengths.push({
      title: `Comandante claro: ${input.commanders[0].name}`,
      detail: "A identidade de cor e o plano do deck partem de um comandante bem definido."
    });
  }

  if (top && top.score >= 5) {
    strengths.push({
      title: `Direção de arquétipo: ${top.label}`,
      detail: `Sinais consistentes em cartas como ${top.evidence.slice(0, 3).join(", ") || "várias peças temáticas"}.`
    });
  }

  if (ramp >= 10) {
    strengths.push({
      title: "Base de mana sólida",
      detail: `${ramp} fontes de ramp/mana rocks ajudam a desenvolver o plano com consistência.`
    });
  }

  if (draw >= 8) {
    strengths.push({
      title: "Bom card advantage",
      detail: `${draw} efeitos de draw/seleção reduzem a chance de ficar sem gás.`
    });
  }

  if (removal + countRole(input.maindeck, "boardWipe") >= 8) {
    strengths.push({
      title: "Interação presente",
      detail: "O deck consegue responder ameaças pontuais e/ou resetar a mesa."
    });
  }

  if (input.averageCmc > 0 && input.averageCmc <= 3.2) {
    strengths.push({
      title: "Curva relativamente baixa",
      detail: `CMC médio de ${input.averageCmc} favorece jogos mais fluidos e menos “mão emperrada”.`
    });
  }

  if (input.landCount >= 35 && input.landCount <= 40) {
    strengths.push({
      title: "Contagem de terrenos saudável",
      detail: `${input.landCount} terrenos — faixa comum para a maioria dos decks Commander.`
    });
  }

  return strengths.slice(0, 5);
}

function buildSuggestions(input: {
  maindeck: AnalyzedCard[];
  maindeckCount: number;
  expectedMaindeck: number;
  landCount: number;
  averageCmc: number;
  roles: RoleBreakdown[];
  bracket: BracketAssessment;
  colorIdentityViolations: string[];
  illegals: string[];
  duplicates: string[];
  unresolved: string[];
  commander: AnalyzedCard | null;
}): DeckSuggestion[] {
  const suggestions: DeckSuggestion[] = [];
  const ramp = countRole(input.maindeck, "ramp");
  const draw = countRole(input.maindeck, "draw");
  const removal = countRole(input.maindeck, "removal");
  const wipes = countRole(input.maindeck, "boardWipe");
  const protection = countRole(input.maindeck, "protection");

  if (!input.commander) {
    suggestions.push({
      severity: "critical",
      title: "Comandante não identificado",
      detail:
        "Marque a seção // Commander na lista ou informe o comandante. Sem isso, bracket e identidade de cor ficam menos precisos."
    });
  }

  if (input.maindeckCount !== input.expectedMaindeck) {
    suggestions.push({
      severity: "warn",
      title: `Maindeck com ${input.maindeckCount} cartas (esperado ${input.expectedMaindeck})`,
      detail:
        "Commander singleton usa 100 cartas no total (1–2 comandantes + 98–99 no main). Ajuste a contagem antes de otimizar."
    });
  }

  if (input.illegals.length) {
    suggestions.push({
      severity: "critical",
      title: "Cartas ilegais em Commander",
      detail: "Remova ou troque as cartas banidas/ilegais.",
      relatedCards: input.illegals.slice(0, 8)
    });
  }

  if (input.colorIdentityViolations.length) {
    suggestions.push({
      severity: "critical",
      title: "Quebra de color identity",
      detail: "Há cartas fora da identidade de cor do(s) comandante(s).",
      relatedCards: input.colorIdentityViolations.slice(0, 8)
    });
  }

  if (input.duplicates.length) {
    suggestions.push({
      severity: "warn",
      title: "Possíveis duplicatas (singleton)",
      detail: "Commander permite apenas 1 cópia (exceto basics).",
      relatedCards: input.duplicates.slice(0, 8)
    });
  }

  if (input.unresolved.length) {
    suggestions.push({
      severity: "warn",
      title: "Nomes não resolvidos no Scryfall",
      detail: "Confira ortografia ou use o nome em inglês da carta.",
      relatedCards: input.unresolved.slice(0, 10)
    });
  }

  if (input.landCount < 34) {
    suggestions.push({
      severity: "warn",
      title: "Poucos terrenos",
      detail: `Detectamos ${input.landCount} lands. Para a maioria dos decks, 36–38 é um ponto de partida mais seguro (ajuste conforme ramp).`
    });
  } else if (input.landCount > 42) {
    suggestions.push({
      severity: "info",
      title: "Muitos terrenos",
      detail: `${input.landCount} lands podem deixar o deck lento se não houver payoff de landfall/maneuver de topdeck.`
    });
  }

  if (ramp < 8) {
    suggestions.push({
      severity: "warn",
      title: "Ramp abaixo do ideal",
      detail: `Só ${ramp} fontes de ramp. Considere rocks baratas (Signets, Talismans) ou ramp verde se a identidade permitir.`
    });
  }

  if (draw < 6) {
    suggestions.push({
      severity: "warn",
      title: "Pouco card draw",
      detail: `Com ${draw} efeitos de draw, o deck pode “engasgar” após os primeiros turnos. Busque draw recorrente alinhado ao arquétipo.`
    });
  }

  if (removal < 5) {
    suggestions.push({
      severity: "warn",
      title: "Pouca remoção pontual",
      detail: "Adicione respostas baratas a ameaças (exile/destroy/bounce) para não depender só do plano ofensivo."
    });
  }

  if (wipes < 1 && input.bracket.bracket <= 3) {
    suggestions.push({
      severity: "info",
      title: "Sem board wipe claro",
      detail: "Em mesas casuais/upgraded, 1–3 wipes ajudam a recuperar jogos perdidos."
    });
  }

  if (input.averageCmc >= 3.8) {
    suggestions.push({
      severity: "info",
      title: "Curva alta",
      detail: `CMC médio ${input.averageCmc}. Corte top-end fraco ou aumente ramp/fast mana coerente com o bracket desejado.`
    });
  }

  if (protection < 2 && input.commander) {
    suggestions.push({
      severity: "info",
      title: "Proteja o comandante",
      detail: `Pouca proteção detectada. Itens/hexproof/indestructible ou counters defensivos ajudam ${input.commander.name} a ficar na mesa.`
    });
  }

  if (input.bracket.bracket >= 4) {
    suggestions.push({
      severity: "info",
      title: "Alinhe expectativas de mesa",
      detail:
        "Sinais de Optimized/cEDH. Avise a mesa o bracket — ou remova Game Changers/fast mana se quiser descer para Bracket 2–3."
    });
  } else if (input.bracket.bracket <= 2 && countRole(input.maindeck, "tutor") === 0) {
    suggestions.push({
      severity: "info",
      title: "Espaço para upgrades temáticos",
      detail:
        "Sem estourar o bracket, melhore sinergia do arquétipo principal e consistência (draw/ramp) antes de adicionar Game Changers."
    });
  }

  return suggestions.slice(0, 10);
}

function buildSynergyNotes(
  archetypes: ArchetypeScore[],
  commanders: AnalyzedCard[],
  maindeck: AnalyzedCard[]
) {
  const notes: string[] = [];
  const top = archetypes.slice(0, 2);

  if (commanders[0] && top[0]) {
    notes.push(
      `${commanders[0].name} combina bem com um plano ${top[0].label.toLowerCase()} — priorize peças que acelerem esse eixo em vez de goodstuff genérico.`
    );
  }

  for (const archetype of top) {
    if (archetype.evidence.length) {
      notes.push(
        `${archetype.label}: núcleo atual em ${archetype.evidence.slice(0, 4).join(", ")}. Complete o pacote (payoffs + enablers) antes de diluir com staples off-theme.`
      );
    }
  }

  const ramp = countRole(maindeck, "ramp");
  const draw = countRole(maindeck, "draw");
  if (ramp >= 10 && draw < 6) {
    notes.push(
      "Você acelera bem, mas compra pouco: o gargalo tende a ser card advantage, não mana."
    );
  }
  if (draw >= 10 && ramp < 8) {
    notes.push(
      "Há draw suficiente, porém a mana pode atrasar o plano. Balanceie com ramp na curva 1–3."
    );
  }

  return notes.slice(0, 5);
}

function bracketSummary(bracket: CommanderBracket) {
  switch (bracket) {
    case 1:
      return "Mesa exhibition/casual: pouca eficiência, foco em tema e experiência social.";
    case 2:
      return "Core casual: staples leves, pouca ou nenhuma pressão de Game Changers.";
    case 3:
      return "Upgraded: mais tutors/eficiência e eventualmente alguns Game Changers.";
    case 4:
      return "Optimized: pacote forte, fast mana e Game Changers esperados.";
    case 5:
      return "cEDH: máxima eficiência, combo e interação densa — alinhe com a mesa.";
  }
}

function countRole(cards: AnalyzedCard[], role: DeckRole) {
  return cards.reduce((sum, card) => sum + (card.roles.includes(role) ? card.quantity : 0), 0);
}

function averageNonLandCmc(cards: AnalyzedCard[]) {
  const nonLand = cards.filter((card) => !card.roles.includes("land"));
  if (!nonLand.length) return 0;
  return (
    nonLand.reduce((sum, card) => sum + card.cmc * card.quantity, 0) /
    nonLand.reduce((sum, card) => sum + card.quantity, 0)
  );
}

function isBasicLand(card: ScryfallCardData) {
  return /^Basic Land/i.test(card.type_line ?? "");
}

function uniqueColors(colors: string[]) {
  return [...new Set(colors)];
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
