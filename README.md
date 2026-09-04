# dsh-web-search-anysearch

An [AnySearch](https://www.anysearch.com) web search provider for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/DeepSeek-Harness), with an explicit switch between the official DeepSeek search endpoint and AnySearch — editable from the Web GUI as a card on the Plugins settings page, exactly like dsh's built-in plugin cards.

dsh exposes one model-facing `web_search` tool and picks the real backend through the `ctx.web` seam. This bundle registers a switch provider under the `anysearch` id that calls `POST https://api.anysearch.com/v1/search` when AnySearch is selected, and delegates to the official DeepSeek search endpoint when it is not. Anonymous AnySearch access is allowed; an API key raises the rate limit.

## Compatibility

Tested against dsh v0.1.2-alpha.1 ~ alpha.5 and v0.1.2-rc.1 (the host `ctx.web` contract is identical across the six tags; the CI matrix verifies each one).

## Install

Requires a DSH install whose `web` profile has been initialized (start the Web GUI once). From the plugin checkout:

```sh
dsh plugin --profile web add .
```

Once published to npm, the same install works from the registry:

```sh
dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch
```

`dsh` links the checkout, appends the bundle layer to `dsh.profile.bundles`, and applies `cordis.patch.yml`, which registers the provider row **and pins `web.searchProvider: anysearch`** (later patch layers still win, so a deployment that pins its own value keeps it). **Restart `dsh web`** to pick up bundle layers. Inspect before restarting:

```sh
dsh --profile web --dump-config
```

Migration: if your profile patch already has a manual `web-search-anysearch` row (for example the `./anysearch-search.mjs` setup), delete that row first - the bundle layer adds the same row id, and duplicate ids fail the load.

## Switch the search service from the GUI

Open **设置 → 插件 → 插件配置 → AnySearch 搜索服务**. The card's first control is the switch; saving it re-routes the very next `web_search` — no restart needed:

- **AnySearch** (default) - calls `POST {base}/v1/search` with the card's API key / endpoint fields.
- **官方 DeepSeek 搜索** - delegates to the built-in DeepSeek search path. Its key, endpoint, model, and budget stay configured by dsh's own **Web search** (DeepSeek) card; the switch just selects that backend.

The API key written on the card goes through the credentials domain (`ANYSEARCH_API_KEY` by default, resolved via `$DSH_HOME/.credentials.yaml` > `$DSH_HOME/.env` > the inherited environment), never into the settings file. Anonymous requests are equally allowed.

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
- The switch card appears only when the dsh web GUI is composed with this plugin (browser half via `dsh.client`); headless profiles keep full functionality through the config-file switch.
- When the official backend is selected, its availability follows the built-in DeepSeek search settings (a key and a valid endpoint are required); AnySearch remains anonymous-friendly.
- A search query is sent to `https://api.anysearch.com` (override with `ANYSEARCH_API_BASE_URL` or the card's endpoint field); treat results as untrusted external data.

## License

MIT
