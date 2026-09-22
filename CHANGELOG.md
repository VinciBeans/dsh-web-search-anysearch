# Changelog

All notable changes to this project are documented here.

## [0.1.7-alpha.2] - 2026-09-22

Compatibility range narrowed to **dsh `v0.1.5-alpha.1` and later**. (dsh never
published a `0.1.4`: the lineage runs `0.1.3-alpha.2` → `0.1.5-alpha.1`.)

### Changed

- **Peer ranges are now `^0.1.5-alpha.1 || ^0.1.6-alpha.2 || ^0.1.7-alpha.1`.** The
  `0.1.2` line and `0.1.3-alpha.2` are no longer accepted by any
  `@deepseek-ai/dsh-*` peer (`@deepseek-ai/cordis` stays `^4.0.1`, satisfied by
  the vendored `4.0.2`).
- **The 0.1.2 line's settings installer is gone from the code.** That line
  exposed `installSettingsSection` as a free function on the
  `@deepseek-ai/dsh-settings` module; from `0.1.5-alpha.1` onward the installer
  is always the settings service's own method, so
  `src/section.ts` no longer imports the module namespace, carries the
  `LegacySettingsModule` branch, or reads the export through a cast. What remains
  is the one installer shape the whole supported range uses, with a release that
  has none (`0.1.7` and later) still falling back to its composition entry.
- **The CI matrix now verifies every release from the floor**: `dsh-v0.1.5-alpha.1`,
  `dsh-v0.1.5-alpha.2`, `dsh-v0.1.5-rc.1`, `dsh-v0.1.5-rc.2` (the last three were
  not previously covered), `dsh-v0.1.6-alpha.2` and `dsh-v0.1.7-alpha.1`. The
  `0.1.2` and `0.1.3` legs are removed, which also retires the oldest-leg test
  double whose mock could not reproduce that line's `ctx.inject` attach.
- **Both READMEs state the new floor**, and the support policy now names
  `0.1.5-alpha.1` as the lower bound rather than describing 0.1.2 as legacy
  within the range. The published `0.1.2-rc.1` (npm `latest`) and `0.1.3-alpha.2`
  (npm `alpha`) builds remain the ones to pin below the floor; they do not carry
  this range's changes.

### Verified

- `typecheck`, `build` and 24/24 tests pass against freshly built
  `0.1.7-alpha.1` harness artifacts, and against every leg of the narrowed
  matrix on CI.

## [0.1.7-alpha.1] - 2026-09-21

Version aligned with the harness release this build is verified against
(`dsh-v0.1.7-alpha.1`, pin `c36a83ff6b`), following the sibling plugins'
convention of naming each release after the dsh tag it targets.

This release needed real adaptation on both halves: 0.1.7 rebuilt the settings
seam on the host side and the Plugins page on the browser side.

### Fixed

- **The host half reads live config again — it had been frozen at the values
  `apply` received.** 0.1.7 deleted `ctx.settings.installSection`, the call the
  plugin used to swap its composition entry for the settings document's resolved
  section, and replaced it with Volatile config references: a schema field
  marked `.volatile()` arrives in `apply` as a stable reference whose `get()`
  returns the current value, and the framework commits a profile edit into that
  reference in place. The plugin now marks every field volatile where the
  installed builder supports it and reads each field AT THE MOMENT IT IS USED —
  unwrapping once at `apply` time, as the first cut did, would have snapshotted
  the composition values and never seen an edit.
- **The browser half boots again on 0.1.7, and registers where its page
  dispatches.** `ctx.settingsScope` was removed (renamed `configForms`), and
  because it stayed in the static `inject` list the whole browser half hung
  pending — which the client boot audit turns into a failed web boot, not the
  silent no-op of the previous break. The plugin no longer declares a
  version-specific settings service at all: the page that owns the form passes
  it down as owner props, and the pre-0.1.7 pages are reached through a runtime
  service lookup (`ctx.get`) that cannot make the boot audit fail. The card
  registers into `plugins.row.config` keyed `<package>#<row id>` — the key
  0.1.7's page dispatches a row's configuration by — and the row page supplies
  `form.state` and `form.mutate`, so the card submits every staged field through
  the Host's revision-fenced write queue.
