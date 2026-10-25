/**
 * @packageDocumentation
 *
 * What this app adds to the Worker in `src/worker.ts`, which is the same in
 * every app: handlers besides `fetch` (a cron trigger's `scheduled`), and the
 * Workflow or Durable Object classes the Worker must export by name. This app
 * has none.
 */

/** The handlers this app adds to the Worker, besides `fetch`. */
const extraHandlers: Partial<ExportedHandler<CloudflareEnv>> = {};

export default extraHandlers;
