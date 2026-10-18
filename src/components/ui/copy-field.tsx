'use client';

import { useState } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/**
 * A read-only value (like the MCP server URL) with a Copy button. The button
 * confirms for a moment. `tone="onFlame"` restyles it for the orange footer.
 */
export function CopyField({
  value,
  label,
  tone = 'light',
}: {
  value: string;
  label: string;
  tone?: 'light' | 'onFlame';
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        'flex h-12 items-center gap-2 rounded-control border pr-1 pl-4',
        tone === 'light'
          ? 'border-ink/25 bg-white'
          : 'border-ink bg-transparent',
      )}
    >
      <code
        aria-label={label}
        className="min-w-0 flex-1 truncate font-mono text-sm"
      >
        {value}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
        className="rounded-control bg-ink hover:bg-ink/85 inline-flex h-10 shrink-0 items-center gap-2 px-4 text-sm font-semibold text-white transition"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
