/* eslint-disable tailwindcss/no-custom-classname -- fixture class names that are not Tailwind classes. */
import { describe, expect, it } from '@jest/globals';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../src/components/ui/accordion';
import { html } from '../render';

const sample = (
  <Accordion className="faq">
    <AccordionItem name="questions">
      <AccordionTrigger>Is it free?</AccordionTrigger>
      <AccordionContent>Yes.</AccordionContent>
    </AccordionItem>
    <AccordionItem name="questions" open>
      <AccordionTrigger>Is it fast?</AccordionTrigger>
      <AccordionContent>Very.</AccordionContent>
    </AccordionItem>
  </Accordion>
);

describe('Accordion', () => {
  const out = html(sample);

  it('is built from native details and summary elements', () => {
    expect(out.match(/<details/g)).toHaveLength(2);
    expect(out).toMatch(/<summary[^>]*>Is it free\?/);
  });

  it('makes items exclusive when they share a name', () => {
    expect(out.match(/name="questions"/g)).toHaveLength(2);
  });

  it('can start with an item open', () => {
    expect(out.match(/<details[^>]*\bopen=""/g)).toHaveLength(1);
  });

  it('keeps the answer inside the item it belongs to', () => {
    expect(out).toMatch(/<details[^>]*>.*Is it free\?.*Yes\..*<\/details>/);
  });

  it('draws a chevron that assistive technology skips', () => {
    expect(out).toContain('aria-hidden="true"');
  });

  it('takes its wrapper’s class from the caller', () => {
    expect(out.startsWith('<div class="faq">')).toBe(true);
  });
});
