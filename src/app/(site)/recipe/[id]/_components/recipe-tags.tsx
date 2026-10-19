import type { ReactElement } from 'react';

import { Tag } from '@/components/ui/chip';
import { Eyebrow } from '@/components/ui/layout';
import { sentenceCase } from '@/lib/format';

/** The most keywords shown; a recipe can carry dozens, and a long row is noise. */
export const MAX_TAGS = 10;

/** The recipe list filtered to one keyword, which is where a tag leads. */
export function tagHref(keyword: string): string {
  return `/app?q=${encodeURIComponent(keyword)}`;
}

/**
 * The "Tagged" row at the foot of the recipe page: the recipe's keywords as
 * pills, each a link to the recipes that share it. Shows at most
 * {@link MAX_TAGS}, is left out of a printed page, and draws nothing for a
 * recipe without keywords.
 */
export function RecipeTags({
  keywords,
}: Readonly<{
  /** The recipe's keywords, most relevant first. */
  keywords: readonly string[];
}>): ReactElement | null {
  if (keywords.length === 0) {
    return null;
  }
  return (
    <div className="border-line mt-14 flex flex-wrap items-center gap-2 border-t pt-6 print:hidden">
      <Eyebrow as="span" tone="subtle" className="mr-2">
        Tagged
      </Eyebrow>
      {keywords.slice(0, MAX_TAGS).map((word) => (
        <Tag key={word} href={tagHref(word)}>
          {sentenceCase(word)}
        </Tag>
      ))}
    </div>
  );
}
