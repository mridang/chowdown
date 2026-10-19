/**
 * @packageDocumentation
 *
 * The typed database schema — the single source of truth every repository
 * composes queries against. Column names and JS keys are kept identical
 * (snake_case) so query results line up with the row types.
 *
 * The hand-written SQL migrations in `/migrations` remain authoritative;
 * this file mirrors their result so Drizzle can type the queries. Keep it
 * in sync when adding a migration (it matches the live D1 exactly).
 */

import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * One row per signed-in Google account. `google_sub` is Google's stable,
 * opaque user id (the OpenID `sub` claim) — the real identity key, since an
 * email can be reassigned but `sub` never changes.
 *
 * `refresh_token_enc` holds the user's Drive OAuth refresh token, encrypted
 * at rest (AES-GCM, key held only as a Worker secret). It is what lets the
 * app act on the user's Drive — writing new recipes, re-reading edits —
 * without the user being present. `recipes_folder_id` is the Drive id of the
 * "Recipes" folder chowdown created in the user's Drive. Both are null until
 * the person connects Google Drive, a separate step after signing in; if the
 * token is later lost the folder id stays, which is how "reconnect" is told
 * apart from "connect".
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  google_sub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  picture: text('picture'),
  refresh_token_enc: text('refresh_token_enc'),
  recipes_folder_id: text('recipes_folder_id'),
  /** Preferred measurement system: 'metric' | 'us' | 'imperial' | null. */
  units: text('units'),
  /**
   * Which generation of sessions is valid. A session cookie carries the epoch
   * it was issued under and is honoured only while it equals this value, so
   * bumping it signs the person out everywhere at once (migration 0013).
   */
  session_epoch: integer('session_epoch').notNull().default(0),
  /** When a Drive sync for this person was last started (ISO), for throttling (migration 0014). */
  last_synced_at: text('last_synced_at'),
  /** Until when one request owns the embeddings backfill (ISO); null when none does (migration 0014). */
  backfill_lease_until: text('backfill_lease_until'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

/**
 * A recipe cached from the user's Drive "Recipes" folder, keyed by its Drive
 * file id. Drive is the source of truth; this table is a read cache so the
 * recipe list renders instantly and the headless MCP endpoint can answer
 * without a live Drive round-trip.
 *
 * `modified_time` mirrors Drive's `modifiedTime` and drives incremental
 * re-sync: a folder scan re-fetches only files whose Drive time is newer than
 * the cached one. `parse_error` is set when the `.cook` file fails to parse,
 * so a corrupted recipe surfaces as "couldn't parse" instead of being dropped
 * or breaking the list.
 */
export const recipes = sqliteTable(
  'recipes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: integer('user_id').references(() => users.id),
    drive_file_id: text('drive_file_id').notNull().unique(),
    name: text('name').notNull(),
    title: text('title'),
    source: text('source').notNull(),
    modified_time: text('modified_time'),
    parse_error: text('parse_error'),
    /** Curated taxonomy tags as JSON: `{ facet: string[] }` (see taxonomy.ts). */
    tags: text('tags'),
    /**
     * The normalised `>> source:` address, for finding a recipe already
     * imported from a link. Null: not worked out yet; empty: it has none.
     */
    source_url: text('source_url'),
    first_opened_at: text('first_opened_at').notNull(),
    last_opened_at: text('last_opened_at').notNull(),
  },
  (table) => [
    index('idx_recipes_user_id').on(table.user_id),
    // A recipe belongs to one user and one Drive file; upserts conflict on
    // this pair so one person's sync can never overwrite another's row.
    uniqueIndex('idx_recipes_user_file').on(table.user_id, table.drive_file_id),
    index('idx_recipes_user_source_url').on(table.user_id, table.source_url),
  ],
);

/**
 * Embedding cache for semantic search. One row per recipe (keyed by Drive file
 * id), stamped with the file's `modified_time` so we only re-embed on change.
 * `vector` is the embedding as a JSON array of floats.
 */
