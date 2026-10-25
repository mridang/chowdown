/**
 * The recipe collection.
 *
 *   GET  /api/recipes   list recipes (filter, sort, paginate)
 *   POST /api/recipes   create a recipe from Cooklang text
 *
 * Listing is served from the D1 cache, so it never waits on Drive. Creating
 * writes the file to the user's Drive and indexes it. The recipe's source URL
 * (`>> source:`) is a secondary key: posting a recipe whose source is already
 * saved returns that recipe with 200 instead of making a duplicate.
 *
 * The behaviour lives in the `recipesCollection` controller; the exported
 * handlers only mount it.
 */

import { requireLiveUid, requireUser } from '@/domain/api/auth';
import { driveFailure } from '@/domain/api/drive-failure';
import { ApiController, problems, readJsonObject } from '@/lib/core/api';
import { appOrigin } from '@/lib/core/origin';
import {
  MAX_RECIPE_BODY_BYTES,
  parseNewRecipe,
} from '@/domain/api/recipe-input';
import { listRecipes } from '@/domain/api/recipe-list';
import { sendRecipe } from '@/domain/api/recipe-response';
import { getUserAccessToken } from '@/domain/auth/user-access-token';
import type { User } from '@/domain/db/users';
import { findRecipeBySourceUrl } from '@/domain/db/recipes';
import { createRecipeFile } from '@/domain/drive/recipe-files';
import { type DriveFile } from '@/lib/google';
import { recipesFolderFor } from '@/domain/drive/recipes-folder';
import { sourceUrlOf } from '@/lib/cooklang';
import { indexRecipeWrite } from '@/domain/recipe/tag-index';
import { getDatabase } from '@/domain/db/client';

export const dynamic = 'force-dynamic';

/** Save a new recipe file in the user's Recipes folder in Drive. */
async function createInDrive(
  user: Readonly<User>,
  name: string,
  cooklang: string,
): Promise<DriveFile> {
  const token = await getUserAccessToken(user);
  const folderId = await recipesFolderFor(user, token);
  return createRecipeFile(folderId, name, cooklang, token);
}

/**
 * The recipe collection controller.
 *
 * `GET /api/recipes`: one page of the signed-in user's recipes, filtered and
 * sorted by the query string. Answers 200 with the page, or 401 when nobody is
 * signed in.
 *
 * `POST /api/recipes`: create a recipe from `{ name, cooklang }`. Answers 201
 * with the new recipe and its `Location`, or 200 with the existing recipe (and
 * a `Location`) when its source URL is already saved. Needs a signed-in user
 * with Drive connected: 401 without a session, 400 for a bad body, 413 for a
 * body over 1 MiB, 409 when Drive is not connected, 502 when Drive fails.
 */
const recipesCollection = new ApiController()
  .on({
    method: 'GET',
    handle: async (_input, request) => {
      const auth = await requireLiveUid(request);
      if (!auth.ok) {
        return auth.response;
      }
      return listRecipes(request, auth.value);
    },
    encode: (result) => result,
  })
  .on({
    method: 'POST',
    handle: async (_input, request) => {
      const auth = await requireUser(request);
      if (!auth.ok) {
        return auth.response;
      }
      const user = auth.value;
      const body = await readJsonObject(
        request,
        'The request body must be a JSON object.',
        [],
        MAX_RECIPE_BODY_BYTES,
      );
      if (!body.ok) {
        return body.response;
      }
      const input = parseNewRecipe(body.value);
      if (!input.ok) {
        return problems.badRequest('The recipe is not valid.', input.errors);
      }

      const db = getDatabase();
      const sourceUrl = sourceUrlOf(input.cooklang);
      const existing = sourceUrl
        ? await findRecipeBySourceUrl(db, user.id, sourceUrl)
        : undefined;
      if (existing) {
        return sendRecipe(request, user.id, existing.drive_file_id, 200, {
          Location: `${appOrigin(request)}/api/recipes/${existing.drive_file_id}`,
        });
      }

      const created = await createInDrive(
        user,
        input.name.trim(),
        input.cooklang,
      ).catch((error: unknown) =>
        driveFailure(
          error,
          'Google Drive could not save the recipe. Nothing was changed.',
        ),
      );
      if (created instanceof Response) {
        return created;
      }
      await indexRecipeWrite(
        db,
        user.id,
        created.id,
        created.name,
        input.cooklang,
      );
      return sendRecipe(request, user.id, created.id, 201, {
        Location: `${appOrigin(request)}/api/recipes/${created.id}`,
      });
    },
    encode: (result) => result,
  });

export const { GET, POST } = recipesCollection.handlers();
