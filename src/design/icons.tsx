import type { SVGProps } from 'react';

/**
 * The icon set. Chunky 2px strokes with round caps, drawn on a 24px grid so they
 * sit well next to the bold display type. Every icon takes the usual SVG props
 * and inherits colour from `currentColor`, so they recolour with the text.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HeartIcon = ({
  filled,
  ...p
}: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const ServingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
    <path d="M17 3c-2 2-3 5-3 8h3v10" />
  </Icon>
);
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-1-5 1-8z" />
  </Icon>
);
export const LeafIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z" />
    <path d="M5 19c3-5 6-8 10-10" />
  </Icon>
);
export const PanIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="14" r="6" />
    <path d="M15 12 22 7" />
  </Icon>
);
export const CarrotIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 8 4 20l3.5-.5L20 9a4 4 0 0 0-6-1z" />
    <path d="M15 6c0-2 1-3 3-3M17 8c2 0 3-1 4-3" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
  </Icon>
);
export const ArrowIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const BoltIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" strokeWidth="1.5">
    <path d="m13 2-8 12h6l-1 8 8-12h-6z" />
  </Icon>
);
export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
);
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const PlugIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);
export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
  </Icon>
);

/* Protein icons: one small drawing per protein so a card shows it at a glance. */
export const ChickenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 4c3.3-.8 6 2.2 5.2 5.4-.4 1.6-1.5 2.7-3 3.1L15 14l-4-4 1.3-1.7c.5-1.5 1.8-3.8 2.2-4.3Z" />
    <path d="m11 13-5 5M5 17.5a1.7 1.7 0 1 0-2 2.3 1.7 1.7 0 1 0 2.3 2" />
  </Icon>
);
export const BeefIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 9.5C4.5 6 8 4 12 4s7.5 2 7.5 5.5c0 5.5-3.5 10.5-8.5 10.5-3.5 0-6.5-4-6.5-10.5Z" />
    <circle cx="13" cy="11.5" r="2.3" />
  </Icon>
);
export const PorkIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12.5" r="8" />
    <ellipse cx="12" cy="14.5" rx="3.2" ry="2.2" />
    <path d="M10.8 14.5h.01M13.2 14.5h.01M6.5 6.5 8.5 9.5M17.5 6.5 15.5 9.5" />
  </Icon>
);
export const LambIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 15c0-5 4-9 9-9 2.8 0 4.8 1.8 4.8 4.5 0 5-3.8 8.5-8.8 8.5-3 0-5-1.6-5-4Z" />
    <path d="M10.5 12.5c1-1.5 3-2.5 4.5-2.5M6.5 17.5 4 20M3 19a1.5 1.5 0 1 0 2.3 2" />
  </Icon>
);
export const EggIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c4 0 6.5 5.5 6.5 9.5a6.5 6.5 0 0 1-13 0C5.5 8.5 8 3 12 3Z" />
  </Icon>
);
export const BeansIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 7.5c2-3 7.5-3 8.5.5s-1 6.5-4 8.5-6.5 1.5-6.5-1.5c0-2.8.5-5 2-7.5Z" />
    <path d="M17 12c1.8.5 3 2 2.5 4s-2.5 3.5-4.5 3.5" />
  </Icon>
);
export const FishIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12c3-5 9-6 13-3l5-2v10l-5-2c-4 3-10 2-13-3Z" />
    <circle cx="8.5" cy="11" r=".6" fill="currentColor" />
  </Icon>
);
export const CubeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 8 8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />
  </Icon>
);

const PROTEIN_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  chicken: ChickenIcon,
  beef: BeefIcon,
  pork: PorkIcon,
  lamb: LambIcon,
  egg: EggIcon,
  beans: BeansIcon,
  seafood: FishIcon,
  tofu: CubeIcon,
  paneer: CubeIcon,
  vegetable: CarrotIcon,
};

/** The icon for a protein ("chicken", "beef"…), or a plate for anything else. */
export function ProteinIcon({
  protein,
  ...props
}: IconProps & { protein: string }) {
  const Component = PROTEIN_ICONS[protein.toLowerCase()] ?? PanIcon;
  return <Component {...props} />;
}
