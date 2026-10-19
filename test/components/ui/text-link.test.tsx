import { describe, expect, it } from '@jest/globals';

import { TextLink } from '../../../src/components/ui/text-link';
import { classOf, html } from '../render';

describe('TextLink', () => {
  it('is underlined so it reads as a link', () => {
    expect(
      classOf(html(<TextLink href="/privacy">Privacy</TextLink>), 'a'),
    ).toContain('underline');
  });

  it('opens an outside address in a new tab without handing it this window', () => {
    const out = html(
      <TextLink href="https://example.com" external>
        Example
      </TextLink>,
    );
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('keeps a site address in this tab', () => {
    expect(html(<TextLink href="/privacy">x</TextLink>)).not.toContain(
      'target=',
    );
  });

  it('has a stronger look for a standalone link', () => {
    expect(
      classOf(
        html(
          <TextLink href="/" look="strong">
            x
          </TextLink>,
        ),
        'a',
      ),
    ).toContain('font-semibold');
  });
});
