import type { ReactElement } from 'react';

import type { SampleRecipe } from '@/components/landing/demo-recipes';
import {
  fileSlug,
  previewLines,
  tidyLine,
} from '@/components/landing/cook-file';
import { WindowFrame } from '@/components/landing/window-frame';

/**
 * One line of a Cooklang file, with its parts coloured: a `>> key: value`
 * metadata line has a coloured key, and in any other line the `@ingredient{}`,
 * `#cookware{}` and `~timer{}` marks are highlighted.
 */
function CookLine({ line }: Readonly<{ line: string }>): ReactElement {
  if (line.startsWith('>>')) {
    const [key, ...rest] = line.slice(2).split(':');
    return (
      <>
        <span className="text-subtle">{'>> '}</span>
        <span className="text-ember">{key?.trim()}</span>
        <span className="text-subtle">: </span>
        <span>{rest.join(':').trim()}</span>
      </>
    );
  }
  const parts = line.split(
    /(@[^{@#~]+\{[^}]*\}|#[^{@#~]+\{[^}]*\}|~\{[^}]*\})/g,
  );
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="rounded bg-marigold/40 px-0.5 font-medium">
            {part}
          </span>
        ) : part.startsWith('#') || part.startsWith('~') ? (
          <span
            key={i}
            className="rounded bg-forest/15 px-0.5 font-medium text-forest"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** The first lines of a recipe's Cooklang file, as a text editor shows them. */
export function CookFile({
  recipe,
  lines = 11,
}: Readonly<{
  recipe: SampleRecipe;
  /** How many lines of the file to show. */
  lines?: number;
}>): ReactElement {
  return (
    <WindowFrame
      label="A recipe as a plain text file"
      title={`${fileSlug(recipe.title, 28)}.cook`}
    >
      <pre className="overflow-hidden p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap sm:p-5">
        {previewLines(recipe.cooklang ?? '', lines).map((line, i) => (
          <span key={i} className="block">
            <CookLine line={tidyLine(line)} />
          </span>
        ))}
      </pre>
    </WindowFrame>
  );
}
