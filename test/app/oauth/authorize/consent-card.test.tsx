import { describe, expect, it } from '@jest/globals';

import { ConsentCard } from '../../../../src/app/oauth/authorize/consent-card';
import {
  clientIdentity,
  describeRedirect,
} from '../../../../src/lib/oauth/display';
import { html } from '../../../components/render';

const FIELDS = [
  { name: 'client_id', value: 'https://claude.ai/oauth/meta' },
  { name: 'state', value: 'a"b<c' },
] as const;

/** The card for a client, with sensible defaults. */
function card(
  overrides: {
    name?: string;
    clientId?: string;
    kind?: 'cimd' | 'dcr';
    redirect?: string;
    scopes?: readonly string[];
  } = {},
): string {
  const {
    name = 'Claude',
    clientId = 'https://claude.ai/oauth/meta',
    kind = 'cimd',
    redirect = 'https://claude.ai/api/mcp/auth_callback',
    scopes = ['recipes:read', 'recipes:write'],
  } = overrides;
  return html(
    <ConsentCard
      clientName={name}
      identity={clientIdentity({ clientId, kind })}
      redirect={describeRedirect(redirect)}
      scopes={scopes}
      email="cook@example.com"
      fields={FIELDS}
    />,
  );
}

describe('ConsentCard', () => {
  it('has exactly one h1, naming the app', () => {
    const markup = card();
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toMatch(
      /<h1[^>]*>Connect <span[^>]*>Claude<\/span> to chowdown\?<\/h1>/,
    );
  });

  it('shows the domain of a metadata-document client prominently', () => {
    const markup = card();
    expect(markup).toContain('Published by');
    expect(markup).toContain('<span class="font-semibold">claude.ai</span>');
    expect(markup).not.toContain('Unverified');
  });

  it('says a registered client is unverified', () => {
    const markup = card({ clientId: 'dcr_abc', kind: 'dcr' });
    expect(markup).toContain('Unverified app.');
    expect(markup).not.toContain('Published by');
  });

  it('shows the full redirect address, not only its host', () => {
    expect(card()).toContain('https://claude.ai/api/mcp/auth_callback</code>');
  });

  it('warns that a loopback redirect is the person own computer', () => {
    const markup = card({ redirect: 'http://localhost:6274/oauth/callback' });
    expect(markup).toContain('http://localhost:6274/oauth/callback');
    expect(markup).toContain('This app runs on your own computer');
  });

  it('notes that an app-scheme redirect opens an installed app', () => {
    const markup = card({
      redirect: 'cursor://anysphere.cursor-retrieval/oauth/x/callback',
    });
    expect(markup).toContain('opens an app installed on your device');
  });

  it('adds no warning for an ordinary https redirect', () => {
    expect(card()).not.toContain('Be careful');
  });

  it('lists the scopes in plain words', () => {
    const markup = card({ scopes: ['recipes:read'] });
    expect(markup).toContain(
      'See your recipes, search them and find similar ones',
    );
    expect(markup).not.toContain('Add, edit, tag');
  });

  it('cleans a hostile name and never renders it as HTML', () => {
    const markup = card({ name: '‮<img src=x onerror=alert(1)>​' });
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).not.toContain('‮');
    expect(markup).not.toContain('​');
  });

  it('uses a neutral label for an empty name', () => {
    const markup = card({ name: '​  ' });
    expect(markup).toContain('>An unnamed app</span>');
  });

  it('labels the form, carries the request through and offers both decisions', () => {
    const markup = card();
    expect(markup).toContain('action="/oauth/consent" method="post"');
    expect(markup).toMatch(/<form [^>]*aria-label=/);
    expect(markup).toContain(
      'aria-label="Approve or cancel connecting Claude"',
    );
    expect(markup).toContain(
      'name="client_id" value="https://claude.ai/oauth/meta"',
    );
    // Attribute values are escaped, so a state with quotes cannot break out.
    expect(markup).toContain('name="state" value="a&quot;b&lt;c"');
    expect(markup).toMatch(/value="deny" name="decision">Cancel/);
    expect(markup).toMatch(/value="approve" name="decision">Approve/);
  });

  it('says who is signed in', () => {
    expect(card()).toContain('cook@example.com');
  });
});
