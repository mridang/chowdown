import { describe, expect, it } from '@jest/globals';

import { CopyField } from '@/components/ui/copy-field';
import { html } from '../render';

/** Matches mcp address code. */
const MCP_ADDRESS_CODE =
  /<fieldset[^>]*aria-label="MCP server address"[^>]*><code[^>]*>https:\/\/app\.test\/mcp<\/code><\/fieldset>/u;

/** Matches copy button. */
const COPY_BUTTON = /<button type="button"[^>]*>.*Copy<\/button>/u;

describe('CopyField', () => {
  const out = html(
    <CopyField value="https://app.test/mcp" label="MCP server address" />,
  );

  it('shows the value, named for assistive technology', () => {
    expect(out).toMatch(MCP_ADDRESS_CODE);
  });

  it('has a Copy button that does not submit a form', () => {
    expect(out).toMatch(COPY_BUTTON);
  });

  it('does not claim to have copied anything yet', () => {
    expect(out).not.toContain('Copied');
  });
});
