import { Storefront } from "@/components/storefront";
import { currentUser } from "@/lib/auth";
import { getCatalogCards } from "@/lib/db";
import type { FilterGame, SortMode } from "@/lib/types";

const validGames: FilterGame[] = ["Todos", "Magic", "Yu-Gi-Oh!", "Pokemon"];
const validSorts: SortMode[] = ["relevance", "price-asc", "price-desc"];

export default async function Home({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = readParam(params.q);
  const requestedGame = readParam(params.game);
  const requestedSort = readParam(params.sort);
  const game = validGames.includes(requestedGame as FilterGame)
    ? (requestedGame as FilterGame)
    : "Todos";
  const sort = validSorts.includes(requestedSort as SortMode)
    ? (requestedSort as SortMode)
    : "relevance";

  const [cards, user] = await Promise.all([
    getCatalogCards({ query, game, sort }),
    currentUser()
  ]);

  return (
    <Storefront
      cards={cards}
      currentUser={user}
      initialQuery={query}
      initialGame={game}
      initialSort={sort}
    />
  );
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
