/**
 * @packageDocumentation
 *
 * Public barrel for shared utilities. Import these from `@/lib/util`.
 */

export {
  getDB,
  isDatabaseBound,
  getEnv,
  getDatabase,
  runInBackground,
} from '@/lib/util/runtime';
export { errorMessage, logInfo, logWarn, logError } from '@/lib/util/logging';
export type { LogFields, LogLevel } from '@/lib/util/logging';
export { safeJsonParse } from '@/lib/util/json';
export type { JsonParseResult } from '@/lib/util/json';
