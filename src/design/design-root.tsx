'use client';

import { useState, type ReactNode } from 'react';

import { cn } from './ui/cn';

/** Each pairing is a display face for headings plus a text face for the rest. */
const PAIRINGS: { id: string; name: string; display: string; body: string }[] =
  [
    { id: 'modern', name: 'Modern', display: 'bricolage', body: 'inter' },
    {
      id: 'editorial',
      name: 'Editorial',
      display: 'newsreader',
      body: 'inter',
    },
    { id: 'elegant', name: 'Elegant', display: 'instrument', body: 'inter' },
    { id: 'clean', name: 'Clean', display: 'space', body: 'inter' },
    { id: 'friendly', name: 'Friendly', display: 'dm-serif', body: 'dm-sans' },
    { id: 'classic', name: 'Classic', display: 'playfair', body: 'dm-sans' },
    { id: 'warm', name: 'Warm', display: 'fraunces', body: 'manrope' },
  ];

const PALETTES: [string, string][] = [
  ['paper', 'Paper'],
  ['stone', 'Stone'],
  ['butter', 'Butter'],
];

const RADII: [string, string][] = [
  ['sharp', 'Sharp'],
  ['soft', 'Soft'],
  ['round', 'Round'],
];

/** One row of toggle buttons in the control panel. */
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
      <legend className="mb-1.5 text-[10px] font-semibold tracking-[0.16em] text-white/70 uppercase">
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
 * Wraps every sandbox page and lets you flip the font pairing, colour palette
 * and corner radius live from a small panel, to compare looks without
 * rebuilding. The choice lives in state on this layout component, so it carries
 * across the sandbox pages as you navigate.
 */
export function DesignRoot({
  children,
  fontClassNames,
}: {
  children: ReactNode;
  fontClassNames: string;
}) {
  const [pairing, setPairing] = useState('modern');
  const [palette, setPalette] = useState('paper');
  const [radius, setRadius] = useState('soft');
  const [open, setOpen] = useState(false);
  const chosen = PAIRINGS.find((p) => p.id === pairing) ?? PAIRINGS[0]!;

  return (
    <div
      className={cn('design-root', fontClassNames)}
      data-display={chosen.display}
      data-body={chosen.body}
      data-palette={palette}
      data-radius={radius}
    >
      {children}
      <div className="fixed right-4 bottom-4 z-50 text-white">
        {open ? (
          <div className="rounded-card bg-ink flex w-72 flex-col gap-4 p-4">
            <Choice
              label="Fonts"
              options={PAIRINGS.map((p) => [p.id, p.name])}
              value={pairing}
              onChange={setPairing}
            />
            <Choice
              label="Palette"
              options={PALETTES}
              value={palette}
              onChange={setPalette}
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
              className="self-start text-xs text-white/70 underline"
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
