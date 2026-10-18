'use client';

import { useState, type ReactNode } from 'react';

import { cn } from './ui/cn';

const FONTS: [string, string][] = [
  ['fraunces', 'Fraunces'],
  ['newsreader', 'Newsreader'],
  ['source-serif', 'Source Serif'],
  ['playfair', 'Playfair'],
  ['dm-serif', 'DM Serif'],
  ['geist', 'Geist (sans)'],
];

const RADII: [string, string][] = [
  ['sharp', 'Sharp'],
  ['soft', 'Soft'],
  ['round', 'Round'],
];

/** One row of radio-style buttons in the control panel. */
function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([key, name]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition',
              value === key
                ? 'bg-white text-ink'
                : 'bg-white/10 text-white hover:bg-white/20',
            )}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Wraps every sandbox page and lets you flip the display font and corner radius
 * live from a small panel, to compare looks without rebuilding. The choice
 * lives in state on this layout component, so it carries across the sandbox
 * pages as you navigate.
 */
export function DesignRoot({
  children,
  fontClassNames,
}: {
  children: ReactNode;
  fontClassNames: string;
}) {
  const [font, setFont] = useState('newsreader');
  const [radius, setRadius] = useState('soft');
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn('design-root', fontClassNames)}
      data-font={font}
      data-radius={radius}
    >
      {children}
      <div className="fixed right-4 bottom-4 z-50 text-white">
        {open ? (
          <div className="rounded-card bg-ink flex w-64 flex-col gap-4 p-4">
            <Choice
              label="Display font"
              options={FONTS}
              value={font}
              onChange={setFont}
            />
            <Choice
              label="Corners"
              options={RADII}
              value={radius}
              onChange={setRadius}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="self-start text-xs text-white/60 underline"
            >
              Hide
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-ink rounded-full px-4 py-2 text-xs font-semibold"
          >
            Design controls
          </button>
        )}
      </div>
    </div>
  );
}
