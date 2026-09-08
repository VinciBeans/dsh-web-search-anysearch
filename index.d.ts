/**
 * @wenqi_bian/dsh-web-search-anysearch - host half typings.
 *
 * A DSH plugin package; consumers install it with `dsh plugin add` rather
 * than importing it. The declarations cover the host entry surface and the
 * constants tests and docs reuse.
 */

/** Backend values the switch names. */
export type SearchBackend = 'anysearch' | 'deepseek-official'

/** Plugin entry config (all optional - environment and constant defaults fill the rest). */
export interface Config {
  /**
   * Which backend serves `web_search`: `anysearch` (default) or the official
   * `deepseek-official` endpoint. The Plugins settings card's switch writes it.
   */
  searchProvider?: SearchBackend
  /** Literal AnySearch API key; prefer `apiKeyEnv` so no secret enters configuration files. */
  apiKey?: string
  /** Credential reference (environment-variable name) resolved for each search; default `ANYSEARCH_API_KEY`. */
  apiKeyEnv?: string
  /** AnySearch endpoint base; `/v1/search` is appended. Defaults to the public API. */
  baseURL?: string
}

/** Cordis plugin id. */
export declare const name: 'web-search-anysearch'

/** Stable provider id; the bundle patch pins `web.searchProvider` to it. */
export declare const ANYSEARCH_PROVIDER_ID: 'anysearch'

/** Public AnySearch endpoint. */
export declare const ANYSEARCH_DEFAULT_BASE_URL: 'https://api.anysearch.com'

/** Default credential reference. */
export declare const ANYSEARCH_DEFAULT_API_KEY_ENV: 'ANYSEARCH_API_KEY'

/** Settings namespace the Plugins settings card edits. */
export declare const WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE: 'web-search-anysearch'

/** Default backend of the switch. */
export declare const ANYSEARCH_BACKEND_ANYSEARCH: 'anysearch'

/** The official DeepSeek backend of the switch. */
export declare const ANYSEARCH_BACKEND_DEEPSEEK: 'deepseek-official'

/** Settings namespace of the built-in DeepSeek search provider (read for the official backend). */
export declare const DEEPSEEK_SEARCH_SETTINGS_NAMESPACE: 'web-search-deepseek'

/** Local default mirrors used when the optional official package exports no constants. */
export declare const DEEPSEEK_FALLBACK_DEFAULTS: {
  baseURL: string
  model: string
  apiVersion: string
  maxTokens: number
  maxUses: number
}

/** Transport/provider failure code the plugin reports. */
export declare const WEB_PROVIDER_ERROR: 'WEB_PROVIDER_ERROR'

/** Build the seam error for a provider or transport failure. */
export declare function webError(message: string): Error

/**
 * Build the official backend the switch router delegates to. The optional
 * `@deepseek-ai/dsh-web-search-deepseek` peer loads on demand; when it cannot
 * be loaded, `available()` is false and a direct search rejects descriptively.
 */
export declare function createDeepSeekBackend(ctx: unknown): {
  available(): boolean
  search(request: unknown, signal?: AbortSignal): Promise<unknown>
}

/** Schemastery config schema (validated by the DSH loader). */
export declare const Config: unknown

/** Cordis plugin activation. */
export declare function apply(ctx: unknown, config: Config): void
