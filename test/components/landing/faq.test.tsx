import { describe, expect, it } from '@jest/globals';

import { FAQ, Faq } from '../../../src/components/landing/faq';
import { html } from '../render';

describe('Faq', () => {
  const out = html(<Faq />);

  it('is the section the header links jump to', () => {
    expect(out).toContain('id="faq"');
  });

  it('shows every question as a summary and every answer inside its item', () => {
    expect(out.match(/<details/g)).toHaveLength(FAQ.length);
    for (const { question, answer } of FAQ) {
      expect(out).toContain(question);
      expect(out).toContain(answer);
    }
  });

  it('makes the items exclusive by giving them one name', () => {
    expect(out.match(/name="faq"/g)).toHaveLength(FAQ.length);
  });
});
