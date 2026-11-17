import { describe, expect, it } from '@jest/globals';

import { CopyField } from '@/components/ui/copy-field';
import { html } from '../render';

const BUTTON_TYPE_BUTTON = /<button type="button"[^>]*>.*Copy<\/button>/u;
const CODE_ARIA_LABEL =
  /<code[^>]*aria-label="MCP server address"[^>]*>https:\/\/app\.test\/mcp<\/code>/u;

describe('CopyField', () => {
  const out = html(
    <CopyField value="https://app.test/mcp" label="MCP server address" />,
  );

  it('shows the value, named for assistive technology', () => {
    expect(out).toMatch(CODE_ARIA_LABEL);
  });

  it('has a Copy button that does not submit a form', () => {
    expect(out).toMatch(BUTTON_TYPE_BUTTON);
  });

  it('does not claim to have copied anything yet', () => {
    expect(out).not.toContain('Copied');
  });
});
