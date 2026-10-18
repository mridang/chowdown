import { redirect } from 'next/navigation';

import { getSessionUid } from '@/lib/auth/current-user';
import { getAppPageRows } from '@/lib/db/recipe-page';
import { compareText } from '@/lib/intl';
import {
  isUncurated,
  recipeDisplayName,
  sourceDomainOf,
} from '@/lib/recipe/cook-text';
import { parseRecipe } from '@/lib/recipe/cooklang';
import {
  buildDomainFacet,
  buildFacetView,
  facetCounts,
  matchesFilters,
  parseFilters,
  type SearchParams,
} from '@/lib/recipe/facet-filter';
import { extractMedia } from '@/lib/recipe/media';
import { syncFromDrive } from '@/lib/recipe/drive-sync';
import { backfillEmbeddings } from '@/lib/recipe/embed-write';
import { rowTags, type RecipeTags } from '@/lib/recipe/tag-index';
import { getDatabase, getEnv, runInBackground } from '@/lib/util';

import { RecipeApp, type RecipeCard } from './_components/recipe-app';

/** The recipe facets we surface as small chips on each grid card. */
const CARD_FACETS = ['cuisine', 'protein', 'difficulty'] as const;

/**
 * The authenticated app — a Server Component. It lists the user's recipes from
 * Drive, keeps the D1 tag index fresh, and renders a **filtered grid** on the
 * server from the URL query string (search, facets, view mode). Each card
 * carries its cover image and a couple of tag chips. The interactive shell
 * (facet controls, view toggle) is a client island.
 */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Identity comes from the signed cookie (no database read), and the user, the
  // cached recipes and the embedding count come back in ONE D1 round trip. No
  // Google or Drive call sits on this path, which is what makes the grid fast.
  const uid = await getSessionUid();
  if (uid === null) {
    redirect('/');
  }
  const db = getDatabase();
  let { user, recipes, embeddedCount, favouriteIds } = await getAppPageRows(
    db,
    uid,
  );
  if (!user || !user.refresh_token_enc) {
    // Unknown user, or Google rejected the stored login: sign in again.
    redirect(user ? '/api/auth/login' : '/');
  }

  if (recipes.length === 0) {
    // First visit: nothing cached yet, so sync once and wait for it.
    try {
      await syncFromDrive(user);
    } catch {
      redirect('/api/auth/login');
    }
    ({ recipes, embeddedCount, favouriteIds } = await getAppPageRows(db, uid));
  } else {
    // Otherwise show the cache now and refresh it from Drive afterwards, so a
    // recipe added or removed directly in Drive appears on the next view.
    runInBackground(syncFromDrive(user));
  }
  if (embeddedCount < recipes.length) {
    // Top up missing embeddings (bounded per visit) so "find similar" fills in.
    runInBackground(backfillEmbeddings(db, getEnv(), uid, 20));
  }

  const hearted = new Set(favouriteIds);
  const items: (RecipeCard & { tags: RecipeTags; domain?: string })[] =
    recipes.map((row) => {
      const parsed = parseRecipe(row.source, row.name);
      return {
        id: row.drive_file_id,
        display: recipeDisplayName(row.name),
        uncurated: isUncurated(row.name),
        cover: extractMedia(parsed).cover,
        favourite: hearted.has(row.drive_file_id),
        domain: sourceDomainOf(row.source),
        tags: rowTags(row, parsed),
      };
    });

  // The database orders names byte by byte, which puts "Éclair" after "Zucchini";
  // order the grid the way a person would alphabetise it.
  items.sort(
    (a, b) => compareText(a.display, b.display) || a.id.localeCompare(b.id),
  );

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const domainFacet = buildDomainFacet(items, filters);
  const facets = [
    ...buildFacetView(facetCounts(items), filters),
    ...(domainFacet ? [domainFacet] : []),
  ];
  const filtered = items.filter((it) => matchesFilters(it, filters));
  const view = sp['view'] === 'list' ? 'list' : 'grid';

  return (
    <RecipeApp
      userName={user.name ?? user.email}
      mcpToken={user.mcp_token}
      recipes={filtered.map((it) => ({
        id: it.id,
        display: it.display,
        uncurated: it.uncurated,
        cover: it.cover,
        favourite: it.favourite,
        chips: CARD_FACETS.flatMap((k) => it.tags[k] ?? []).slice(0, 3),
      }))}
      facets={facets}
      total={items.length}
      favouriteIds={items.filter((it) => it.favourite).map((it) => it.id)}
      view={view}
    />
  );
}
