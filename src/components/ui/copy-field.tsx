'use client';

import { useState, type ReactElement } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';

/** How long "Copied" stays on the button before it goes back to "Copy". */
const CONFIRMATION_MS = 1600;

/**
 * A read-only value (like the MCP server URL) with a Copy button. The button
 * confirms for a moment, then goes back to "Copy".
 */
export function CopyField({
  value,
  label,
}: Readonly<{
  /** The text shown, and the text copied. */
  value: string;
  /** What the value is, for assistive technology. */
  label: string;
}>): ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex h-12 items-center gap-2 rounded-control border border-field bg-white pr-1 pl-4">
      <code
        aria-label={label}
        className="min-w-0 flex-1 truncate font-mono text-sm"
      >
        {value}
      </code>
      <Button
        onClick={() => {
          // `clipboard` is missing on insecure pages; then there is nothing to confirm.
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), CONFIRMATION_MS);
          });
        }}
      >
        {copied ? <CheckIcon size="sm" /> : <CopyIcon size="sm" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