- **The official DeepSeek delegation reads that plugin's live entry.** It used
  `ctx.settings.get('web-search-deepseek')`, a reader that no longer exists.
  It now reads the row's resolved config from the loader (`options.id` +
  `fiber.config`), which works on every supported release and follows a
  committed edit, and falls back to the settings service where one still exists.

### Changed

- **Peer ranges cover the 0.1.7 line.** `^0.1.6-alpha.2` does not satisfy
  `0.1.7-alpha.1` under npm's prerelease semantics, so every `@deepseek-ai/dsh-*`
  peer now reads
  `^0.1.2-alpha.1 || ^0.1.3-alpha.1 || ^0.1.5-alpha.1 || ^0.1.6-alpha.2 || ^0.1.7-alpha.1`.
- **The section installer is feature-detected rather than assumed.** A release
  with neither `ctx.settings.installSection` nor the alpha-era
  `installSettingsSection` registers nothing, and the live config reference is
  the authoritative source. `.volatile()` itself is probed too, because it
  arrived in schemastery 3.18.3 (shipped by 0.1.7) and calling it on 3.18.2
  would not compile a schema at all.

### Verified

- **dsh v0.1.7-alpha.1** (pin `c36a83ff6b`), against freshly built harness type
  artifacts. `typecheck`, `build` and **24/24 tests** pass. Three of those run
  against the real dsh service stack rather than doubles, including the two that
  matter here: a composed plugin serves AnySearch from its config, and
  committing a new value into the entry's live reference re-routes the next
  search with no re-registration — the test writes through the framework's own
  Volatile protocol, so it exercises the mechanism the profile editor uses.
- The bundle/loader chain is unchanged: `dsh.bundle.patch` is still honored in
  the same layer order (0.1.7 only widened it to `string | string[]`),
  `dsh.profile.bundles` keeps its shape, the new `web-app/presets/*.patch.yml`
  are that bundle's own extra patches rather than a profile concept, and
  `dsh.client` plus the `window.__ModuleLoader__.load({id, factory})` boot
  contract are byte-identical. `web.searchProvider` / `fetchProvider` still pin
  the seam, so `cordis.patch.yml` needs no change.

## [0.1.6-alpha.2] - 2026-09-18

Version aligned with the harness release this build is verified against
(`dsh-v0.1.6-alpha.2`, pin `ddefc45fbc`), following the sibling plugins'
convention of naming each release after the dsh tag it targets.

### Fixed

- **The GUI card registers again on dsh v0.1.6-alpha.2 — and it was failing
  silently.** That release rebuilt the Plugins page: `ui-settings-plugins`
  deleted `ConfigurablePluginsTab.tsx`, the only declarer of the
  `settings.plugin.item` slot, and moved per-plugin configuration to the new
  `@deepseek-ai/dsh-client-ui-plugin-manager` page, which dispatches a bundle's
  own configuration through `plugins.bundle.config` (keyed by the bundle's
  package name) and a bundle row's through `plugins.row.config` (keyed
  `<package>#<rowId>`). Because `slots.inject` runs its callback only once the
  slot is declared, the card simply never mounted — no error, no log line. The
  browser half now registers into `plugins.bundle.config` keyed by
  `@wenqi_bian/dsh-web-search-anysearch`, **and** keeps the
  `settings.plugin.item` registration: a slot the deployment does not declare is
  never injected, so one build serves both page generations.
- **The card renders the view the page asks for, and owns its own save
  control.** The 0.1.6 page passes `{ view: 'summary' | 'page' }`: `summary` is
  the one-liner beside the title, and `page` is the configuration body. The page
  mounts an entry as a bare `<section data-plugin-config>`, and the form chrome
  that wraps the *shipped* cards (`PluginConfigForm`) is internal to
  `@deepseek-ai/dsh-client-ui-settings-plugins`, which is not a module-table
  seed — so a third-party entry has to render its own read-only notice, failure
  line and save button, and to drop its staged edits on unmount (the page offers
  no discard gesture). It does. The pre-0.1.6 card, which declares no view, keeps
  its disclosure chrome and its save/discard footer.

### Changed

