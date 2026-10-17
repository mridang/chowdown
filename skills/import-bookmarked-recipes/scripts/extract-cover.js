/**
 * Find the cover photo of the recipe page that is currently open.
 *
 * Run it in the page with a "run JavaScript in the page" browser tool. It only
 * reads the page — it changes nothing — and returns:
 *
 *   { title, best, candidates }
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
  const found = [];

  /** Keep an address only if it is a real http(s) image URL, not a placeholder. */
  const add = (value) => {
    if (typeof value !== 'string' || !value.trim()) {
      return;
    }
    try {
      const url = new URL(value.trim(), base);
      const last = url.pathname.split('/').filter(Boolean).pop() || '';
      // A scraper that found no image often produces ".../undefined" or "null".
      if (
        !/^https?:$/.test(url.protocol) ||
        /^(undefined|null|nan|false)$/i.test(last)
      ) {
        return;
      }
      if (!found.includes(url.href)) {
        found.push(url.href);
      }
    } catch {
      // not a usable address
    }
  };

  // 1. Structured data. Recipes often point at their photo by "@id", with the
  //    ImageObject defined in another block, so index every node by id first.
  const nodes = [];
  const byId = {};
  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      nodes.push(value);
      if (value['@id']) {
        byId[value['@id']] = value;
      }
      Object.values(value).forEach(walk);
    }
  };
  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((script) => {
      try {
        walk(JSON.parse(script.textContent));
      } catch {
        // ignore malformed blocks
      }
    });
  const fromImageField = (value) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(fromImageField);
    } else if (typeof value === 'string') {
      add(value);
    } else if (value.url || value.contentUrl) {
      add(value.url || value.contentUrl);
    } else if (
      value['@id'] &&
      byId[value['@id']] &&
      byId[value['@id']] !== value
    ) {
      fromImageField(byId[value['@id']]);
    }
  };
  nodes
    .filter((node) => [].concat(node['@type'] || []).includes('Recipe'))
    .forEach((recipe) => fromImageField(recipe.image));

  // 2. Share images.
  const meta = (selector) =>
    document.querySelector(selector)?.getAttribute('content');
  add(meta('meta[property="og:image"], meta[name="og:image"]'));
  add(meta('meta[name="twitter:image"]'));

  // 3. Last resort: the largest real photo on the page. Skip logos, avatars and
  //    ads by matching whole path words ("uploads/" must not match "ads/").
  if (found.length === 0) {
    const skip =
      /(^|[/_.-])(logo|avatar|icon|sprite|banner|pixel|tracking|gravatar|ads?)([/_.-]|$)/i;
    const biggest = [...document.images]
      .filter(
        (img) =>
          img.complete &&
          img.naturalWidth >= 300 &&
          img.naturalHeight >= 200 &&
          img.getBoundingClientRect().width > 200 &&
          !skip.test(new URL(img.currentSrc || img.src, base).pathname),
      )
      .sort(
        (a, b) =>
          b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight,
      )[0];
    if (biggest) {
      add(biggest.currentSrc || biggest.src);
    }
  }

  return { title: document.title, best: found[0] || null, candidates: found };
})();
