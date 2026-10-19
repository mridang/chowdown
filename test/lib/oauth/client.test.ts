import { describe, expect, it, jest } from '@jest/globals';

import {
  DEFAULT_DOCUMENT_TTL_SECONDS,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_TTL_SECONDS,
  MAX_STALE_DOCUMENT_SECONDS,
  MIN_DOCUMENT_TTL_SECONDS,
  documentTtlSeconds,
  fetchClientMetadata,
  isClientBusy,
  isDocumentFresh,
  isDocumentUsable,
  isMetadataDocumentUrl,
  readCappedText,
  parseClientMetadataDocument,
  MAX_REGISTRATION_BYTES,
  parseRegistration,
  parseRegistrationText,
  registrationResponse,
} from '../../../src/lib/oauth/client';

const URL_ID = 'https://chatgpt.com/oauth/client.json';
const goodDoc = {
  client_id: URL_ID,
  client_name: 'ChatGPT',
  redirect_uris: ['https://chatgpt.com/cb'],
  token_endpoint_auth_method: 'none',
};

describe('isMetadataDocumentUrl', () => {
  it('accepts an https URL with a path', () => {
    expect(isMetadataDocumentUrl(URL_ID)).toBe(true);
  });

  it('rejects plain ids, http, bare hosts, IPs, localhost and dot segments', () => {
    expect(isMetadataDocumentUrl('dcr_abc123')).toBe(false);
    expect(isMetadataDocumentUrl('http://chatgpt.com/client.json')).toBe(false);
    expect(isMetadataDocumentUrl('https://chatgpt.com')).toBe(false);
    expect(isMetadataDocumentUrl('https://chatgpt.com/')).toBe(false);
    expect(isMetadataDocumentUrl('https://10.0.0.1/client.json')).toBe(false);
    expect(isMetadataDocumentUrl('https://localhost/client.json')).toBe(false);
    expect(isMetadataDocumentUrl('https://a.com/x/../client.json')).toBe(false);
    expect(isMetadataDocumentUrl('https://a.com/c.json#x')).toBe(false);
  });
});

