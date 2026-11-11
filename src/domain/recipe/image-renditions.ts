/**
 * @packageDocumentation
 *
 * Telling resized copies of one photo apart from different photos. Recipe
 * pages routinely list the same picture several times at different sizes (a
 * WordPress site lists `photo-225x225.jpg`, `photo-320x180.jpg` and the
 * original `photo.jpg` in one `image` array, smallest first), and taking the
 * first one as the cover puts a thumbnail, stretched across the page, on top.
 *
 * Nothing is downloaded: which photo an address is a copy of, and how big the
 * copy is, is read from the address alone, from the two conventions that
 * cover most sites. A size written into the file name before the extension
 * (`-225x225`), and sizing parameters in the query (`?w=300`, `?resize=440,400`).
 * An address that says nothing about its size is the original, which is never
 * smaller than a copy made from it.
 */

/** What an address says about the photo it shows. */
interface Rendition {
  readonly url: string;
  /** The same for every copy of one photo: the address with its size removed. */
  readonly photo: string;
  /** How many pixels the copy has, or `Infinity` when the address gives no size. */
  readonly pixels: number;
}

/** A file name ending in `-<width>x<height>` before its extension. */
const SIZE_IN_NAME = /^(.+)-(\d{2,5})x(\d{2,5})(\.[A-Za-z0-9]+)$/;

/** Query parameters that only say how to size or encode a copy of the photo. */
const SIZING_PARAMS: ReadonlySet<string> = new Set([
  'w',
  'width',
  'h',
  'height',
  'resize',
  'fit',
  'crop',
  'quality',
  'q',
]);

/** A whole number above zero, or undefined. */
function positive(value: string | null | undefined): number | undefined {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * The pixels in a copy of the given width and height. Only one of them known
 * counts as a square of that side; neither known is the original.
 */
function pixelsOf(width?: number, height?: number): number {
  const across = width ?? height;
  const down = height ?? width;
  return across === undefined || down === undefined ? Infinity : across * down;
}

/** What one address says about its photo and size. */
function renditionOf(url: string): Rendition {
  try {
    const parsed = new URL(url);
    const named = SIZE_IN_NAME.exec(parsed.pathname);
    const path = named ? `${named[1]}${named[4]}` : parsed.pathname;
    const param = (name: string) => parsed.searchParams.get(name);
    const [resizeWidth, resizeHeight] = (param('resize') ?? '').split(',');
    const width = positive(
      named?.[2] ?? param('w') ?? param('width') ?? resizeWidth,
    );
    const height = positive(
      named?.[3] ?? param('h') ?? param('height') ?? resizeHeight,
    );
    const rest = [...parsed.searchParams]
      .filter(([key]) => !SIZING_PARAMS.has(key.toLowerCase()))
      .toSorted(([a], [b]) => a.localeCompare(b));
    return {
      url,
      photo: `${parsed.origin}${path}?${new URLSearchParams(rest)}`,
      pixels: pixelsOf(width, height),
    };
  } catch {
    // Not an address we can read: it is its own photo, of unknown size.
    return { url, photo: url, pixels: Infinity };
  }
}

/**
 * One address per photo: of the copies of a photo, the biggest (the first one
 * if they tie). Photos stay in the order they first appeared, so a deliberate
 * order of different photos is kept and only the choice among copies changes.
 */
export function bestRenditions(urls: readonly string[]): readonly string[] {
  const photos = Map.groupBy(
    urls.map((url) => renditionOf(url)),
    (r) => r.photo,
  );
  return [...photos.values()].flatMap((copies) => {
    const best = copies.reduce<Rendition | undefined>(
      (a, b) => (a === undefined || b.pixels > a.pixels ? b : a),
      copies[0],
    );
    return best ? [best.url] : [];
  });
}
