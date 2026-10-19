import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

/** A component's HTML, for asserting on what it renders (there is no DOM in these tests). */
export function html(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** The class list of the first element whose tag is `tag`. */
export function classOf(markup: string, tag: string): string {
  return new RegExp(`<${tag}[^>]*class="([^"]*)"`).exec(markup)?.[1] ?? '';
}
