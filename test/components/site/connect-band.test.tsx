import { describe, expect, it } from '@jest/globals';

import { ConnectBand } from '@/components/site/connect-band';
import { MCP_URL } from '@/utils/site';
import { html } from '../render';

const HREF_CONNECT_SET = /<a [^>]*href="\/connect"[^>]*>Set it up/u;

describe('ConnectBand', () => {
  const out = html(<ConnectBand />);

  it('shows the address to add, with a way to copy it', () => {
    expect(out).toContain('Your MCP server address');
    expect(out).toContain(MCP_URL);
    expect(out).toContain('Copy');
  });

  it('links to the full instructions', () => {
    expect(out).toMatch(HREF_CONNECT_SET);
  });

  it('says which assistants it is for', () => {
    expect(out).toContain('Works with ChatGPT and Claude');
  });
});
