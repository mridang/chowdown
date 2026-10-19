import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Container, Eyebrow, Heading, Section } from '@/components/ui/layout';

/** The questions and their answers, in the order they are shown. */
export const FAQ: [question: string, answer: string][] = [
  [
    'Is chowdown free?',
    'Yes. chowdown is free to use, and your recipes live in your own Google Drive.',
  ],
  [
    'What can chowdown see in my Drive?',
    'Only the files it creates. It uses the narrow Drive permission that cannot read anything else you have stored there.',
  ],
  [
    'What if I want to leave?',
    'Remove chowdown in your Google account settings. Your Recipes folder and every file in it stay exactly where they are.',
  ],
  [
    'Which AI assistants work with it?',
    'Any assistant that supports MCP connectors, including ChatGPT and Claude. You add one address, sign in with Google and approve what the assistant may do.',
  ],
];

/** Common questions, as collapsible answers (the only part of the page that is interactive). */
export function Faq() {
  return (
    <Section id="faq" surface="page">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <Heading className="mt-3">Good to know</Heading>
        </div>
        <Accordion className="border-ink/10 border-t">
          {FAQ.map(([question, answer]) => (
            // One shared name makes the items exclusive: opening one closes the rest.
            <AccordionItem key={question} name="faq">
              <AccordionTrigger className="py-1 text-lg font-semibold">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-muted max-w-2xl leading-relaxed">
                {answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  );
}
