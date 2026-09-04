/**
 * Build both halves with esbuild. The plugin's own modules are bundled into
 * one file per half; `@deepseek-ai/*` imports stay bare and resolve at runtime
 * from the profile's installation (they are declared dependencies/peers).
 *
 * The client half registers through the client module system's contract: the
 * bundle is a CJS factory whose body assigns `module.exports`, wrapped by a
 * `window.__ModuleLoader__.load({ id, factory })` call whose `require`
 * parameter is what every module-table request (currently `react`) resolves
 * through.
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'lib/index.js',
  sourcemap: true,
  external: ['@deepseek-ai/*'],
})

await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2020',
  outfile: 'lib/client.js',
  sourcemap: true,
  external: ['@deepseek-ai/*', 'react'],
  banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`
    + ' var module = { exports: {} }; var exports = module.exports;',
  footer: 'return module.exports; } });',
})

console.log('built lib/index.js and lib/client.js')
