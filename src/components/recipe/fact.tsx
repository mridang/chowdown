import type { ReactNode } from 'react';

/**
 * One fact about a recipe: a line icon in a tinted square, a small label and the
 * value. Meant for a `dl`, which may only hold terms and descriptions, so the
 * icon sits inside the term, positioned to the left of both lines.
 */
export function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-11 pl-[3.625rem] leading-tight">
      <dt className="text-label font-semibold text-subtle uppercase">
        <span
          aria-hidden="true"
          className="rounded-control absolute top-0 left-0 grid h-11 w-11 place-items-center bg-sand text-ember"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold break-words">{children}</dd>
    </div>
  );
}
