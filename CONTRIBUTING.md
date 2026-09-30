# Contributing

## Local development

The plugin's devDependencies point at a DeepSeek Harness checkout two levels up, so the repository is expected to sit beside it:

```
E:\Works\deepseek-harness              # harness checkout, built once
E:\Works\dsh-plugin\dsh-web-search-anysearch
```

```bash
npm install --legacy-peer-deps
npm run build       # writes lib/index.js (host) and lib/client.js (browser)
npm test            # node --test over tests/*.test.mjs
npm run typecheck
npm run compat      # admission gate against the harness checkout beside this repo
```

`npm run build` bundles `src/index.ts` to `lib/index.js` (ESM, `@deepseek-ai/*` left external) and `src/client/index.ts` to `lib/client.js` (the CJS factory the client module loader registers under `window.__ModuleLoader__.load`). `npm run prepack` runs the same build, so a publish never ships a stale bundle.

`npm run compat` reads the harness checkout's own `evaluatePluginCompatibility` and fails when this package's peer ranges exclude that release. A working tree checked out on a prerelease the ranges deliberately refuse (`0.2.0-rc.1`, for instance) reports exactly that, which is the intended answer, not a broken script.

The harness types must be built for the typecheck to see them:

```bash
cd ../../deepseek-harness
pnpm install --frozen-lockfile
pnpm run build:lib
```

## Verifying a harness release

Compatibility work is verified against a real release, not against reasoning about one. Each leg checks the harness out at an exact tag, asserts the tag still points at the pinned commit, builds its type artifacts, and runs the admission check, typecheck, build and tests against them. See `.github/workflows/ci.yml` for the current matrix.

Runtime checks follow the same rule: install the packed tarball into a throwaway `DSH_HOME`, compose the profile (`dsh --profile <name> --dump-config`), boot the web app on a spare port, and confirm the served client bundle. `.compat/` holds local audit notes and probes from each adaptation round; it is gitignored, so nothing there ships.

## Release convention

Releases are version-aligned with the harness: `0.2.0-alpha.2` is built for, and named after, the dsh `0.2.0` line. Bump `version` in `package.json`, add a `CHANGELOG.md` entry that names the verified tag and its pin, and publish through the `alpha` dist-tag.

Widening the supported range is part of an adaptation release, not a separate one:

1. Add the line to every `@deepseek-ai/dsh-*` peer range in `package.json`, and keep the ranges identical to each other.
2. Add the tag and its commit to the CI matrix.
3. Confirm the admission probe admits the new runtime and still refuses the next unverified line.
4. Say the change in the changelog and in both READMEs, including the new floor.

## What the bundle patch may contain

`cordis.patch.yml` is applied on top of the profile's existing layers, so it must stay additive: it pins `web.searchProvider` for the `web` seam and inserts the `web-search-anysearch` row. A user layer applied later still wins, which is what keeps the config-file switch in [README.md](./README.md#configuration) working.

The inserted row id is load-bearing beyond the profile: the browser half keys its `plugins.row.config` registration as `<package name>#<row id>`, and the page resolves the row's form by the bare row id. Renaming the row means changing both, and a profile that already declares a row with the same id fails to load.
