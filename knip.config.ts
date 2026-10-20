export default {
  entry: [
    'open-next.config.ts',
    // Bundled to standalone pages by build:views, never imported.
    'src/views/*.tsx',
  ],
  ignore: ['public/**', 'skills/**'],
  ignoreDependencies: [
    // Listed only so the lockfile carries the WebAssembly runtime that
    // `npm ci` needs on Linux.
    /^@emnapi\//,
  ],
  tags: ['+public'],
};
