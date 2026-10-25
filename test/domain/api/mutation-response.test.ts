import { describe, expect, it } from '@jest/globals';

import { settleMutation } from '@/domain/api/mutation-response';

const wording = { missing: 'note', invalid: 'The note is not valid.' };

/** The response of a change that did not happen. */
function refused(result: ReturnType<typeof settleMutation>) {
  if (result.ok) {
    throw new Error('expected a refusal');
  }
  return result.response;
}

describe('settleMutation', () => {
  it('hands back a finished change as it is', () => {
    const done = {
      kind: 'done',
      source: 's',
      etag: '"e"',
      value: 3,
    } as const;
    expect(settleMutation(done, wording)).toEqual({ ok: true, done });
  });

  it('answers 404 naming what was missing', async () => {
    const response = refused(settleMutation({ kind: 'not-found' }, wording));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ detail: 'No such note.' });
  });

  it('answers 412 when the recipe changed meanwhile', () => {
    const response = refused(
      settleMutation({ kind: 'precondition-failed' }, wording),
    );
    expect(response.status).toBe(412);
  });

  it("answers 400 with the route's sentence and the field errors", async () => {
    const response = refused(
      settleMutation({ kind: 'invalid', errors: ['text: required.'] }, wording),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      detail: 'The note is not valid.',
      errors: ['text: required.'],
    });
  });
});
