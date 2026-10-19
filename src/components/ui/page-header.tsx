import type { ReactElement, ReactNode } from 'react';

import { Container, Eyebrow, Heading } from '@/components/ui/layout';

/**
 * The band at the top of a page: an optional eyebrow, the page's one `h1`, an
 * optional introduction and, to the right of the title, the page's main action.
 * `children` sit underneath (a search box, an address to copy). `roomy` gives
 * the introductory pages more air than the working ones.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  roomy = false,
  children,
}: Readonly<{
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
  roomy?: boolean;
  children?: ReactNode;
}>): ReactElement {
  return (
    <div className="border-b border-line">
      <Container className={roomy ? 'py-10 sm:py-14' : 'py-8 sm:py-12'}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <Heading
              as="h1"
              variant="h1"
              className={eyebrow ? 'mt-2 max-w-3xl' : 'max-w-3xl'}
            >
              {title}
            </Heading>
          </div>
          {actions}
        </div>
        {intro ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            {intro}
          </p>
        ) : null}
        {children}
      </Container>
    </div>
  );
}
