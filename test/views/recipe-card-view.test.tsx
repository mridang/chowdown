import { describe, expect, it } from '@jest/globals';

import type { RecipeCardData } from '../../src/lib/mcp/ui-types';
import {
  RecipeCardApp,
  RecipeCardScreen,
} from '../../src/views/recipe-card-view';
import type { ViewState } from '../../src/views/view-state';
import { html } from '../components/render';

const RECIPE: RecipeCardData = {
  id: 'r1',
  title: 'Pasta al Limone',
  uncurated: false,
  metadata: [['servings', '4']],
  ingredients: Array.from({ length: 9 }, (_, i) => ({
    name: `item ${i + 1}`,
    quantity: '',
  })),
  cookware: [],
  steps: [[{ kind: 'text', text: 'Boil.' }]],
  logs: [],
};

const noop = () => undefined;

/** Render the screen for a state. */
function screen(
  state: ViewState<RecipeCardData>,
  expanded = false,
  onOpenLink: ((url: string) => void) | undefined = undefined,
): string {
  return html(
    <RecipeCardScreen
      state={state}
      expanded={expanded}
      onExpand={noop}
      onCollapse={noop}
      onOpenLink={onOpenLink}
    />,
  );
}

describe('RecipeCardScreen', () => {
  it('shows a skeleton while connecting and while waiting', () => {
    expect(screen({ phase: 'connecting' })).toContain('class="skeleton"');
    expect(screen({ phase: 'waiting', request: 'Pasta' })).toContain(
      'Loading recipe: Pasta…',
    );
  });

  it('shows the server’s message instead of loading forever', () => {
    const out = screen({
      phase: 'failed',
      reason: 'error',
      message: 'No recipe found matching "soup".',
    });
    expect(out).toContain('No recipe found matching');
    expect(out).not.toContain('class="skeleton"');
  });

  it('shows the compact card with seven ingredients and the rest counted', () => {
    const out = screen({ phase: 'ready', data: RECIPE });
    expect(out).toContain('View recipe');
    expect(out).toContain('item 7');
    expect(out).not.toContain('item 8');
    expect(out).toContain('+2 more');
  });

  it('shows the full recipe, with a way back, when expanded', () => {
    const out = screen({ phase: 'ready', data: RECIPE }, true);
    expect(out).toContain('Method');
    expect(out).toContain('Back');
    expect(out).not.toContain('View recipe');
  });

  it('goes back to the compact card when no longer expanded (never stuck)', () => {
    const state: ViewState<RecipeCardData> = { phase: 'ready', data: RECIPE };
    expect(screen(state, false)).not.toContain('Method');
  });

  it('announces the recipe to screen readers when it arrives', () => {
    expect(screen({ phase: 'ready', data: RECIPE })).toContain(
      'Recipe loaded: Pasta al Limone',
    );
    expect(screen({ phase: 'waiting' })).not.toContain('Recipe loaded');
    expect(screen({ phase: 'waiting' })).toContain('aria-live="polite"');
  });

  it('points at the host’s close control when it would not leave fullscreen', () => {
    const out = html(
      <RecipeCardScreen
        state={{ phase: 'ready', data: RECIPE }}
        expanded
        onExpand={noop}
        onCollapse={noop}
        closeHint
        onOpenLink={undefined}
      />,
    );
    expect(out).toContain('Use the close button in the header');
  });

  it('includes the stylesheet', () => {
    expect(screen({ phase: 'connecting' })).toContain('<style>');
  });
});

describe('RecipeCardApp', () => {
  it('starts on the loading skeleton before any host has answered', () => {
    expect(html(<RecipeCardApp />)).toContain('Loading recipe…');
  });
});