describe('parseClientMetadataDocument', () => {
  it('accepts a valid document', () => {
    const result = parseClientMetadataDocument(goodDoc, URL_ID);
    expect(result).toMatchObject({
      ok: true,
      client: {
        clientId: URL_ID,
        name: 'ChatGPT',
        redirectUris: ['https://chatgpt.com/cb'],
        kind: 'cimd',
      },
    });
  });

  it('rejects a document whose client_id is not the URL it came from', () => {
    const result = parseClientMetadataDocument(
      { ...goodDoc, client_id: 'https://evil.example/client.json' },
      URL_ID,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects missing or unsafe redirect URIs', () => {
    expect(
      parseClientMetadataDocument({ ...goodDoc, redirect_uris: [] }, URL_ID).ok,
    ).toBe(false);
    expect(
      parseClientMetadataDocument(
        { ...goodDoc, redirect_uris: ['javascript:alert(1)'] },
        URL_ID,
      ).ok,
    ).toBe(false);
  });

  it('rejects clients that need a secret', () => {
    expect(
      parseClientMetadataDocument(
        { ...goodDoc, token_endpoint_auth_method: 'client_secret_basic' },
        URL_ID,
      ).ok,
    ).toBe(false);
  });

  it('falls back to the host as the name and caps its length', () => {
    const { client } = parseClientMetadataDocument(
      { ...goodDoc, client_name: undefined },
      URL_ID,
    ) as { client: { name: string } };
    expect(client.name).toBe('chatgpt.com');
    const long = parseClientMetadataDocument(
      { ...goodDoc, client_name: 'x'.repeat(500) },
      URL_ID,
    ) as { client: { name: string } };
    expect(long.client.name).toHaveLength(100);
  });

  it('rejects something that is not an object', () => {
    expect(parseClientMetadataDocument('nope', URL_ID).ok).toBe(false);
    expect(parseClientMetadataDocument(null, URL_ID).ok).toBe(false);
  });
});

describe('fetchClientMetadata', () => {
  const respond = (body: string, status = 200) =>
    jest.fn(
      async () => new Response(body, { status }),
    ) as unknown as typeof fetch;

  it('fetches without following redirects and validates the document', async () => {
    const fetchImpl = respond(JSON.stringify(goodDoc));
    const result = await fetchClientMetadata(URL_ID, fetchImpl);
    expect(result.ok).toBe(true);
    const init = (fetchImpl as unknown as jest.Mock).mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    expect(init?.redirect).toBe('manual');
  });

  it('fails on an HTTP error, bad JSON, an oversized body or a network error', async () => {
    expect((await fetchClientMetadata(URL_ID, respond('', 404))).ok).toBe(
      false,
    );
    expect((await fetchClientMetadata(URL_ID, respond('not json'))).ok).toBe(
      false,
    );
    expect(
      (await fetchClientMetadata(URL_ID, respond(' '.repeat(20_000)))).ok,
    ).toBe(false);
    const throwing = jest.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect((await fetchClientMetadata(URL_ID, throwing)).ok).toBe(false);
  });

  it('never fetches a client_id that is not a usable URL', async () => {
    const fetchImpl = respond('{}');
    expect(
      (await fetchClientMetadata('http://localhost/x', fetchImpl)).ok,
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('parseRegistration', () => {
  it('mints a dcr_ client id for a valid request', () => {
    const result = parseRegistration({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/cb'],
    });
    expect(result).toMatchObject({
      ok: true,
      client: { name: 'Claude', kind: 'dcr' },
    });
    expect(
      (result as { client: { clientId: string } }).client.clientId,
    ).toMatch(/^dcr_/);
  });

  it('rejects missing, unsafe or too many redirect URIs', () => {
    for (const redirect_uris of [
      undefined,
      [],
      ['http://example.com/cb'],
      Array.from({ length: 21 }, (_, i) => `https://a.com/${i}`),
    ]) {
      expect(parseRegistration({ redirect_uris })).toMatchObject({
        ok: false,
        error: 'invalid_redirect_uri',
      });
    }
  });

  it('rejects confidential clients and unsupported grants', () => {
    const base = { redirect_uris: ['https://a.com/cb'] };
    expect(
      parseRegistration({
        ...base,
        token_endpoint_auth_method: 'client_secret_post',
      }).ok,
    ).toBe(false);
    expect(parseRegistration({ ...base, grant_types: ['implicit'] }).ok).toBe(
      false,
    );
  });

  it('rejects a body that is not an object', () => {
    expect(parseRegistration('x').ok).toBe(false);
    expect(parseRegistration(null).ok).toBe(false);
  });
});

describe('parseRegistrationText', () => {
  const text = JSON.stringify({
    client_name: 'Assistant',
    redirect_uris: ['https://app.example/cb'],
  });

  it('registers a valid request', () => {
    expect(parseRegistrationText(text)).toMatchObject({
      ok: true,
      client: { name: 'Assistant', kind: 'dcr' },
    });
  });

  it('refuses a body that is too large before looking at it', () => {
    expect(
      parseRegistrationText('x'.repeat(MAX_REGISTRATION_BYTES + 1)),
    ).toEqual({
      ok: false,
      error: 'invalid_client_metadata',
      description: 'The request is too large.',
    });
  });

  it('refuses text that is not JSON', () => {
    expect(parseRegistrationText('{nope')).toEqual({
      ok: false,
      error: 'invalid_client_metadata',
      description: 'The request is not valid JSON.',
    });
  });

  it('passes on the reasons a client is refused', () => {
    expect(parseRegistrationText('{}')).toMatchObject({
      ok: false,
      error: 'invalid_redirect_uri',
    });
  });
});

describe('registrationResponse', () => {
  it('echoes the client and says how it may be used', () => {
    expect(
      registrationResponse(
        {
          clientId: 'dcr_x',
          name: 'X',
          redirectUris: ['https://app.example/cb'],
          kind: 'dcr',
        },
        1234,
      ),
    ).toEqual({
      client_id: 'dcr_x',
      client_name: 'X',
      redirect_uris: ['https://app.example/cb'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: 1234,
    });
  });
});

describe('client names', () => {
  it('are cleaned of invisible and direction-changing characters', () => {
    const result = parseClientMetadataDocument(
      { ...goodDoc, client_name: '\u202eClaude\u200b  Desktop\n' },
      URL_ID,
    ) as { client: { name: string } };
    expect(result.client.name).toBe('Claude Desktop');
  });

  it('fall back to the host when only invisible characters were given', () => {
    const result = parseClientMetadataDocument(
      { ...goodDoc, client_name: '\u200b\u200b' },
      URL_ID,
    ) as { client: { name: string } };
    expect(result.client.name).toBe('chatgpt.com');
  });

  it('are cleaned for a registered client too, with a neutral fallback', () => {
    const named = parseRegistration({
      client_name: '\u202eEvil\u202c',
      redirect_uris: ['https://a.com/cb'],
    }) as { client: { name: string } };
    expect(named.client.name).toBe('Evil');
    const unnamed = parseRegistration({
      client_name: '\u200b',
      redirect_uris: ['https://a.com/cb'],
    }) as { client: { name: string } };
    expect(unnamed.client.name).toBe('Unnamed client');
  });
});

describe('isMetadataDocumentUrl with a query', () => {
  it('rejects a client_id URL that has a query string', () => {
    expect(isMetadataDocumentUrl('https://a.com/client.json?x=1')).toBe(false);
    expect(isMetadataDocumentUrl('https://a.com/client.json?')).toBe(false);
  });
});

describe('redirect rules in client metadata', () => {
  it('rejects a document whose redirect URIs include a disallowed scheme', () => {
    for (const uri of ['http://example.com/cb', 'mailto:a@b.c', 'myapp://cb']) {
      expect(
        parseClientMetadataDocument(
          { ...goodDoc, redirect_uris: ['https://chatgpt.com/cb', uri] },
          URL_ID,
        ).ok,
      ).toBe(false);
    }
  });

  it('accepts the redirect URIs of the real clients', () => {
    expect(
      parseClientMetadataDocument(
        {
          ...goodDoc,
          redirect_uris: [
            'https://claude.ai/api/mcp/auth_callback',
            'cursor://anysphere.cursor-retrieval/oauth/user-x/callback',
            'http://127.0.0.1:33418/',
            'http://localhost:6274/oauth/callback',
          ],
        },
        URL_ID,
      ).ok,
    ).toBe(true);
  });
});

describe('documentTtlSeconds', () => {
  it('uses the default when the server says nothing', () => {
    expect(documentTtlSeconds(null)).toBe(DEFAULT_DOCUMENT_TTL_SECONDS);
    expect(documentTtlSeconds('public')).toBe(DEFAULT_DOCUMENT_TTL_SECONDS);
  });

  it('follows max-age', () => {
    expect(documentTtlSeconds('public, max-age=7200')).toBe(7200);
  });

  it('keeps max-age between five minutes and a day', () => {
    expect(documentTtlSeconds('max-age=5')).toBe(MIN_DOCUMENT_TTL_SECONDS);
    expect(documentTtlSeconds('max-age=999999999')).toBe(
      MAX_DOCUMENT_TTL_SECONDS,
    );
  });

  it('keeps a document only briefly when told not to cache it', () => {
    expect(documentTtlSeconds('no-store')).toBe(MIN_DOCUMENT_TTL_SECONDS);
    expect(documentTtlSeconds('No-Cache, max-age=86400')).toBe(
      MIN_DOCUMENT_TTL_SECONDS,
    );
  });
});

describe('readCappedText', () => {
  const streamOf = (...parts: readonly string[]) =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          parts.forEach((part) =>
            controller.enqueue(new TextEncoder().encode(part)),
          );
          controller.close();
        },
      }),
    );

  it('reads a body under the cap, across chunks', async () => {
    expect(await readCappedText(streamOf('{"a":', '1}'), 100)).toBe('{"a":1}');
  });

  it('decodes a character split between two chunks', async () => {
    const bytes = new TextEncoder().encode('é');
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 1));
          controller.enqueue(bytes.slice(1));
          controller.close();
        },
      }),
    );
    expect(await readCappedText(response, 100)).toBe('é');
  });

  it('gives up as soon as the body passes the cap, without reading the rest', async () => {
    let pulled = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(40));
        },
      }),
    );
    expect(await readCappedText(response, 100)).toBeUndefined();
    expect(pulled).toBeLessThan(10);
  });

  it('refuses a declared Content-Length over the cap without reading', async () => {
    let pulled = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(1));
        },
      }),
      { headers: { 'content-length': '5000' } },
    );
    expect(await readCappedText(response, 100)).toBeUndefined();
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it('reads an empty response as empty text', async () => {
    expect(await readCappedText(new Response(null), 100)).toBe('');
  });
});

