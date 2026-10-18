import { sentenceCase } from '../format';
import { CheckIcon } from '../icons';
import { cn } from './cn';

/** One filter option: a tick box, the label and how many recipes match. */
export function CheckRow({
  label,
  count,
  checked = false,
}: {
  label: string;
  count: number;
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="rounded-control hover:bg-ink/5 flex min-h-9 w-full items-center gap-3 px-2 text-left text-[15px] transition"
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border transition',
          checked ? 'border-ink bg-ink text-white' : 'border-ink/35 bg-white',
        )}
      >
        {checked ? <CheckIcon className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className={cn('flex-1 truncate', checked && 'font-semibold')}>
        {sentenceCase(label)}
      </span>
      <span className="text-ink/65 text-xs tabular-nums">{count}</span>
    </button>
  );
}

/** A titled group of filter options. */
export function FacetGroup({
  title,
  values,
  checked = [],
}: {
  title: string;
  values: [string, number][];
  checked?: string[];
}) {
  return (
    <section className="border-ink/10 border-t pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-label px-2 font-semibold uppercase">{title}</h3>
      <div className="mt-2 flex flex-col">
        {values.map(([value, count]) => (
          <CheckRow
            key={value}
            label={value}
            count={count}
            checked={checked.includes(value)}
          />
        ))}
      </div>
    </section>
  );
}
