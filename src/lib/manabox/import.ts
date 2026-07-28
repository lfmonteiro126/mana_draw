import { getSql, hasDatabase } from "@/lib/db";
import type { ResolvedImportRow } from "@/lib/manabox/resolve";

export type BulkImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; name: string; message: string }>;
};

export async function importResolvedCards(rows: ResolvedImportRow[]): Promise<BulkImportSummary> {
  const summary: BulkImportSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  if (!hasDatabase()) {
    throw new Error("Banco indisponível. Configure DATABASE_URL para importar.");
  }

  const sql = getSql();
  if (!sql) throw new Error("Banco indisponível.");

  const okRows = rows.filter((row) => row.status === "ok");
  summary.skipped = rows.length - okRows.length;

  for (const row of okRows) {
    try {
      const existing = await sql`
        select id
        from cards
        where game = 'Magic'
          and active = true
          and lower(name) = lower(${row.name})
          and lower(set_name) = lower(${row.setName})
          and lower(rarity) = lower(${row.rarity})
          and condition = ${row.condition}
          and language = ${row.language}
          and finish = ${row.finish}
          and image_url = ${row.imageUrl}
        limit 1
      `;

      if (existing.length > 0) {
        try {
          await sql`
            update cards
            set
              stock = stock + ${row.quantity},
              price_cents = case
                when ${row.priceCents} > 0 then ${row.priceCents}
                else price_cents
              end,
              market_price_cents = ${row.marketPriceCents},
              back_image_url = ${row.backImageUrl || null},
              is_double_sided = ${row.isDoubleSided},
              layout = ${row.layout || null},
              tags = ${row.tags},
              active = true,
              updated_at = now()
            where id = ${(existing[0] as { id: string }).id}
          `;
        } catch (error) {
          if (!isMissingDoubleSideColumns(error)) throw error;
          await sql`
            update cards
            set
              stock = stock + ${row.quantity},
              price_cents = case
                when ${row.priceCents} > 0 then ${row.priceCents}
                else price_cents
              end,
              market_price_cents = ${row.marketPriceCents},
              tags = ${row.tags},
              active = true,
              updated_at = now()
            where id = ${(existing[0] as { id: string }).id}
          `;
        }
        summary.updated += 1;
        continue;
      }

      try {
        await sql`
          insert into cards (
            name,
            game,
            set_name,
            rarity,
            condition,
            language,
            price_cents,
            market_price_cents,
            stock,
            image_url,
            back_image_url,
            is_double_sided,
            layout,
            tags,
            finish,
            featured
          )
          values (
            ${row.name},
            'Magic',
            ${row.setName},
            ${row.rarity},
            ${row.condition},
            ${row.language},
            ${row.priceCents},
            ${row.marketPriceCents},
            ${row.quantity},
            ${row.imageUrl},
            ${row.backImageUrl || null},
            ${row.isDoubleSided},
            ${row.layout || null},
            ${row.tags},
            ${row.finish},
            false
          )
        `;
      } catch (error) {
        if (!isMissingDoubleSideColumns(error)) throw error;
        await sql`
          insert into cards (
            name,
            game,
            set_name,
            rarity,
            condition,
            language,
            price_cents,
            market_price_cents,
            stock,
            image_url,
            tags,
            finish,
            featured
          )
          values (
            ${row.name},
            'Magic',
            ${row.setName},
            ${row.rarity},
            ${row.condition},
            ${row.language},
            ${row.priceCents},
            ${row.marketPriceCents},
            ${row.quantity},
            ${row.imageUrl},
            ${row.tags},
            ${row.finish},
            false
          )
        `;
      }
      summary.created += 1;
    } catch (error) {
      summary.errors.push({
        line: row.line,
        name: row.name,
        message: error instanceof Error ? error.message : "Falha ao gravar."
      });
    }
  }

  return summary;
}

function isMissingDoubleSideColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("back_image_url") ||
    message.includes("is_double_sided") ||
    message.includes("layout")
  );
}
