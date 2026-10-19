import { describe, expect, it } from '@jest/globals';

import {
  BarePage,
  MessagePage,
} from '../../../src/components/landing/bare-page';
import { html } from '../render';

describe('BarePage', () => {
  it('brings its own main landmark and a wordmark that links home', () => {
    const out = html(<BarePage>hello</BarePage>);
    expect(out).toContain('<main id="main"');
    expect(out).toContain('href="/"');
    expect(out).toContain('chowdown');
    expect(out).toContain('hello');
  });

  it('takes the header row height from the shared constant', () => {
    expect(html(<BarePage>x</BarePage>)).toContain('h-[4.25rem]');
  });
});

describe('MessagePage', () => {
  it('has the page heading, the explanation and the actions', () => {
    const out = html(
      <MessagePage
        eyebrow="Page not found"
        title="We couldn't find that page"
        actions={<a href="/">Home</a>}
      >
        <p>It may have moved.</p>
      </MessagePage>,
    );
    expect(out).toMatch(/<h1[^>]*>We couldn&#x27;t find that page<\/h1>/);
    expect(out).toContain('Page not found');
    expect(out).toContain('It may have moved.');
    expect(out).toContain('href="/"');
  });
});
