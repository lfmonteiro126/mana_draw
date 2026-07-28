import { NextResponse } from "next/server";
import { quoteShipping } from "@/lib/shipping";

const MAX_ITEM_COUNT = 200;
const MAX_INSURANCE_CENTS = 5_000_000; // R$ 50.000

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

    if (!Number.isFinite(itemCount) || itemCount < 1 || itemCount > MAX_ITEM_COUNT) {
      return NextResponse.json({ ok: false, message: "Carrinho inválido." }, { status: 400 });
    }

    if (!Number.isFinite(insuranceCents) || insuranceCents < 0 || insuranceCents > MAX_INSURANCE_CENTS) {
      return NextResponse.json({ ok: false, message: "Valor de seguro inválido." }, { status: 400 });
    }

    const quotes = await quoteShipping({
      postalCode,
      itemCount: Math.floor(itemCount),
      insuranceCents: Math.floor(insuranceCents)
    });

    return NextResponse.json({ ok: true, quotes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cotar o frete.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
