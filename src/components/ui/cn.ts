/** A class name, or something that adds none. */
type ClassPart = string | false | null | undefined;

/** Join class names, skipping anything falsy: `cn('a', cond && 'b')`. */
export function cn(...parts: readonly ClassPart[]): string {
  return parts.filter(Boolean).join(' ');
}
