import type { ReactElement } from 'react';

import { PlugIcon } from '@/components/icons';
import type { SampleRecipe } from '@/components/landing/demo-recipes';
import { MiniCard } from '@/components/landing/features/mini-card';
import { WindowFrame } from '@/components/landing/window-frame';
import { MCP_URL } from '@/lib/site';

/** The assistant: a chat that answers from your own recipes. */
export function AiVisual({
  recipes,
}: Readonly<{ recipes: readonly SampleRecipe[] }>): ReactElement {
  const picks = recipes
    .filter((recipe) => recipe.protein === 'chicken' && recipe.minutes <= 40)
    .slice(0, 2);
  return (
    <WindowFrame
      label="A chat where an assistant suggests recipes from your collection"
      title="Your assistant"
    >
      <div className="p-5 sm:p-6">
        <div className="ml-auto w-fit max-w-[85%] rounded-card rounded-br-sm bg-ink px-4 py-3 text-sm text-white">
          What can I make with chicken in under 40 minutes?
        </div>
        <div className="mt-4 max-w-[92%]">
          <p className="text-sm leading-relaxed">
            {picks.length === 2 ? 'Two' : String(picks.length)} from your
            collection fit. Both take under 40 minutes:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {picks.map((recipe) => (
              <MiniCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 truncate rounded-control bg-sand px-3 py-2 font-mono text-xs text-muted">
            <PlugIcon size="compact" className="shrink-0" />
            <span className="truncate">{MCP_URL}</span>
          </p>
        </div>
      </div>
    </WindowFrame>
  );
}
