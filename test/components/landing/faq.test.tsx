import { describe, expect, it } from '@jest/globals';

import { FAQ, Faq } from '@/components/landing/faq';
import { html } from '../render';

describe('Faq', () => {
  const out = html(<Faq />);

  it('is the section the header links jump to', () => {
    expect(out).toContain('id="faq"');
  });

  it.each(FAQ)(
    'shows every question as a summary and every answer inside its item (%j)',
    ({ question, answer }) => {
      expect(out.match(/<details/gu)).toHaveLength(FAQ.length);
      expect(out).toContain(question);
      expect(out).toContain(answer);
    },
  );

  it('makes the items exclusive by giving them one name', () => {
    expect(out.match(/name="faq"/gu)).toHaveLength(FAQ.length);
  });
});
