import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  external: ['obsidian'],
  minify: true,
  legalComments: 'inline',
  sourcemap: false,
  outfile: 'main.js',
});
