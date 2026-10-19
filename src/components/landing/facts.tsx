import { Container } from '@/components/ui/layout';

/** The three figures, each as a big value and a line saying what it means. */
const FIGURES: [value: string, label: string][] = [
  ['1 folder', 'in your Google Drive holds every recipe'],
  ['.cook', 'plain text that any editor can open'],
  ['0 ads', 'and your recipes are never sold or shared'],
];

/** Three plain facts about how the product keeps your recipes. */
export function Facts() {
  return (
    <Container className="py-16 sm:py-20">
      <dl className="border-ink/15 grid grid-cols-1 gap-8 border-y py-10 text-center sm:grid-cols-3">
        {FIGURES.map(([value, label]) => (
          <div key={value}>
            <dt className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {value}
            </dt>
            <dd className="text-muted mt-2">{label}</dd>
          </div>
        ))}
      </dl>
    </Container>
  );
}
