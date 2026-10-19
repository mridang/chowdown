import { describe, expect, it } from '@jest/globals';

import { useInstallPrompt } from '../../../src/components/site/use-install-prompt';
import { html } from '../render';

/** Says whether the hook offers an install action. */
function Probe() {
  const { install } = useInstallPrompt();
  return <p>{install ? 'can install' : 'cannot install'}</p>;
}

describe('useInstallPrompt', () => {
  it('offers nothing until the browser says the site can be installed', () => {
    expect(html(<Probe />)).toBe('<p>cannot install</p>');
  });
});
