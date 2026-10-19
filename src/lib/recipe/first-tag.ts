import type { RecipeTags } from './tag-index';

/**
 * The first value of a tag (the recipe's main cuisine, say), or `undefined`
 * when the recipe has no value for that key.
 */
export function firstTag(
  tags: Readonly<RecipeTags>,
  key: string,
): string | undefined {
  return tags[key]?.[0];
}
