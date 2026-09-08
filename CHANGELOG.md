# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Changed

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
  as before. CI now runs the full matrix — v0.1.2-alpha.1 ~ alpha.5, rc.1 and
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

[0.1.2-rc.1]: https://github.com/VinciBeans/dsh-web-search-anysearch/releases/tag/v0.1.2-rc.1
