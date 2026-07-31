import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { searchSealedProducts } from "@/lib/sealed-lookup";
import type { Game } from "@/lib/types";

const validGames: Game[] = ["Magic", "Pokemon", "Yu-Gi-Oh!"];

export async function GET(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ suggestions: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const game = searchParams.get("game") as Game | null;
  const query = searchParams.get("query")?.trim() ?? "";

  if (!game || !validGames.includes(game) || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchSealedProducts(game, query);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
