create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tcg_game') then
    create type tcg_game as enum ('Magic', 'Yu-Gi-Oh!', 'Pokemon');
  end if;
  if not exists (select 1 from pg_type where typname = 'card_condition') then
    create type card_condition as enum ('NM', 'SP', 'MP', 'HP');
  end if;
  if not exists (select 1 from pg_type where typname = 'card_language') then
    create type card_language as enum ('PT', 'EN', 'JP');
  end if;
  if not exists (select 1 from pg_type where typname = 'card_finish') then
    create type card_finish as enum ('Normal', 'Foil', 'Holo', 'Secret');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('customer', 'admin');
  end if;
end
$$;

create table if not exists cards (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  game tcg_game not null,
  set_name text not null,
  rarity text not null,
  condition card_condition not null default 'NM',
  language card_language not null default 'PT',
  price_cents integer not null check (price_cents >= 0),
  market_price_cents integer not null check (market_price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text not null,
  tags text[] not null default '{}',
  finish card_finish not null default 'Normal',
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_game_idx on cards (game);
create index if not exists cards_featured_idx on cards (featured, updated_at desc);

alter table cards
  add column if not exists search_vector tsvector;

create or replace function cards_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    to_tsvector(
      'simple',
      coalesce(new.name, '') || ' ' ||
      coalesce(new.set_name, '') || ' ' ||
      coalesce(new.rarity, '') || ' ' ||
      coalesce(array_to_string(new.tags, ' '), '')
    );
  return new;
end
$$;

drop trigger if exists cards_search_vector_trigger on cards;

create trigger cards_search_vector_trigger
before insert or update of name, set_name, rarity, tags
on cards
for each row
execute function cards_search_vector_update();

update cards
set search_vector =
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' ||
    coalesce(set_name, '') || ' ' ||
    coalesce(rarity, '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '')
  )
where search_vector is null;

create index if not exists cards_search_idx on cards using gin (search_vector);

create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  user_id text not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists orders (
  id text primary key default gen_random_uuid()::text,
  user_id text references users (id) on delete set null,
  customer_email text not null,
  status text not null default 'pending',
  subtotal_cents integer not null default 0,
  created_at timestamptz not null default now()
);

alter table orders
  add column if not exists user_id text references users (id) on delete set null;

create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_customer_email_idx on orders (customer_email, created_at desc);

create table if not exists order_items (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references orders (id) on delete cascade,
  card_id text not null references cards (id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);

create table if not exists buylist_submissions (
  id text primary key default gen_random_uuid()::text,
  customer_name text not null,
  email text not null,
  game tcg_game not null,
  status text not null default 'new',
  offer_cents integer check (offer_cents is null or offer_cents >= 0),
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table buylist_submissions
  add column if not exists offer_cents integer check (offer_cents is null or offer_cents >= 0);

create table if not exists buylist_photos (
  id text primary key default gen_random_uuid()::text,
  submission_id text not null references buylist_submissions (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  data_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists buylist_submissions_status_idx on buylist_submissions (status, created_at desc);

create table if not exists external_card_cache (
  game tcg_game not null,
  query text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game, query)
);

create index if not exists external_card_cache_expires_idx on external_card_cache (expires_at);

insert into cards (
  id,
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
values
  (
    'mtg-001',
    'Sol Ring',
    'Magic',
    'Commander Masters',
    'Uncommon',
    'NM',
    'EN',
    2390,
    2690,
    8,
    'https://cards.scryfall.io/normal/front/4/6/46ca0b66-a000-4483-b916-f5b89e710244.jpg?1783915591',
    array['Commander', 'Artefato', 'Staple'],
    'Normal',
    true
  ),
  (
    'mtg-002',
    'Lightning Bolt',
    'Magic',
    'Secret Lair',
    'Rare',
    'SP',
    'EN',
    4490,
    4990,
    3,
    'https://cards.scryfall.io/normal/front/7/7/77c6fa74-5543-42ac-9ead-0e890b188e99.jpg?1783912538',
    array['Burn', 'Modern', 'Legacy'],
    'Foil',
    true
  ),
  (
    'pkm-001',
    'Charizard ex',
    'Pokemon',
    'Obsidian Flames',
    'Special Illustration Rare',
    'NM',
    'EN',
    39990,
    42700,
    1,
    'https://images.pokemontcg.io/sv3/223_hires.png',
    array['Fire', 'Chase', 'ex'],
    'Holo',
    true
  ),
  (
    'pkm-002',
    'Pikachu',
    'Pokemon',
    'Scarlet & Violet Promo',
    'Promo',
    'NM',
    'PT',
    3490,
    3890,
    12,
    'https://images.pokemontcg.io/svp/27_hires.png',
    array['Promo', 'Colecionavel', 'Eletrico'],
    'Holo',
    false
  ),
  (
    'ygo-001',
    'Blue-Eyes White Dragon',
    'Yu-Gi-Oh!',
    'Legendary Duelists',
    'Ultra Rare',
    'NM',
    'EN',
    6990,
    7990,
    4,
    'https://images.ygoprodeck.com/images/cards/89631139.jpg',
    array['Dragon', 'Anime', 'Classic'],
    'Secret',
    true
  ),
  (
    'ygo-002',
    'Ash Blossom & Joyous Spring',
    'Yu-Gi-Oh!',
    'Maximum Gold',
    'Premium Gold Rare',
    'SP',
    'EN',
    5590,
    5990,
    6,
    'https://images.ygoprodeck.com/images/cards/14558127.jpg',
    array['Hand Trap', 'Meta', 'Staple'],
    'Secret',
    false
  )
on conflict (id) do nothing;
