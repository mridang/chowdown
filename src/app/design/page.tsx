import Link from 'next/link';

/** Index of the sandbox screens. */
export default function DesignIndex() {
  const screens: [string, string, string][] = [
    [
      '/design/home',
      'Home',
      'Landing page for visitors; the signed-in dashboard with ?user=1',
    ],
    [
      '/design/search',
      'Search',
      'Collapsible filters that really filter, sort, show more',
    ],
    ['/design/recipe', 'Recipe', 'Cook mode, servings and units, share, notes'],
    ['/design/connect', 'Connect', 'Add chowdown to an AI assistant'],
    ['/design/icons', 'Icons', 'Every icon at two sizes'],
  ];
  return (
    <main className="mx-auto max-w-2xl p-10 font-serif">
      <h1 className="font-display text-4xl">Design sandbox</h1>
      <ul className="mt-6 space-y-3">
        {screens.map(([href, name, note]) => (
          <li key={href}>
            <Link href={href} className="font-display text-xl underline">
              {name}
            </Link>{' '}
            <span className="text-ink/65">{note}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
