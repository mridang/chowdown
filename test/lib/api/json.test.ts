import { describe, expect, it } from '@jest/globals';

import { isObject, readJson, readJsonObject } from '../../../src/lib/api/json';

const post = (body: string, type = 'application/json') =>
  new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': type },
    body,
  });

/** The status and problem type of a refused body. */
async function refusal(result: { ok: boolean; response?: Response }) {
  expect(result.ok).toBe(false);
  const response = result.response as Response;
  const body: { detail?: string } = await response.json();
  return { status: response.status, body };
}

describe('readJson', () => {
  it('parses a JSON body', async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it('ignores media type parameters and case', async () => {
    expect(
      (await readJson(post('[]', 'Application/JSON; charset=utf-8'))).ok,
    ).toBe(true);
  });

  it('refuses another media type with 415', async () => {
    const { status } = await refusal(await readJson(post('{}', 'text/plain')));
    expect(status).toBe(415);
  });

  it('accepts the extra media types a route names', async () => {
    const request = post('{}', 'application/merge-patch+json');
    expect((await readJson(request, ['application/merge-patch+json'])).ok).toBe(
      true,
    );
  });

  it('refuses a body that is not JSON with 400', async () => {
    const { status } = await refusal(await readJson(post('{nope')));
    expect(status).toBe(400);
  });

  it('refuses a string body sent without a content type (it goes out as text/plain)', async () => {
    const request = new Request('http://localhost/x', {
      method: 'POST',
      body: '{}',
    });
    expect((await readJson(request)).ok).toBe(false);
  });
});

describe('readJsonObject', () => {
  it('passes an object through', async () => {
    expect(await readJsonObject(post('{"a":1}'), 'Not an object.')).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it("answers 400 with the route's own sentence for other JSON", async () => {
    for (const body of ['[1]', '"x"', '3', 'null']) {
      const { status, body: problem } = await refusal(
        await readJsonObject(post(body), 'The patch must be a JSON object.'),
      );
      expect(status).toBe(400);
      expect(problem.detail).toBe('The patch must be a JSON object.');
    }
  });

  it('passes on the media-type refusal', async () => {
    const { status } = await refusal(
      await readJsonObject(post('{}', 'text/plain'), 'Not an object.'),
    );
    expect(status).toBe(415);
  });
});

describe('isObject', () => {
  it('is true only for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});
