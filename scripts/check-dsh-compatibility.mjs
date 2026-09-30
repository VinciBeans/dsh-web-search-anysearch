/**
 * Assert this package's `@deepseek-ai/dsh-*` peer ranges accept the harness
 * checked out beside it.
 *
 * The admission gate arrived with dsh `0.1.7-rc.1`: it reads those ranges before
 * importing a plugin, and refuses a bundle or row whose ranges exclude the running
 * version. This runs that release's own `evaluatePluginCompatibility`, so the
 * check cannot drift from the runtime it mirrors. Releases before the gate have
 * nothing to assert and say so instead of passing silently.
 *
 * Usage: node scripts/check-dsh-compatibility.mjs [harness-dir]
 * @module @wenqi_bian/dsh-web-search-anysearch/check-dsh-compatibility
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const harnessDir = resolve(root, process.argv[2] ?? '../../deepseek-harness')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** The harness release under test, as its own manifest states it. */
function harnessVersion() {
  const path = join(harnessDir, 'packages', 'boot', 'app-boot', 'package.json')
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')).version
}

// A missing checkout is not a release without the gate: reporting the vacuous
// result there would make the check silently green wherever it cannot run.
const version = harnessVersion()
if (version === undefined) {
  console.error(`no DeepSeek Harness checkout at ${harnessDir}; pass its path as the first argument`)
  process.exit(1)
}

const gate = join(harnessDir, 'packages', 'boot', 'app-boot', 'src', 'plugin-compatibility.ts')
if (!existsSync(gate)) {
  console.log(`dsh ${version} predates the plugin admission gate: nothing to assert`)
  process.exit(0)
}

const { evaluatePluginCompatibility, getDshRuntimeVersion, pluginCompatibilityWarning } =
  await import(pathToFileURL(gate).href)

const issue = evaluatePluginCompatibility(manifest)
if (issue !== undefined) {
  console.error(pluginCompatibilityWarning(issue))
  process.exit(1)
}
console.log(`${manifest.name}@${manifest.version} is admissible on dsh ${getDshRuntimeVersion()}`)