describe('fetchClientMetadata streaming and caching', () => {
  const serve = (init: ResponseInit, body: string = JSON.stringify(goodDoc)) =>
    jest.fn(async () => new Response(body, init)) as unknown as typeof fetch;

  it('reports how long the document may be cached', async () => {
    const result = await fetchClientMetadata(
      URL_ID,
      serve({ headers: { 'cache-control': 'max-age=1800' } }),
    );
    expect(result).toMatchObject({ ok: true, ttlSeconds: 1800 });
  });

  it('uses the default lifetime without cache headers', async () => {
    expect(await fetchClientMetadata(URL_ID, serve({}))).toMatchObject({
      ok: true,
      ttlSeconds: DEFAULT_DOCUMENT_TTL_SECONDS,
    });
  });

  it('refuses a document over the byte cap', async () => {
    const big = JSON.stringify({
      ...goodDoc,
      client_name: 'x'.repeat(MAX_DOCUMENT_BYTES),
    });
    expect((await fetchClientMetadata(URL_ID, serve({}, big))).ok).toBe(false);
  });

  it('refuses a document whose Content-Length is over the cap', async () => {
    const result = await fetchClientMetadata(
      URL_ID,
      serve({ headers: { 'content-length': String(MAX_DOCUMENT_BYTES + 1) } }),
    );
    expect(result).toMatchObject({ ok: false, error: 'invalid_client' });
  });

  it('fails when reading the body fails', async () => {
    const broken = jest.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.error(new Error('reset'));
            },
          }),
        ),
    ) as unknown as typeof fetch;
    expect((await fetchClientMetadata(URL_ID, broken)).ok).toBe(false);
  });
});

