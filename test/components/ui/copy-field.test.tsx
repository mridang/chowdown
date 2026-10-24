import { describe, expect, it } from '@jest/globals';

import { CopyField } from '@/components/ui/copy-field';
import { html } from '../render';

describe('CopyField', () => {
  const out = html(
    <CopyField value="https://chowdown.test/mcp" label="MCP server address" />,
  );

  it('shows the value, named for assistive technology', () => {
    expect(out).toMatch(
      /<code[^>]*aria-label="MCP server address"[^>]*>https:\/\/chowdown\.test\/mcp<\/code>/,
    );
  });

  it('has a Copy button that does not submit a form', () => {
    expect(out).toMatch(/<button type="button"[^>]*>.*Copy<\/button>/);
  });

  it('does not claim to have copied anything yet', () => {
    expect(out).not.toContain('Copied');
  });
});
