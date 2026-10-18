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
    <path d="M14.5 3.5c3.2 0 5.5 2.6 5.5 5.6 0 2.7-2 4.9-4.6 5.4-.9.2-1.7-.1-2.3-.7l-1.7-1.7c-.6-.6-.9-1.5-.7-2.3C10.8 7 12.2 3.5 14.5 3.5Z" />
    <path d="m11 13-4 4" />
    <circle cx="5.3" cy="16.9" r="1.5" />
    <circle cx="7.1" cy="19.2" r="1.5" />
  </Icon>
);
export const BeefIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 10c0-3.6 3-6 7.5-6s7.5 2.4 7.5 6c0 5-3.8 10-9 10-4 0-6-4.5-6-10Z" />
    <path d="M9.5 9c1.5-1.2 3.5-.7 4.2 1" />
    <circle cx="14.5" cy="14.5" r="1.6" />
  </Icon>
);
export const PorkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5.5 9.5-1.5-5 4.5 2M18.5 9.5l1.5-5-4.5 2" />
    <ellipse cx="12" cy="13" rx="7.5" ry="7" />
    <ellipse cx="12" cy="15" rx="3" ry="2.2" />
    <path d="M10.9 15h.01M13.1 15h.01M8.8 11h.01M15.2 11h.01" />
  </Icon>
);
export const LambIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17V9M12 17V7M17 17V9" />
    <circle cx="7" cy="7.8" r="1.3" />
    <circle cx="12" cy="5.8" r="1.3" />
    <circle cx="17" cy="7.8" r="1.3" />
    <path d="M5 17c0 3 14 3 14 0v-3H5z" />
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

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </Icon>
);
export const PlateIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 8V6M10.5 6h3" />
  </Icon>
);
export const OvenIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M3.5 9h17M7 6.5h.01M10 6.5h.01" />
    <rect x="7" y="12" width="10" height="5" rx="1" />
  </Icon>
);
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </Icon>
);
export const PrinterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2" />
    <rect x="7" y="14" width="10" height="6" rx="1" />
  </Icon>
);
export const ExpandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);
export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
);
export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
);
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h13" />
  </Icon>
);
export const NoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4h14v12l-5 5H5zM14 21v-5h5M8 9h8M8 13h4" />
  </Icon>
);
export const PlusCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Icon>
);

/** Google Drive: the triangle of three sloped sides, in the line style of the rest. */
export const DriveIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3h8l6 10.5-4 7H6l-4-7zM8 3l6 10.5h8M14 13.500l-4 7M2 13.500h12" />
  </Icon>
);

/** The multi-colour Google "G", for the sign-in button. */
export function GoogleIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      <path
        fill="#4285F4"
        d="M21.6 12.230c0-.710-.060-1.390-.180-2.050H12v3.870h5.380a4.6 4.6 0 0 1-2 3.020v2.510h3.230c1.890-1.740 2.990-4.3 2.990-7.350Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.960-.900 6.610-2.420l-3.230-2.510c-.900.6-2.040.960-3.380.960-2.6 0-4.810-1.760-5.6-4.120H3.060v2.590A9.990 9.990 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.910a6 6 0 0 1 0-3.820V7.5H3.060a10 10 0 0 0 0 9z"
      />
      <path
        fill="#EA4335"
        d="M12 5.980c1.470 0 2.790.510 3.830 1.5l2.870-2.870C16.960 3.010 14.7 2 12 2a9.990 9.990 0 0 0-8.940 5.5l3.340 2.590C7.190 7.740 9.4 5.980 12 5.980Z"
      />
    </svg>
  );
}
