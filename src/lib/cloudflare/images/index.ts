/**
 * @packageDocumentation
 *
 * The client-safe render surface of the image proxy: building the `/img` URLs
 * for a picture (`imageSrc`, `imageSrcSet`) and the predicate for whether a URL
 * can be proxied (`isProxyableUrl`). The server side (the ImageService, the
 * Cloudflare bindings) is in `./server`, kept out of this index so it never
 * reaches the client bundle.
 */
export * from './address';
