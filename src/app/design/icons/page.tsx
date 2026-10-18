import * as Icons from '@/design/icons';

const PROTEINS = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'egg',
  'beans',
  'seafood',
  'tofu',
  'vegetable',
];

/** A sheet of every icon at two sizes, for checking they read well. */
export default function IconSheet() {
  const entries = Object.entries(Icons).filter(
    ([name]) =>
      name.endsWith('Icon') && name !== 'ProteinIcon' && name !== 'GoogleIcon',
  ) as [string, (p: { className?: string }) => React.ReactElement][];
  return (
    <main className="mx-auto max-w-5xl p-8 font-sans">
      <h1 className="font-display text-3xl font-semibold">Icons</h1>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {entries.map(([name, Icon]) => (
          <li
            key={name}
            className="rounded-card border-ink/10 flex flex-col items-center gap-3 border bg-white p-4"
          >
            <span className="flex items-center gap-4">
              <Icon className="h-8 w-8" />
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-ink/65 text-xs">
              {name.replace('Icon', '')}
            </span>
          </li>
        ))}
      </ul>
      <h2 className="font-display mt-10 text-2xl font-semibold">Proteins</h2>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
        {PROTEINS.map((p) => (
          <li
            key={p}
            className="rounded-card border-ink/10 flex flex-col items-center gap-3 border bg-white p-4"
          >
            <span className="flex items-center gap-3">
              <Icons.ProteinIcon protein={p} className="h-9 w-9" />
              <Icons.ProteinIcon protein={p} className="h-4 w-4" />
            </span>
            <span className="text-ink/65 text-xs">{p}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
