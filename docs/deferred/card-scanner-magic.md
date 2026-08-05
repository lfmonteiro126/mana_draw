# Deferred: Admin card scanner (Magic-first)

Status: **parked** — do not implement unless the user explicitly asks to resume.

Cursor plan (full detail): `~/.cursor/plans/scanner_cartas_tcg_974e3b03.plan.md`

## Locked decisions

- **Surface:** admin → Nova carta → mode **Escanear** (not storefront/buylist in v1)
- **Game v1:** Magic only (Scryfall). Pokémon / Yu-Gi-Oh! later via same pipeline
- **Architecture:** hybrid
  - Browser: YOLO11n-OBB ONNX (`trading_card`) → crop / perspective warp → embedding (MobileCLIP/SigLIP)
  - Server: vector search → Top-k `CardSuggestion` → existing `createCardAction`
- **Ultralytics:** offline train/export only — not in Next.js production runtime
- **Index host (preferred when resuming):** existing VPS (120 GB SSD) for pgvector/LanceDB + indexer; Next.js stays on Vercel; Neon keeps store data. Marginal cloud cost of scanner ≈ US$0
- **Fallback index host:** Neon pgvector (~US$0.10–0.25/mo for Magic `default_cards`)

## Out of v1

- Pokémon / YGO in scanner UI
- Storefront / buylist camera
- Condition grading, authenticity
- LigaMagic pricing (separate deferred doc)

## Resume checklist

1. Schema / vector store (VPS preferred, or Neon `card_print_embeddings`)
2. `POST /api/admin/card-scan` (admin auth) → proxy or query index
3. Browser YOLO OBB + crop UI in `new-card-entry`
4. `scripts/vision/`: export ONNX + `build_embeddings.py` (Scryfall Magic)
5. Wire selection → create card form
6. Docs in AGENTS.md + basic eval
