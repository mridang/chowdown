/**
 * @packageDocumentation
 *
 * Every page needs the same handful of framework scripts. Sending them as a
 * `Link: …; rel=preload` header lets Cloudflare repeat the header as an Early
 * Hint (a `103` response sent while the page is still being built), so the
 * browser starts downloading the scripts a few hundred milliseconds before the
 * page itself arrives. The list comes from the build (`/preload.json`).
 */

/** The `Link` header value that preloads these built scripts. */
export function preloadLinkHeader(files: readonly string[]): string {
  return files
    .filter((file) => /^static\/.+\.js$/.test(file))
    .map((file) => `</_next/${file}>; rel=preload; as=script`)
    .join(', ');
}

/** Parse the build's preload list, tolerating anything unexpected. */
export function parsePreloadList(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.filter((f): f is string => typeof f === 'string')
      : [];
  } catch {
    return [];
  }
}