- **Peer ranges cover the 0.1.6 line.** `^0.1.5-alpha.1` does not satisfy
  `0.1.6-alpha.2` under npm's prerelease semantics, so every `@deepseek-ai/dsh-*`
  peer now reads `^0.1.2-alpha.1 || ^0.1.3-alpha.1 || ^0.1.5-alpha.1 || ^0.1.6-alpha.2`.
- **The bundle's package name is now a named constant** (`ANYSEARCH_PACKAGE_NAME`)
  because `plugins.bundle.config` dispatches by it: it must keep matching the
  `dsh.profile.bundles` entry the install writes.

### Verified

- **dsh v0.1.6-alpha.2** (pin `ddefc45fbc`). A contract-surface review of
  v0.1.5-alpha.1 → v0.1.6-alpha.2 found the **host half untouched**: `ctx.web`
  and its provider contract changed by a package.json version bump only; so did
  credentials, settings, `launch-environment`, and the DeepSeek search provider
  (only its endpoint doc comments changed); `settings.installSection`,
  `settingsScope.bind`/`getSnapshot`/`subscribe`/`set`/`unset`,
  `credentials/reference-updated`, `ui-slots`' register/inject/getVersion/subscribe
  and the `dsh.client` `__ModuleLoader__.load({id, factory})` boot contract are
  unchanged. The client **page** contract is the one that moved, as above.
  `typecheck`, `build` and all 21 tests pass against the 0.1.6-alpha.2 artifacts,
  and CI adds the tag to the matrix.

## [0.1.5-alpha.1] - 2026-09-09

Version aligned with the harness release this build is verified against
(`dsh-v0.1.5-alpha.1`, pin `5dda764ed3`), following the sibling plugins'
convention of naming each release after the dsh tag it targets.

### Verified

- **dsh v0.1.5-alpha.1** (pin `5dda764ed3`). A contract-surface review of
  v0.1.3-alpha.2 → v0.1.5-alpha.1 found every consumed piece unchanged or
  additively extended: the `ctx.web` seam, settings `installSection`,
  credentials, `launchEnvironmentOf`, the DeepSeek search provider,
  `settings.plugin.item`, `settingsScope`, locale and the `dsh.client`
  boot/manifest contract are untouched; the client module table gained
  `@deepseek-ai/dsh-client-ui-dockkit`, `ui-slots` gained an unrelated
  `ResourceProtocolMap` interface, and the client-modules service made its
  `webServer` inject optional (shell-carrier refactor). No code change was
  needed; typecheck, build and all tests pass locally against a 0.1.5-era
  harness, and CI adds the tag to the matrix.

### Changed

- **Peer ranges cover the 0.1.5 line.** `^0.1.2-alpha.1 || ^0.1.3-alpha.1` does
  not satisfy `0.1.5-alpha.1` under npm's prerelease semantics, so every
  `@deepseek-ai/dsh-*` peer now reads
  `^0.1.2-alpha.1 || ^0.1.3-alpha.1 || ^0.1.5-alpha.1`.

### Deprecated

- **The dsh 0.1.2 line (`v0.1.2-alpha.1` ~ `v0.1.2-rc.1`) is legacy.** The code
  still supports it — the alpha-era settings installer shape, the `^0.1.2-alpha.1`
  peer ranges and the CI matrix legs all stay — but subsequent releases drop
  0.1.2 support: if a future dsh version breaks a consumed contract on that
  line, this plugin will not be adapted for 0.1.2 again, and the published
  0.1.2 releases stay frozen. Both READMEs state the policy.

## [0.1.3-alpha.2] - 2026-09-04

Version aligned with the harness release this build is verified against
(`dsh-v0.1.3-alpha.2`, pin `82a5fd61a7`), following the sibling plugins'
convention of naming each release after the dsh tag it targets.

### Changed

- **Peer ranges cover the 0.1.3 line.** `^0.1.2-alpha.1` does not satisfy
  `0.1.3-alpha.2` under npm's prerelease semantics, so every `@deepseek-ai/dsh-*`
  peer now reads `^0.1.2-alpha.1 || ^0.1.3-alpha.1` (the `@deepseek-ai/cordis`
  peer stays `^4.0.1`, satisfied by the vendored `4.0.2`).
