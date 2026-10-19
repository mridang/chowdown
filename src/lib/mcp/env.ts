/**
 * @packageDocumentation
 *
 * Reading optional settings from the Cloudflare environment without assuming
 * there is one (tests and scripts run without it).
 */

import { getEnv } from '../util';

/** A setting from the environment, or undefined when there is none (or no context). */
export function getEnvSafe(name: string): string | undefined {
  try {
    const value: unknown = Reflect.get(getEnv(), name);
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}
