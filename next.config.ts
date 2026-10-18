import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The approval screen must never be framed (clickjacking would let a
        // hostile page trick someone into approving an app) or cached.
        source: '/oauth/authorize',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  experimental: {
    // Put the (small) stylesheet in the page itself instead of making the
    // browser fetch it before it can paint anything.
    inlineCss: true,
    // Keep prefetched pages in the browser's client cache for three minutes, so a
    // card that has already been prefetched opens instantly with no server
    // request. Short, because recipe pages are personal (favourites, notes) and
    // router.refresh() after a change invalidates the cache anyway.
    staleTimes: { dynamic: 180, static: 180 },
  },
};

/**
 * The Cloudflare bindings (D1, AI, Images) are only emulated for `next dev`. A
 * production build must not try: the AI binding is remote-only, so starting the
 * emulation needs Cloudflare credentials, and a build has no use for them.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    void initOpenNextCloudflareForDev();
  }
  return nextConfig;
}
