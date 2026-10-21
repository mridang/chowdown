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
    redirect = 'https://claude.ai/mcp/auth_callback',
    scopes = ['recipes:read', 'recipes:write'],
  } = overrides;
  const identity = clientIdentity({ clientId, kind });
  return html(
    <ConsentCard
      clientName={name}
      identity={identity}
      redirect={describeRedirect(redirect, identity)}
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

  it('shows the full redirect address and, bold on its own line, the host', () => {
    const markup = card();
    expect(markup).toContain('https://claude.ai/mcp/auth_callback</code>');
    expect(markup).toMatch(
      /<span class="[^"]*font-semibold[^"]*">claude\.ai<\/span><code/,
    );
  });

  it('shows the ASCII form of an international host, never the look-alike letters', () => {
    const markup = card({ redirect: 'https://cl\u0430ude.ai/cb' });
    expect(markup).toContain('xn--clude-5ve.ai');
    expect(markup).not.toContain('\u0430');
  });

  it('warns that https://localhost is the person own computer too', () => {
    expect(card({ redirect: 'https://localhost:8443/cb' })).toContain(
      'This app runs on your own computer',
    );
  });

  it('warns about an address on a private network', () => {
    expect(card({ redirect: 'https://192.168.1.5/cb' })).toContain(
      'private network',
    );
  });

  it('notes a redirect on a site other than the one that published the app', () => {
    const markup = card({ redirect: 'https://elsewhere.example/cb' });
    expect(markup).toContain('is not on claude.ai');
    expect(card()).not.toContain('is not on');
  });

  it('offers a read-only choice when the app asked to change recipes, with everything as the default', () => {
    const markup = card();
    expect(markup).toContain('<legend');
    expect(markup).toMatch(/<input[^>]*name="access"[^>]*value="write"/);
    expect(markup).toMatch(/<input[^>]*name="access"[^>]*value="read"/);
    expect(markup.match(/name="access"[^>]*checked/g)).toHaveLength(1);
    expect(markup).toMatch(
      /value="write"[^>]*checked|checked=""[^>]*value="write"/,
    );
  });

  it('offers no choice when the app asked only to read', () => {
    expect(card({ scopes: ['recipes:read'] })).not.toContain('name="access"');
  });

  it('puts the choice before the buttons, so Enter still defaults to Cancel', () => {
    const markup = card();
    expect(markup.indexOf('name="access"')).toBeLessThan(
      markup.indexOf('value="deny"'),
    );
    expect(markup.indexOf('value="deny"')).toBeLessThan(
      markup.indexOf('value="approve"'),
    );
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
