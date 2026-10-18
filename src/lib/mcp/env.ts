import { getEnv } from '../util';

/** A setting from the environment, or undefined when there is none (or no context). */
export function getEnvSafe(name: string): string | undefined {
  try {
    const value = (getEnv() as unknown as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}
