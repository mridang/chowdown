/**
 * @packageDocumentation
 *
 * How long a recipe takes, in whole minutes, read from its free-text time
 * metadata ("35 minutes", "1 hour 20 min", "15%minutes", "45").
 */

import { toIsoDuration } from './schema-org';

/** Minutes for a time string, or undefined if it holds no time. */
export function minutesOf(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  // Cooklang writes quantity and unit as "15%minutes"; read that as "15 minutes".
  const iso = toIsoDuration(value.replace(/%/g, ' '));
  if (!iso) {
    return undefined;
  }
  const h = /(\d+)H/.exec(iso);
  const m = /(\d+)M/.exec(iso);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}