- **The official DeepSeek provider is now an optional, lazily loaded peer.**
  `@deepseek-ai/dsh-web-search-deepseek` moved from a static import to a
  dynamic import on first use, and its `peerDependenciesMeta.optional` flag is
  set. A deployment without the built-in plugin keeps loading this one and
  serving AnySearch; the official side reports unavailable and a direct search
  fails with a descriptive error. The fallback defaults mirror the package's
  exported constants, and a guard test asserts they match.
- **Environment and credential access is now one module** (`src/env.ts`), shared
  by the AnySearch and official projections, and `WebError` construction is one
  factory (`src/errors.ts`).
- **The `x-anysearch-client` version is injected at build time** from
  `package.json` instead of being hardcoded, so the header cannot drift from
  the published version.
- **Guard tests** assert the cross-plugin settings namespace, the default
  mirrors, the provider/backend ids and the client bundle's registration
  contract against the installed dsh on every matrix leg.

### Verified

- **dsh v0.1.3-alpha.2** (pin `82a5fd61a7`). No code change was needed: a
  contract-surface review of v0.1.2-rc.1 → v0.1.3-alpha.2 found the consumed
  pieces unchanged (`ctx.web` seam and provider contract, settings
  `installSection`, credentials, launch-environment, the DeepSeek search
  provider and its options, the `dsh.client` boot/manifest contract, the
  `settings.plugin.item` slot, `settingsScope`, locale and the client module
  table; only the `dsh.client` declaration types moved to
  `@deepseek-ai/dsh-package-manifest`, and the built-in cards switched their
  badges to the `Tag` primitive). The base bundle still pins
  `web.searchProvider: deepseek-official`, so the bundle-patch override applies
  as before. CI runs the full matrix — v0.1.2-alpha.1 ~ alpha.5, rc.1 and
  v0.1.3-alpha.2 — green.

## [0.1.2-rc.1] - 2026-09-04

First release of the switch-card build. The version tracks the dsh release
it is verified against (v0.1.2-alpha.1 ~ rc.1).

### Added

- **Plugins settings card (browser half).** The switch and the AnySearch
  configuration now live on the dsh Plugins page as a card
  (设置 → 插件 → 插件配置 → AnySearch 搜索服务), exactly like the built-in
  plugin cards. The browser half ships through
  `dsh.client` + `exports["./client"]`, so any dsh web GUI composed with this
  plugin picks it up; headless profiles keep full functionality via config.
- **Switch provider (host half).** Because the seam's `web.searchProvider` pin
  is fixed at launch, the plugin registers under the `anysearch` id and routes
  each search to the backend the card's section names — `anysearch` by default,
  or the official DeepSeek search endpoint. A saved switch re-routes the very
  next `web_search`; no restart, no re-registration.
- **Official DeepSeek delegation.** Options are projected per search from the
  built-in `web-search-deepseek` settings section when that plugin is composed
  (key, endpoint, model, budget), falling back to `DEEPSEEK_SEARCH_BASE_URL` /
  `DEEPSEEK_API_KEY` and the provider defaults — so the built-in DeepSeek
  search card stays the single place that configures the official side.
- **`web-search-anysearch` settings namespace.** Installed through whichever
  settings-seam shape the installed dsh provides (`ctx.settings.installSection`
  on rc.1, `installSettingsSection` on alpha.1 ~ alpha.5); without the
  settings service the plugin keeps running from its composition entry.
- **Auto-pin in the bundle patch.** `cordis.patch.yml` now pins
  `web.searchProvider: anysearch` as well as registering the provider row;
  later patch layers still win.
- **Credential-safe key entry.** The card writes the AnySearch key through the
  credentials domain (`ANYSEARCH_API_KEY` reference), never into the settings
  file, with a configured/unconfigured badge and write-only control.
- **zh/en locales** for the card.

### Changed

- `AnySearchProvider` now accepts its options either as a value or as a thunk
  (resolved per operation), so section edits are live without re-registration.
- Build now emits both the host bundle (`lib/index.js`) and the client bundle
  (`lib/client.js`); `exports["./client"]` added.

[0.1.7-alpha.2]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.7-alpha.2
[0.1.7-alpha.1]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.7-alpha.1
[0.1.6-alpha.2]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.6-alpha.2
[0.1.5-alpha.1]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.5-alpha.1
[0.1.3-alpha.2]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.3-alpha.2
[0.1.2-rc.1]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.2-rc.1
