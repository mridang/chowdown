import { describe, expect, it } from '@jest/globals';

import { ConnectBand } from '@/components/site/connect-band';
import { MCP_URL } from '@/utils/site';
import { html } from '../render';

describe('ConnectBand', () => {
  const out = html(<ConnectBand />);

  it('shows the address to add, with a way to copy it', () => {
    expect(out).toContain('Your MCP server address');
    expect(out).toContain(MCP_URL);
    expect(out).toContain('Copy');
  });

  it('links to the full instructions', () => {
    expect(out).toMatch(/<a [^>]*href="\/connect"[^>]*>Set it up/);
  });

  it('says which assistants it is for', () => {
    expect(out).toContain('Works with ChatGPT and Claude');
  });
});
