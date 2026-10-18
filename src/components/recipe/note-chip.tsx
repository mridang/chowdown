import { NoteIcon } from '@/components/icons';
import { cn } from '@/components/ui/cn';

/**
 * One of the reader's own notes, shown beside the ingredient or step it was
 * written for. The marigold tint and the pencil-and-page icon set it apart from
 * the recipe's own words without relying on colour alone.
 */
export function NoteChip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'rounded-control bg-marigold/20 text-ink mt-1.5 flex items-start gap-2 px-2.5 py-1.5 text-[13px] leading-snug',
        className,
      )}
    >
      <NoteIcon className="mt-px h-4 w-4 shrink-0" />
      <span>
        <span className="font-semibold">Your note: </span>
        {text}
      </span>
    </p>
  );
}
