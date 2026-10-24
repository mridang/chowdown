/**
 * @packageDocumentation
 *
 * Erasing a person from the database. Used by account deletion: everything
 * chowdown keeps about someone is keyed by their user id, and all of it goes
 * together, in one transaction, so a failure part-way leaves the account whole
 * rather than half erased. The person's own Google Drive files are not touched
 * (they belong to the person, and deleting the account is not a request to
 * delete their recipes).
 */

import { eq, inArray } from 'drizzle-orm';

import type { Database } from '@/lib/db/client';
import {
  embeddings,
  favourites,
  oauthCodes,
  oauthGrants,
  oauthTokens,
  recipeImports,
  recipes,
  users,
} from '@/lib/db/schema';

/**
 * Delete the user row and every row that hangs off it: cached recipes and
 * their embeddings, hearts, import drafts, and the connections they gave to
 * assistants (grants, with the tokens and unspent codes behind them). The
 * recipes go before the user because they reference it.
 */
export async function deleteAccountData(
  db: Database,
  userId: number,
): Promise<void> {
  await db.batch([
    db
      .delete(oauthTokens)
      .where(
        inArray(
          oauthTokens.grant_id,
          db
            .select({ id: oauthGrants.id })
            .from(oauthGrants)
            .where(eq(oauthGrants.user_id, userId)),
        ),
      ),
    db.delete(oauthCodes).where(eq(oauthCodes.user_id, userId)),
    db.delete(oauthGrants).where(eq(oauthGrants.user_id, userId)),
    db.delete(recipeImports).where(eq(recipeImports.user_id, userId)),
    db.delete(favourites).where(eq(favourites.user_id, userId)),
    db.delete(embeddings).where(eq(embeddings.user_id, userId)),
    db.delete(recipes).where(eq(recipes.user_id, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}
