# Mana Draw TCG Market

Next.js 15 (App Router) + React 19 + TypeScript 5 + Tailwind CSS v4 storefront for selling TCG cards, with an optional PostgreSQL (Neon) backend.

## Cursor Cloud specific instructions

- Single service: the Next.js app. Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`, `typecheck`). Node 22 is used here.
- The app runs fully without a database. When `DATABASE_URL` is unset it serves mock data from `src/lib/mock-data.ts`, and auth/checkout run in a demo mode using signed cookies. This is the default dev setup; no Postgres/Docker is required.
- Demo mode behavior worth knowing: checkout does not process payment — it creates a "Pedido demo" and clears the cart. Order history and buylist persistence only work when `DATABASE_URL` points at a Neon database seeded with `database/schema.sql`.
- Demo admin login (only when no `DATABASE_URL`): `admin@manadraw.local` / `admin123` at `/conta`, which unlocks `/admin`.
- To exercise the real DB path, create `.env.local` from `.env.example` and run `database/schema.sql` in Neon. `ADMIN_EMAIL`'s first signup becomes an admin.
- Dev server binds `http://localhost:3000`. Card images load from remote hosts allow-listed in `next.config.ts` (Scryfall, Pokemon TCG, YGOPRODeck); they need outbound network access to render.
