import { describe, expect, it } from '@jest/globals';

import {
  LoadingCard,
  MessageCard,
  liveRole,
} from '../../src/views/status-panels';
import { html } from '../components/render';

describe('LoadingCard', () => {
  it('shows a skeleton and says what is loading', () => {
    const out = html(<LoadingCard noun="recipe" />);
    expect(out).toContain('class="skeleton"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Loading recipe…');
  });

  it('names the recipe once the host has said which one', () => {
    expect(html(<LoadingCard noun="recipe" request="Pasta" />)).toContain(
      'Loading recipe: Pasta…',
    );
  });
});

describe('MessageCard', () => {
  it('shows the server’s message, as an alert for a failure', () => {
    const out = html(<MessageCard reason="error" message="No recipe found." />);
    expect(out).toContain('No recipe found.');
    expect(out).toContain('role="alert"');
    expect(out).toContain('card error');
  });

  it('shows a plain note politely, without the error styling', () => {
    const out = html(<MessageCard reason="notice" message="Nothing yet." />);
    expect(out).toContain('role="status"');
    expect(out).not.toContain('card error');
  });

  it('says so when the call was cancelled or timed out', () => {
    expect(html(<MessageCard reason="cancelled" message="x" />)).toContain(
      'Cancelled',
    );
    expect(html(<MessageCard reason="timeout" message="x" />)).toContain(
      'Still waiting',
    );
  });
});

describe('liveRole', () => {
  it('interrupts only for failures', () => {
    expect(liveRole('error')).toBe('alert');
    expect(liveRole('connection')).toBe('alert');
    expect(liveRole('notice')).toBe('status');
    expect(liveRole('cancelled')).toBe('status');
    expect(liveRole('timeout')).toBe('status');
  });
});
