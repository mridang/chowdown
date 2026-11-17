const LOGO_AVATAR_ICON =
  /(^|[/_.-])(logo|avatar|icon|sprite|banner|pixel|tracking|gravatar|ads?)([/_.-]|$)/iu;
const UNDEFINED_NULL_NAN = /^(undefined|null|nan|false)$/iu;
const HTTPS = /^https?:$/u;
/**
 * Find the cover photo of the recipe page that is currently open.
 *
 * Run it in the page with a "run JavaScript in the page" browser tool. It only
 * reads the page — it changes nothing — and returns:
 *
 *   { title, best, candidates }.
 *
 * `best` is the address to save as the recipe's cover (or null if none was
 * found) and `candidates` lists everything it considered, best first.
 *
 * Order of trust: the recipe's own structured data (JSON-LD `Recipe.image`),
 * then the page's share image (`og:image` / `twitter:image`), then — for old
 * blogs with no metadata at all — the largest real photo in the page.
 */
(() => {
  const base = location.href;

  /** An address only if it is a real http(s) image URL, not a placeholder; otherwise null. */
  const normalise = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    try {
      const url = new URL(value.trim(), base);
      const last = url.pathname.split('/').findLast(Boolean) || '';
      // A scraper that found no image often produces ".../undefined" or "null".
      if (!HTTPS.test(url.protocol) || UNDEFINED_NULL_NAN.test(last)) {
        return null;
      }
      return url.href;
    } catch {
      // not a usable address
      return null;
    }
  };

  // 1. Structured data. Recipes often point at their photo by "@id", with the
  //    ImageObject defined in another block, so index every node by id first.
  const collect = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => collect(item));
    }
    if (value && typeof value === 'object') {
      return [value, ...Object.values(value).flatMap((item) => collect(item))];
    }
    // Primitives carry no structured data, so there is nothing to index.
    return [];
  };
  const nodes = [
    ...document.querySelectorAll('script[type="application/ld+json"]'),
  ].flatMap((script) => {
    try {
      return collect(JSON.parse(script.textContent));
    } catch {
      // ignore malformed blocks
      return [];
    }
  });
  const byId = Object.fromEntries(
    nodes.flatMap((node) => (node['@id'] ? [[node['@id'], node]] : [])),
  );
  const fromImageField = (value) => {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => fromImageField(item));
    }
    if (typeof value === 'string') {
      return [value];
    }
    if (value.url || value.contentUrl) {
      return [value.url || value.contentUrl];
    }
    if (value['@id'] && byId[value['@id']] && byId[value['@id']] !== value) {
      return fromImageField(byId[value['@id']]);
    }
    // Nothing usable in this value, so there is no cover to take from it.
    return [];
  };
  const fromStructuredData = nodes
    .filter((node) => [node['@type'] || []].flat().includes('Recipe'))
    .flatMap((recipe) => fromImageField(recipe.image));

  // 2. Share images.
  const meta = (selector) =>
    document.querySelector(selector)?.getAttribute('content');
  const fromShareImages = [
    meta('meta[property="og:image"], meta[name="og:image"]'),
    meta('meta[name="twitter:image"]'),
  ];

  const unique = (values) => [
    ...new Set(values.map((value) => normalise(value)).filter(Boolean)),
  ];
  const known = unique([...fromStructuredData, ...fromShareImages]);

  // 3. Last resort: the largest real photo on the page. Skip logos, avatars and
  //    ads by matching whole path words ("uploads/" must not match "ads/").
  const [biggest] =
    known.length === 0
      ? [...document.images]
          .filter(
            (img) =>
              img.complete &&
              img.naturalWidth >= 300 &&
              img.naturalHeight >= 200 &&
              img.getBoundingClientRect().width > 200,
          )
          .filter(
            (img) =>
              !LOGO_AVATAR_ICON.test(
                new URL(img.currentSrc || img.src, base).pathname,
              ),
          )
          .toSorted(
            (a, b) =>
              b.naturalWidth * b.naturalHeight -
              a.naturalWidth * a.naturalHeight,
          )
      : [];
  const found = biggest ? unique([biggest.currentSrc || biggest.src]) : known;

  return { title: document.title, best: found[0] || null, candidates: found };
})();
