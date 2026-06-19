/**
 * @packageDocumentation
 *
 * The typed data layer: the Drizzle schema (the single contract every
 * repository composes queries against) and the client factory. A leaf —
 * depends on nothing; every domain lib depends on it.
 */

export * from './schema';
export { createDatabase, type Database } from './client';