export const embeddings = sqliteTable(
  'embeddings',
  {
    user_id: integer('user_id').notNull(),
    drive_file_id: text('drive_file_id').notNull(),
    title: text('title').notNull(),
    modified_time: text('modified_time'),
    vector: text('vector').notNull(),
    /** Precomputed nearest recipes: JSON `[{ id, title }]` (see similar.ts). */
    similar: text('similar'),
  },
  (table) => [
    primaryKey({ columns: [table.user_id, table.drive_file_id] }),
    index('idx_embeddings_user').on(table.user_id),
  ],
);

/**
 * Favourites ("hearts"): one row per (user, recipe) the user has hearted,
 * keyed by the Drive file id. Stored here rather than in Drive so toggling a
 * heart is instant and so recipe popularity can be aggregated from D1.
 */
export const favourites = sqliteTable(
  'favourites',
  {
    user_id: integer('user_id').notNull(),
    drive_file_id: text('drive_file_id').notNull(),
    created_at: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.user_id, table.drive_file_id] }),
    index('idx_favourites_user').on(table.user_id),
  ],
);

/**
 * OAuth clients (assistants allowed to ask for access). `kind` is `dcr` for a
 * dynamically registered client or `cimd` for one resolved from a Client ID
 * Metadata Document (cached; `fetched_at` says how fresh). `redirect_uris` is a
 * JSON array.
 */
export const oauthClients = sqliteTable('oauth_clients', {
  client_id: text('client_id').primaryKey(),
  kind: text('kind').notNull(),
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(),
  created_at: text('created_at').notNull(),
  fetched_at: text('fetched_at'),
  /** Until when a fetched document may be reused (from its cache headers); null for older rows and registered clients. */
  expires_at: text('expires_at'),
});

/** One user's approval of one client; revoking it revokes all its tokens. */
export const oauthGrants = sqliteTable(
  'oauth_grants',
  {
    id: text('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    client_id: text('client_id').notNull(),
    scope: text('scope').notNull(),
    resource: text('resource').notNull(),
    created_at: text('created_at').notNull(),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
  },
  (table) => [
    index('idx_oauth_grants_user').on(table.user_id),
    index('idx_oauth_grants_user_client').on(table.user_id, table.client_id),
    index('idx_oauth_grants_client').on(table.client_id),
  ],
);

/** Single-use authorization codes (hashed). `grant_id` is set once redeemed. */
export const oauthCodes = sqliteTable(
  'oauth_codes',
  {
    code_hash: text('code_hash').primaryKey(),
    client_id: text('client_id').notNull(),
    user_id: integer('user_id').notNull(),
    redirect_uri: text('redirect_uri').notNull(),
    /** Whether the authorization request carried `redirect_uri` (the token request must then repeat it). */
    redirect_uri_sent: integer('redirect_uri_sent', { mode: 'boolean' })
      .notNull()
      .default(true),
    code_challenge: text('code_challenge').notNull(),
    scope: text('scope').notNull(),
    resource: text('resource').notNull(),
    expires_at: integer('expires_at').notNull(),
    grant_id: text('grant_id'),
  },
  (table) => [index('idx_oauth_codes_expires').on(table.expires_at)],
);

/** Access and refresh tokens, stored only as SHA-256 hashes. */
export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    token_hash: text('token_hash').primaryKey(),
    kind: text('kind').notNull(),
    grant_id: text('grant_id').notNull(),
    expires_at: integer('expires_at').notNull(),
    used_at: integer('used_at'),
  },
  (table) => [
    index('idx_oauth_tokens_grant').on(table.grant_id),
    index('idx_oauth_tokens_expires').on(table.expires_at),
  ],
);

/**
 * A user's recipe import: pasted links/text turned into drafts, readable and
 * deletable as a resource. `items` is a JSON array (see recipe_imports in the
 * migration).
 */
export const recipeImports = sqliteTable(
  'recipe_imports',
  {
    id: text('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    status: text('status').notNull(),
    items: text('items').notNull(),
    /** How many drafts `items` holds; null means count them (migration 0013). */
    item_count: integer('item_count'),
    created_at: text('created_at').notNull(),
  },
  (table) => [
    index('idx_recipe_imports_user').on(table.user_id, table.created_at),
    index('idx_recipe_imports_created').on(table.created_at),
  ],
);
