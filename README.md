# AnySearch for DeepSeek Harness

Switch `web_search` between [AnySearch](https://www.anysearch.com) and the official DeepSeek search endpoint, from the dsh Plugins page.

[![npm version](https://img.shields.io/npm/v/@wenqi_bian/dsh-web-search-anysearch.svg)](https://www.npmjs.com/package/@wenqi_bian/dsh-web-search-anysearch)
[![license](https://img.shields.io/npm/l/@wenqi_bian/dsh-web-search-anysearch.svg)](./LICENSE)

dsh exposes one model-facing `web_search` tool and picks its backend through the `ctx.web` seam. This bundle registers a provider under the `anysearch` id: it calls `POST https://api.anysearch.com/v1/search` when AnySearch is selected, and delegates to the official DeepSeek search endpoint when it is not. Anonymous AnySearch access works; an API key raises the rate limit.

## Install

```bash
dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@alpha
```

Restart `dsh web` afterwards: profile bundles and the served browser half are read at startup. Inspect the composed tree without booting:

```bash
dsh --profile web --dump-config
```

Each plugin release carries the exact version of the dsh tag it targets and ships prebuilt host and browser halves. `alpha` tracks the current release; pin one exactly with `@wenqi_bian/dsh-web-search-anysearch@0.2.0-rc.2`. Hosts below the supported floor pin the frozen line explicitly: `dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@0.1.2-rc.1`.

Upgrading from a hand-written row: delete any existing `web-search-anysearch` entry from your profile patch before installing the bundle. The bundle adds the same row id, and duplicate ids fail the load.

## Quickstart

1. Open **Settings → Plugins → `@wenqi_bian/dsh-web-search-anysearch`**. The configuration is on that page; the same controls are also on the `web-search-anysearch` row inside it.
2. Leave the switch on **AnySearch**, or pick **official DeepSeek search**.
3. Save. The next `web_search` uses the backend you picked, with no restart.

AnySearch needs no credential. To raise its rate limit, type the key into the card's **API key** field, which stores it in the credentials domain, or put it there yourself under the `ANYSEARCH_API_KEY` reference (see [Configuration](#configuration)).

On dsh `0.1.7-alpha.1` and later, including `0.2.0`, both the bundle's own page and the row's page carry this form. On `0.1.6-alpha.2` it is the bundle's own page; on the `0.1.5` line it is **Settings → Plugins → Plugin configuration → AnySearch 搜索服务**.

## Compatibility

The supported range starts at dsh `v0.1.5-alpha.1`, and the CI matrix verifies every published release inside it: the five `0.1.5` tags (`alpha.1`, `alpha.2`, `rc.1`, `rc.2`, `rc.3`), `0.1.6-alpha.2`, the four `0.1.7` tags (`alpha.1`, `alpha.2`, `rc.1`, `rc.2`) and `0.2.0-rc.2`. Within the `0.2.0` line the floor is `v0.2.0-rc.2` itself: `v0.2.0-rc.1` is refused. The `0.1.2` line and `v0.1.3-alpha.2` are not supported: pin `0.1.3-alpha.2` or `0.1.2-rc.1` if your harness is older, and note that `v0.1.6-alpha.1` sits below the floor. dsh never published a `0.1.4`.

**The admission gate.** Since `v0.1.7-rc.1`, dsh reads a plugin's `@deepseek-ai/dsh-*` peer ranges before importing it and refuses a bundle, or blocks a row, whose ranges do not accept the running version. The declared range is the whole compatibility claim, so this package names each verified line: `^0.1.5-alpha.1 || ^0.1.6-alpha.2 || ^0.1.7-alpha.1 || ^0.2.0-rc.2`. The `0.2.0` line is where those ranges stopped covering the runtime, which is why `v0.2.0-rc.1` and `v0.2.0-rc.2` were refused before this release. A runtime outside the range is refused on purpose, with the incompatible peers printed and `dsh plugin allow-version` offered as the exact-version exemption.

Two contracts underneath that range have two shapes each, and this build detects which one is installed rather than branching on a version string:

- **Settings.** Through `0.1.6-alpha.2` a plugin registered its section with `ctx.settings.installSection(...)`. From `0.1.7-alpha.1` that call is gone: a schema field marked `.volatile()` reaches `apply` as a stable reference whose `get()` returns the live value, so a committed edit re-routes the next search instead of remounting the plugin.
- **Plugins page.** `0.1.6-alpha.2` renders a bundle's own configuration page; `0.1.7-alpha.1` and later render both that page and a row's page, where the entry's live values arrive as owner props. The browser half registers into all three slots this range has known and stays dormant where a deployment declares none. The bundle's own page supplies no form, so the card binds the namespace's configuration form itself (`ctx.configForms` on `0.1.7-alpha.1` and later, `ctx.settingsScope` before that); the row's page keeps using the form the page hands down.

## Configuration

| Config key | Control | Default | Meaning |
| --- | --- | --- | --- |
| `searchProvider` | Backend switch | `anysearch` | Which backend serves the next `web_search`: `anysearch` or `deepseek-official`. |
| `apiKeyEnv` | API key field | `ANYSEARCH_API_KEY` | Where the card stores a typed key, in the credentials domain. The reference is resolved per search. |
| `apiKey` | | unset | A literal key written into the profile by hand. It wins over the reference and is redacted over the wire by its `secret` role. |
| `baseURL` | Endpoint field | `https://api.anysearch.com` | AnySearch base; `/v1/search` is appended. Overridden by `ANYSEARCH_API_BASE_URL`. |

The credential domain resolves a reference in this order: `$DSH_HOME/.credentials.yaml`, then `$DSH_HOME/.env`, then the inherited environment. Leave both key fields unset to search anonymously.

The switch also has three non-GUI equivalents, and later layers win over the bundle's own pin of `web.searchProvider: anysearch`:

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: web
  config:
    searchProvider: anysearch          # or deepseek-official
    fetchProvider: http                # the patch replaces the whole config
```

```bash
dsh web --patch examples/use-deepseek-official.cordis.yml
DSH_WEB_SEARCH_PROVIDER=anysearch dsh web
```

Whichever layer pins it, a pin that names another provider (for example `exa`) takes this card out of the serving path entirely.

## Known limitations

- **General search only.** The seam request carries `query` and `maxResults`; AnySearch vertical domains (`finance.quote` and friends), their required params, `zone`/`language`, and `/v1/extract` are not reachable through `web_search`.
- The form appears only when the web GUI composes this plugin's browser half **and** the bundle is listed in the profile's `dsh.profile.bundles`. Headless profiles keep the full feature set through the config-file switch.
- The official backend follows the built-in DeepSeek search settings: a credential (`DEEPSEEK_API_KEY`, or a DeepSeek account sign-in on `0.2.0` and later) and a valid endpoint. The built-in plugin `@deepseek-ai/dsh-web-search-deepseek` is an optional peer, imported on first use; a deployment without it still serves AnySearch.
- The **API key** field is write-only: a typed key goes into the credentials domain under `apiKeyEnv`, and a stored secret is never read back into the form. There is no control that removes a stored key yet; revoke one in the credentials store or from the page that manages it.
- Queries are sent to `https://api.anysearch.com`, or to whatever endpoint you configure. Treat search results as untrusted external data.

## License

MIT

Contributor setup, the CI matrix, and the release convention live in [CONTRIBUTING.md](./CONTRIBUTING.md).
