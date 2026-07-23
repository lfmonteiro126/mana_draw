import { NextResponse } from "next/server";
import { analyzeCommanderDeck } from "@/lib/deck";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      list?: string;
      commanderName?: string;
    };

    const list = body.list?.trim() ?? "";
    if (list.length < 20) {
      return NextResponse.json(
        { ok: false, message: "Cole uma decklist com pelo menos algumas cartas." },
        { status: 400 }
      );
    }

    if (list.length > 40_000) {
      return NextResponse.json(
        { ok: false, message: "Decklist grande demais. Cole só o maindeck + commander." },
        { status: 400 }
      );
    }

    const analysis = await analyzeCommanderDeck({
      list,
      commanderName: body.commanderName?.trim() || undefined
    });

    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao analisar o deck.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
