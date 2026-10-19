export default {
  entry: [
    'open-next.config.ts',
    // Not imported by the app: esbuild bundles each view into a standalone HTML
    // page (the build:views script), the browser registers the service worker
    // by address, and the icon script is run by hand.
    'scripts/build-icons.mjs',
    // The conformance runner bundles and starts this server entry itself.
    'scripts/conformance/server.ts',
    'src/views/*.tsx',
    'public/sw.js',
  ],
  // @emnapi/* are listed only so the lockfile carries the WebAssembly runtime
  // that some optional native packages need on Linux (CI); `npm ci` fails
  // without them when the lockfile is made on a Mac. The ext-apps SDK and
  // sharp are used by the build scripts above.
  ignoreDependencies: [/^@emnapi\//],
  // Agent skills are run by an assistant, not by this app; `openssl` is a
  // system tool the dev-certificate script calls.
  ignore: ['skills/**'],
  ignoreBinaries: ['openssl'],
  tags: ['+public'],
};
