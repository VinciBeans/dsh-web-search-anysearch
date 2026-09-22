# dsh-web-search-anysearch

An [AnySearch](https://www.anysearch.com) web search provider for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/DeepSeek-Harness), with an explicit switch between the official DeepSeek search endpoint and AnySearch — editable from the Web GUI as a card on the Plugins settings page, exactly like dsh's built-in plugin cards.

dsh exposes one model-facing `web_search` tool and picks the real backend through the `ctx.web` seam. This bundle registers a switch provider under the `anysearch` id that calls `POST https://api.anysearch.com/v1/search` when AnySearch is selected, and delegates to the official DeepSeek search endpoint when it is not. Anonymous AnySearch access is allowed; an API key raises the rate limit.

## Compatibility

Tested against dsh v0.1.2-alpha.1 ~ alpha.5, v0.1.2-rc.1, v0.1.3-alpha.2, v0.1.5-alpha.1, v0.1.6-alpha.2 and v0.1.7-alpha.1 (ten tags; the CI matrix verifies each one). Nothing this plugin consumes changed across the 0.1.2 ~ 0.1.5 tags, so those legs verify the promise rather than cover a difference. `0.1.6-alpha.2` rebuilt the Plugins page and `0.1.7-alpha.1` rebuilt both the page and the settings seam: see [Settings and page generations](#settings-and-page-generations).

### Settings and page generations

Two contracts this plugin consumes were rebuilt after 0.1.5, and each release carries exactly one shape. The plugin detects which, so one build serves the whole range.

**The settings seam.** Up to `0.1.6-alpha.2`, a plugin registered its configuration with `ctx.settings.installSection(...)` and read it through the scope that came back. `0.1.7-alpha.1` removed that call: a schema field marked `.volatile()` is handed to `apply` as a stable reference whose `get()` returns the live value, and the framework commits a profile edit into that reference instead of remounting the plugin. This plugin's schema marks every field volatile where the installed schema builder supports it (`.volatile()` arrived in schemastery 3.18.3, which 0.1.7 is the first release to ship), reads fields through either shape, and registers a section only where an installer still exists. Its "official DeepSeek search" delegation likewise reads that plugin's entry from the loader (its live config) and falls back to the settings service on releases that lack one.

**The Plugins page.** `0.1.6-alpha.2` replaced the card list with a page that dispatches a bundle's own configuration; `0.1.7-alpha.1` moved that to a per-row page and hands the entry's values and write command to the card as owner props. The browser half registers into all three slots it has known — `plugins.row.config` (keyed `<package>#<row id>`, what 0.1.7 asks for, with the page supplying the form), `plugins.bundle.config` (keyed by package name, 0.1.6), and `settings.plugin.item` (pre-0.1.6) — and a slot a deployment's page does not declare is simply never injected. So the card appears on this row's page on 0.1.7, on the bundle's page on 0.1.6, and in **设置 → 插件 → 插件配置** on 0.1.5 and older.

The host half's routing, the `cordis.patch.yml` pin and the credentials handling are unchanged across the whole range.

### Support policy

The **0.1.2 line (`v0.1.2-alpha.1` ~ `v0.1.2-rc.1`) is legacy.** This code still supports it and the CI matrix still verifies those tags, but that support ends here: **subsequent releases drop the 0.1.2 line.** If a later dsh version changes a consumed contract in a way that breaks 0.1.2, this plugin will not be adapted for 0.1.2 again — the published 0.1.2 releases stay frozen as they are. If your harness is pinned to that line, stay on `0.1.2-rc.1` (npm `latest`) or `0.1.3-alpha.2` (npm `alpha`).

## Install

Releases are version-aligned with the harness: each version is built for, and named after, the matching `@deepseek-ai/dsh` release.

Requires a DSH install whose `web` profile has been initialized (start the Web GUI once).

### From npm

Pick the dist-tag that matches your harness:

1. **npm `alpha`** (`0.1.3-alpha.2`) — the current npm build; compatible with dsh v0.1.2-alpha.1 ~ v0.1.3-alpha.2 (0.1.2 support is legacy, see above):

   ```bash
   dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@alpha
   ```

2. **npm `latest`** (`0.1.2-rc.1`) — the legacy 0.1.2 line, frozen; compatible with dsh v0.1.2-alpha.1 ~ rc.1:

   ```bash
   dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch
   ```

The npm package ships the prebuilt host and client bundles, so no build step is needed on install.

### From source

The source version — `0.1.7-alpha.1`, what the GitHub Release `v0.1.7-alpha.1` ships — is for local development:

```bash
dsh plugin --profile web add .
```

`dsh` links the checkout, appends the bundle layer to `dsh.profile.bundles`, and applies `cordis.patch.yml`, which registers the provider row **and pins `web.searchProvider: anysearch`** (later patch layers still win, so a deployment that pins its own value keeps it). Rebuild after any code change with `npm run build`. On 0.1.6 and later the Plugins page renders a configuration only for a bundle the profile lists, so install it as a bundle rather than adding a composition row by hand. **Restart `dsh web`** to pick up bundle layers and the served client bundle. Inspect before restarting:

```sh
dsh --profile web --dump-config
```

Migration: if your profile patch already has a manual `web-search-anysearch` row (for example the `./anysearch-search.mjs` setup), delete that row first - the bundle layer adds the same row id, and duplicate ids fail the load.

## Switch the search service from the GUI

On dsh `0.1.7-alpha.1`, open **设置 → 插件 → `@wenqi_bian/dsh-web-search-anysearch` → the `web-search-anysearch` row** — the row's page carries the configuration. On `0.1.6-alpha.2`, open **设置 → 插件 → `@wenqi_bian/dsh-web-search-anysearch`** (the bundle's own page). On `0.1.5-alpha.1` and older, open **设置 → 插件 → 插件配置 → AnySearch 搜索服务**. Either way the form's first control is the switch; saving it re-routes the very next `web_search` — no restart needed:

- **AnySearch** (default) - calls `POST {base}/v1/search` with the card's API key / endpoint fields.
- **官方 DeepSeek 搜索** - delegates to the built-in DeepSeek search path. Its key, endpoint, model, and budget stay configured by dsh's own **Web search** (DeepSeek) card; the switch just selects that backend.

The **API key** field on the form feeds the entry's `apiKey`; leave it blank and the provider resolves `apiKeyEnv` (`ANYSEARCH_API_KEY` by default) through the credentials domain instead. See the Known limitations note on how a typed key is persisted.

## Fallback ways to switch (config file, still honored)

Later layers win, and the bundle pins `anysearch` only; anything below overrides it for a whole launch:

1. **Profile patch line** - edit `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- id: web
  config:
    searchProvider: anysearch          # or deepseek-official
    fetchProvider: http                # the patch replaces the whole config
```

2. **One-shot overlay** (no file edit of the profile):

```sh
dsh web --patch examples/use-anysearch.cordis.yml
dsh web --patch examples/use-deepseek-official.cordis.yml
```

3. **Environment variable** for a whole launch:

```sh
DSH_WEB_SEARCH_PROVIDER=anysearch dsh web
```

The seam still requires an explicit pin when more than one usable provider is registered; configuration errors surface as `WEB_PROVIDER_CONFIGURED_MISSING` / `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`. The switch card edits the `web-search-anysearch` settings namespace, so a profile- or env-level pin of a different provider (for example `exa`) takes the card entirely out of the serving path.

## Known limitations

- **General search only.** The dsh seam request carries `query` and `maxResults`; AnySearch vertical domains (`finance.quote` etc.), their required params, `zone`/`language`, and the `/v1/extract` endpoint are not reachable through `web_search`.
- The configuration form appears only when the dsh web GUI is composed with this plugin (browser half via `dsh.client`) **and** this bundle is in the profile's `dsh.profile.bundles` — from 0.1.6 the form belongs to the bundle's or the row's page, so a profile that only lists the row without the bundle shows no form. Headless profiles keep full functionality through the config-file switch.
- On `0.1.7-alpha.1`, a config edit committed from the profile editor reaches the running plugin through its Volatile reference and re-routes the next `web_search` without a restart. A field the schema builder could not mark volatile (schemastery < 3.18.3, i.e. dsh ≤ 0.1.6) is resolved through the settings section instead, as before.
- When the official backend is selected, its availability follows the built-in DeepSeek search settings (a key and a valid endpoint are required); AnySearch remains anonymous-friendly. The built-in plugin `@deepseek-ai/dsh-web-search-deepseek` is an **optional peer**, loaded on demand: a deployment without it still loads this plugin and serves AnySearch, while the official side reports unavailable.
- The API key can be written two ways, and they persist differently. The **API key** field on the form is an ordinary config field of this profile entry, so a value typed there is saved into the profile patch (`config.apiKey`, redacted over the wire by its `secret` role). It is never required: leave it blank and the plugin resolves `apiKeyEnv` — `ANYSEARCH_API_KEY` by default — through the credentials domain (`$DSH_HOME/.credentials.yaml` > `$DSH_HOME/.env` > the inherited environment), which is the path to prefer. Anonymous requests are allowed either way.
- A search query is sent to `https://api.anysearch.com` (override with `ANYSEARCH_API_BASE_URL` or the card's endpoint field); treat results as untrusted external data.

## License

MIT
