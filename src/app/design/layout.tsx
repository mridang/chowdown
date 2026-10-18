import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * The design sandbox: sample-data mock-ups of the redesign, for trying looks in
 * the browser without signing in. It only exists in development; in production
 * these routes don't exist.
 */
export default function DesignLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return children;
}
