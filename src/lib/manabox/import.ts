import { ensureExternalIdColumn, ensureSealedColumns, getSql, hasDatabase } from "@/lib/db";
import type { ResolvedImportRow } from "@/lib/manabox/resolve";

export type BulkImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ line: number; name: string; message: string }>;
};

type ExistingVariant = {
  id: string;
  external_id: string;
  condition: string;
  language: string;
  finish: string;
};

type MergedImportRow = ResolvedImportRow & { lines: number[] };

const WRITE_CONCURRENCY = 25;

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

  await ensureSealedColumns(sql);
  await ensureExternalIdColumn(sql);

  const okRows = rows.filter((row) => row.status === "ok" && row.externalId && row.imageUrl);
  summary.skipped = rows.length - okRows.length;

  const merged = mergeImportRows(okRows);
  if (merged.length === 0) return summary;

  const externalIds = [...new Set(merged.map((row) => row.externalId))];
  const existingRows = (await sql`
    select id, external_id, condition, language, finish
    from cards
    where game = 'Magic'
      and coalesce(product_kind, 'single') = 'single'
      and active = true
      and external_id = any(${externalIds})
  `) as ExistingVariant[];

  const existingByKey = new Map(
    existingRows.map((row) => [variantKey(row.external_id, row.condition, row.language, row.finish), row])
  );

  // Legacy cards without external_id: soft match once, then backfill id.
  const unmatched = merged.filter(
    (row) => !existingByKey.has(variantKey(row.externalId, row.condition, row.language, row.finish))
  );
  for (const chunk of chunkArray(unmatched, WRITE_CONCURRENCY)) {
    await Promise.all(chunk.map((row) => backfillLegacyMatch(sql, row, existingByKey)));
  }

  const toUpdate: Array<{ id: string; row: MergedImportRow }> = [];
  const toInsert: MergedImportRow[] = [];

  for (const row of merged) {
    const key = variantKey(row.externalId, row.condition, row.language, row.finish);
    const existing = existingByKey.get(key);
    if (existing) toUpdate.push({ id: existing.id, row });
    else toInsert.push(row);
  }

  for (const chunk of chunkArray(toUpdate, WRITE_CONCURRENCY)) {
    const results = await Promise.allSettled(chunk.map((item) => updateOne(sql, item.id, item.row)));
    results.forEach((result, index) => {
      const item = chunk[index];
      if (result.status === "fulfilled") {
        summary.updated += 1;
        return;
      }
      summary.errors.push({
        line: item.row.line,
        name: item.row.name,
        message: result.reason instanceof Error ? result.reason.message : "Falha ao atualizar."
      });
    });
  }

  for (const chunk of chunkArray(toInsert, WRITE_CONCURRENCY)) {
    const results = await Promise.allSettled(chunk.map((row) => insertOne(sql, row)));
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const row = chunk[index];
      if (result.status === "fulfilled") {
        summary.created += 1;
        continue;
      }

      try {
        const again = (await sql`
          select id
          from cards
          where game = 'Magic'
            and coalesce(product_kind, 'single') = 'single'
            and active = true
            and external_id = ${row.externalId}
            and condition = ${row.condition}
            and language = ${row.language}
            and finish = ${row.finish}
          limit 1
        `) as Array<{ id: string }>;
        if (again[0]) {
          await updateOne(sql, again[0].id, row);
          summary.updated += 1;
          continue;
        }
      } catch {
        // fall through
      }

      summary.errors.push({
        line: row.line,
        name: row.name,
        message: result.reason instanceof Error ? result.reason.message : "Falha ao gravar."
      });
    }
  }

  return summary;
}

function mergeImportRows(rows: ResolvedImportRow[]): MergedImportRow[] {
  const merged = new Map<string, MergedImportRow>();

  for (const row of rows) {
    const key = variantKey(row.externalId, row.condition, row.language, row.finish);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row, lines: [row.line] });
      continue;
    }

    existing.quantity += row.quantity;
    existing.lines.push(row.line);
    if (row.priceCents > 0) existing.priceCents = row.priceCents;
    if (row.marketPriceCents > 0) existing.marketPriceCents = row.marketPriceCents;
    existing.tags = [...new Set([...existing.tags, ...row.tags])];
    if (row.backImageUrl) existing.backImageUrl = row.backImageUrl;
    existing.isDoubleSided = existing.isDoubleSided || row.isDoubleSided;
    if (row.layout) existing.layout = row.layout;
  }

  return Array.from(merged.values());
}

function variantKey(externalId: string, condition: string, language: string, finish: string) {
  return `${externalId}|${condition}|${language}|${finish}`;
}

type SqlClient = NonNullable<ReturnType<typeof getSql>>;

async function backfillLegacyMatch(
  sql: SqlClient,
  row: MergedImportRow,
  existingByKey: Map<string, ExistingVariant>
) {
  const key = variantKey(row.externalId, row.condition, row.language, row.finish);
  if (existingByKey.has(key)) return;

  const legacy = (await sql`
    select id
    from cards
    where game = 'Magic'
      and coalesce(product_kind, 'single') = 'single'
      and active = true
      and external_id is null
      and lower(name) = lower(${row.name})
      and lower(set_name) = lower(${row.setName})
      and condition = ${row.condition}
      and language = ${row.language}
      and finish = ${row.finish}
      and image_url = ${row.imageUrl}
    limit 1
  `) as Array<{ id: string }>;

  if (!legacy[0]) return;

  await sql`
    update cards
    set external_id = ${row.externalId}, updated_at = now()
    where id = ${legacy[0].id}
  `;
  existingByKey.set(key, {
    id: legacy[0].id,
    external_id: row.externalId,
    condition: row.condition,
    language: row.language,
    finish: row.finish
  });
}

async function updateOne(sql: SqlClient, id: string, row: MergedImportRow) {
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
      external_id = ${row.externalId},
      active = true,
      updated_at = now()
    where id = ${id}
  `;
}

async function insertOne(sql: SqlClient, row: MergedImportRow) {
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
      featured,
      product_kind,
      external_id
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
      false,
      'single',
      ${row.externalId}
    )
  `;
}

function chunkArray<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}
