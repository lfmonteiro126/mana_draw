import { NextResponse } from "next/server";
import { quoteShipping } from "@/lib/shipping";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      postalCode?: string;
      itemCount?: number;
      insuranceCents?: number;
    };

    const postalCode = String(body.postalCode ?? "");
    const itemCount = Number(body.itemCount ?? 1);
    const insuranceCents = Number(body.insuranceCents ?? 0);

    if (!Number.isFinite(itemCount) || itemCount < 1) {
      return NextResponse.json({ ok: false, message: "Carrinho inválido." }, { status: 400 });
    }

    const quotes = await quoteShipping({
      postalCode,
      itemCount: Math.floor(itemCount),
      insuranceCents: Number.isFinite(insuranceCents) ? Math.max(0, Math.floor(insuranceCents)) : 0
    });

    return NextResponse.json({ ok: true, quotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cotar o frete.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