describe('cached document freshness', () => {
  const NOW = Date.parse('2026-06-01T12:00:00.000Z');
  const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();
  const ahead = (seconds: number) =>
    new Date(NOW + seconds * 1000).toISOString();

  it('is fresh until the recorded expiry', () => {
    expect(
      isDocumentFresh({ fetchedAt: ago(60), expiresAt: ahead(60) }, NOW),
    ).toBe(true);
    expect(
      isDocumentFresh({ fetchedAt: ago(7200), expiresAt: ago(1) }, NOW),
    ).toBe(false);
  });

  it('falls back to the default lifetime for a copy with no recorded expiry', () => {
    expect(isDocumentFresh({ fetchedAt: ago(60), expiresAt: null }, NOW)).toBe(
      true,
    );
    expect(
      isDocumentFresh(
        { fetchedAt: ago(DEFAULT_DOCUMENT_TTL_SECONDS + 1), expiresAt: null },
        NOW,
      ),
    ).toBe(false);
  });

  it('is never fresh for a client that was not fetched', () => {
    expect(isDocumentFresh({ fetchedAt: null, expiresAt: null }, NOW)).toBe(
      false,
    );
  });

  it('may be used as a fallback for up to a week, then not', () => {
    expect(
      isDocumentUsable(
        { fetchedAt: ago(MAX_STALE_DOCUMENT_SECONDS - 60), expiresAt: null },
        NOW,
      ),
    ).toBe(true);
    expect(
      isDocumentUsable(
        { fetchedAt: ago(MAX_STALE_DOCUMENT_SECONDS + 60), expiresAt: null },
        NOW,
      ),
    ).toBe(false);
    expect(isDocumentUsable({ fetchedAt: null, expiresAt: null }, NOW)).toBe(
      false,
    );
  });
});

describe('isClientBusy', () => {
  it('recognises the busy answer and nothing else', () => {
    expect(isClientBusy({ busy: true, retryAfterSeconds: 3 })).toBe(true);
    expect(isClientBusy(undefined)).toBe(false);
    expect(
      isClientBusy({
        clientId: 'a',
        name: 'A',
        redirectUris: [],
        kind: 'dcr',
      }),
    ).toBe(false);
  });
});

describe('parseRegistration token_endpoint_auth_method (RFC 7591)', () => {
  const base = { redirect_uris: ['https://a.com/cb'] };

  it('accepts "none" explicitly and registers a public client', () => {
    const result = parseRegistration({
      ...base,
      token_endpoint_auth_method: 'none',
    });
    expect(result.ok).toBe(true);
  });

  it('accepts a request that does not say', () => {
    expect(parseRegistration(base).ok).toBe(true);
  });

  it.each(['client_secret_basic', 'client_secret_post', 'private_key_jwt'])(
    'rejects %s with invalid_client_metadata',
    (method) => {
      expect(
        parseRegistration({ ...base, token_endpoint_auth_method: method }),
      ).toMatchObject({ ok: false, error: 'invalid_client_metadata' });
    },
  );

  it('accepts response_types ["code"] and rejects anything else', () => {
    expect(parseRegistration({ ...base, response_types: ['code'] }).ok).toBe(
      true,
    );
    expect(
      parseRegistration({ ...base, response_types: ['code', 'token'] }),
    ).toMatchObject({ ok: false, error: 'invalid_client_metadata' });
    expect(parseRegistration({ ...base, response_types: [] }).ok).toBe(false);
    expect(parseRegistration({ ...base, response_types: 'code' }).ok).toBe(
      false,
    );
  });
});
