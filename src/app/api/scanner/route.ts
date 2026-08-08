import { NextResponse } from "next/server";
import { searchScryfallByFuzzy, searchScryfallByWildcard } from "@/lib/scanner/scryfall";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("q") || "";

  if (!query || query.trim().length < 2) {
    return NextResponse.json(
      { ok: false, message: "Query muito curta.", card: null },
      { status: 400 }
    );
  }

  try {
    const card = await searchScryfallByFuzzy(query);

    if (!card) {
      return NextResponse.json({
        ok: false,
        message: `Nenhuma carta de Magic encontrada para "${query}".`,
        card: null
      });
    }

    return NextResponse.json({
      ok: true,
      card
    });
  } catch (error) {
    console.error("API /api/scanner erro:", error);
    return NextResponse.json(
      { ok: false, message: "Falha ao processar reconhecimento.", card: null },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = (body.query || body.text || "").trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { ok: false, message: "Texto da carta não informado ou muito curto.", card: null },
        { status: 400 }
      );
    }

    let card = await searchScryfallByFuzzy(query);
    if (!card && body.fallback) {
      card = await searchScryfallByWildcard(query);
    }

    if (!card) {
      return NextResponse.json({
        ok: false,
        message: `Carta MTG não identificada para "${query}".`,
        card: null
      });
    }

    return NextResponse.json({
      ok: true,
      card
    });
  } catch (error) {
    console.error("API POST /api/scanner erro:", error);
    return NextResponse.json(
      { ok: false, message: "Erro interno no scanner.", card: null },
      { status: 500 }
    );
  }
}
