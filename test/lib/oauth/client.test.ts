import { describe, expect, it, jest } from '@jest/globals';

import {
  fetchClientMetadata,
  isMetadataDocumentUrl,
  parseClientMetadataDocument,
  parseRegistration,
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
