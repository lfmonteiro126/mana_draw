import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { importResolvedCards, type ResolvedImportRow } from "@/lib/manabox";

export async function POST(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { rows?: ResolvedImportRow[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const importable = rows.filter((row) => row?.status === "ok" && row.externalId && row.imageUrl);

    if (importable.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Nenhuma carta válida para importar. Faça a pré-visualização antes." },
        { status: 400 }
      );
    }

    if (importable.length > 500) {
      return NextResponse.json(
        { ok: false, message: "Limite de 500 cartas por importação." },
        { status: 400 }
      );
    }

    const summary = await importResolvedCards(importable);
    revalidatePath("/");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      summary,
      message: `Importação concluída: ${summary.created} novas, ${summary.updated} atualizadas.`
    });
  } catch (error) {
    console.error("bulk-import failed", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha ao importar." },
      { status: 500 }
    );
  }
}
