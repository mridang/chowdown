import { describe, expect, it } from '@jest/globals';

import { EmptyState } from '@/components/ui/empty-state';
import { classOf, html } from '../render';

describe('EmptyState', () => {
  it('says what is missing, then how to carry on', () => {
    const out = html(
      <EmptyState title="No recipes yet" actions={<a href="/add">Add</a>}>
        <p>Paste a link.</p>
      </EmptyState>,
    );
    expect(out).toContain('No recipes yet');
    expect(out).toContain('Paste a link.');
    expect(out).toContain('href="/add"');
  });

  it('is a dashed outline by default and a solid card on request', () => {
    expect(classOf(html(<EmptyState title="x" />), 'div')).toContain(
      'border-dashed',
    );
    const card = html(<EmptyState variant="card" title="x" />);
    expect(classOf(card, 'div')).toContain('bg-white');
    expect(card).not.toContain('border-dashed');
  });

  it('uses a second-level heading unless it is the whole page', () => {
    expect(html(<EmptyState title="x" />)).toContain('<h2');
    expect(html(<EmptyState title="x" headingAs="h1" />)).toContain('<h1');
  });

  it('puts an eyebrow above the title when given one', () => {
    const out = html(
      <EmptyState variant="card" eyebrow="One more step" title="Connect" />,
    );
    expect(out.indexOf('One more step')).toBeLessThan(out.indexOf('Connect'));
  });

  it('shows the actions after the explanation, not before it', () => {
    const out = html(
      <EmptyState title="x" actions={<a href="/go">Go</a>}>
        <p>Explanation.</p>
      </EmptyState>,
    );
    expect(out.indexOf('Explanation.')).toBeLessThan(out.indexOf('href="/go"'));
  });

  it('spaces the heading from an eyebrow only when there is one', () => {
    expect(html(<EmptyState title="x" />)).not.toContain('mt-2');
    expect(html(<EmptyState eyebrow="Step" title="x" />)).toContain('mt-2');
  });
});
