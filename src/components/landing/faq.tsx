import type { ReactElement } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Container, Eyebrow, Heading, Section } from '@/components/ui/layout';

/** The questions and their answers, in the order they are shown. */
export const FAQ = [
  {
    question: 'Is chowdown free?',
    answer:
      'Yes. chowdown is free to use, and your recipes live in your own Google Drive.',
  },
  {
    question: 'What can chowdown see in my Drive?',
    answer:
      'Only the files it creates. It uses the narrow Drive permission that cannot read anything else you have stored there.',
  },
  {
    question: 'What if I want to leave?',
    answer:
      'Remove chowdown in your Google account settings. Your Recipes folder and every file in it stay exactly where they are.',
  },
  {
    question: 'Which AI assistants work with it?',
    answer:
      'Any assistant that supports MCP connectors, including ChatGPT and Claude. You add one address, sign in with Google and approve what the assistant may do.',
  },
] as const;

/** Common questions, as collapsible answers (the only part of the page that is interactive). */
export function Faq(): ReactElement {
  return (
    <Section id="faq" surface="page">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <Heading className="mt-3">Good to know</Heading>
        </div>
        <Accordion className="border-t border-line">
          {FAQ.map(({ question, answer }) => (
            // One shared name makes the items exclusive: opening one closes the rest.
            <AccordionItem key={question} name="faq">
              <AccordionTrigger className="py-1 text-lg font-semibold">
                {question}
              </AccordionTrigger>
              <AccordionContent className="max-w-2xl leading-relaxed text-muted">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  );
}
