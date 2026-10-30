export default {
  entry: [
    'open-next.config.ts',
    // Bundled to standalone pages by build:views, never imported.
    'src/views/*.tsx',
  ],
  ignore: ['public/**', 'skills/**'],
  // Knip reads the `cloudflare:workers` import of the Workflows as a package
  // called `cloudflare`. The @emnapi packages are listed only so the lockfile
  // carries the WebAssembly runtime that `npm ci` needs on Linux.
  ignoreDependencies: ['cloudflare', /^@emnapi\//],
  tags: ['+public'],
};
