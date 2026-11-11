/**
 * @packageDocumentation
 *
 * How long a recipe takes, in whole minutes, read from its free-text time
 * metadata ("35 minutes", "1 hour 20 min", "15%minutes", "45").
 */

import { toIsoDuration } from '@/domain/recipe/schema-org';

/** Minutes for a time string, or undefined if it holds no time. */
export function minutesOf(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  // Cooklang writes quantity and unit as "15%minutes"; read that as "15 minutes".
  const iso = toIsoDuration(value.replaceAll('%', ' '));
  if (!iso) {
    return undefined;
  }
  // iso is always PT[n]H[n]M, as toIsoDuration builds it.
  const parts = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  return Number(parts?.[1] ?? 0) * 60 + Number(parts?.[2] ?? 0);
}
