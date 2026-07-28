import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  MANABOX_MAX_ROWS,
  parseManaBoxInput,
  resolveManaBoxRows,
  type BulkPriceMode
} from "@/lib/manabox";
import type { CardCondition, TcgCard } from "@/lib/types";

const validConditions: CardCondition[] = ["NM", "SP", "MP", "HP"];
const validLanguages: TcgCard["language"][] = ["PT", "EN", "JP"];
const validPriceModes: BulkPriceMode[] = ["zero", "purchase_brl", "fixed"];

export async function POST(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      content?: string;
      defaultCondition?: string;
      defaultLanguage?: string;
      priceMode?: string;
      fixedPrice?: string | number;
    };

    const content = String(body.content ?? "");
    if (!content.trim()) {
      return NextResponse.json({ ok: false, message: "Cole ou envie um arquivo TXT/CSV." }, { status: 400 });
    }

    const parsed = parseManaBoxInput(content);
    if (parsed.rows.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "Nenhuma carta reconhecida no arquivo.",
        warnings: parsed.warnings,
        format: parsed.format
      }, { status: 400 });
    }

    const defaultCondition = validConditions.includes(body.defaultCondition as CardCondition)
      ? (body.defaultCondition as CardCondition)
      : "NM";
    const defaultLanguage = validLanguages.includes(body.defaultLanguage as TcgCard["language"])
      ? (body.defaultLanguage as TcgCard["language"])
      : "EN";
    const priceMode = validPriceModes.includes(body.priceMode as BulkPriceMode)
      ? (body.priceMode as BulkPriceMode)
      : "zero";
    const fixedPriceCents = Math.max(0, Math.round(Number(body.fixedPrice ?? 0) * 100) || 0);

    const resolved = await resolveManaBoxRows(parsed.rows.slice(0, MANABOX_MAX_ROWS), {
      defaultCondition,
      defaultLanguage,
      priceMode,
      fixedPriceCents
    });

    const okCount = resolved.filter((row) => row.status === "ok").length;
    const errorCount = resolved.length - okCount;

    return NextResponse.json({
      ok: true,
      format: parsed.format,
      warnings: parsed.warnings,
      rows: resolved,
      summary: {
        total: resolved.length,
        ok: okCount,
        errors: errorCount,
        quantity: resolved.reduce((sum, row) => sum + (row.status === "ok" ? row.quantity : 0), 0)
      }
    });
  } catch (error) {
    console.error("bulk-preview failed", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha ao pré-visualizar." },
      { status: 500 }
    );
  }
}
