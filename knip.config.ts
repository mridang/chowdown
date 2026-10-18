export default {
  entry: ['open-next.config.ts'],
  ignore: ['knip.config.ts'],
  // @emnapi/* are listed only so the lockfile carries the WebAssembly runtime
  // that some optional native packages need on Linux (CI); `npm ci` fails
  // without them when the lockfile is made on a Mac.
  ignoreDependencies: [
    /^@semantic-release\//,
    /^postcss$/,
    /^cloudflare$/,
    /^@emnapi\//,
  ],
  tags: ['+public'],
};
