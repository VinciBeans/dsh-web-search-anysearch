/**
 * Register a switch-backed web search provider in `ctx.web`, plus the
 * `web-search-anysearch` settings section the Plugins page's card edits.
 *
 * The card's switch names the backend — AnySearch (`POST {base}/v1/search`,
 * key optional) or the official DeepSeek search endpoint. Because the seam's
 * `web.searchProvider` pin is fixed at launch, this plugin registers under the
 * `anysearch` id and routes each search to the backend the section names;
 * switching takes effect on the card's save, no re-registration involved.
 * @module @wenqi_bian/dsh-web-search-anysearch
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-web'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { readCredential, readEnv } from './env.ts'
import {
  AnySearchProvider,
  ANYSEARCH_DEFAULT_API_KEY_ENV,
  ANYSEARCH_DEFAULT_BASE_URL,
  ANYSEARCH_PROVIDER_ID,
} from './provider.ts'
import type { AnySearchProviderOptions } from './provider.ts'
import {
  AnySearchSwitchProvider,
  ANYSEARCH_BACKEND_ANYSEARCH,
} from './router.ts'
import type { SearchBackend } from './router.ts'
import { createDeepSeekBackend } from './official.ts'
import { installSection } from './section.ts'

export {
  AnySearchProvider,
  ANYSEARCH_DEFAULT_API_KEY_ENV,
  ANYSEARCH_DEFAULT_BASE_URL,
  ANYSEARCH_PROVIDER_ID,
} from './provider.ts'
export type { AnySearchProviderOptions } from './provider.ts'
export {
  AnySearchSwitchProvider,
  ANYSEARCH_BACKEND_ANYSEARCH,
  ANYSEARCH_BACKEND_DEEPSEEK,
} from './router.ts'
export type { SearchBackend } from './router.ts'
export {
  createDeepSeekBackend,
  DEEPSEEK_FALLBACK_DEFAULTS,
  DEEPSEEK_SEARCH_SETTINGS_NAMESPACE,
} from './official.ts'
export { WEB_PROVIDER_ERROR, webError } from './errors.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-anysearch'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Settings namespace carrying this plugin's switch and AnySearch endpoint. */
export const WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE = 'web-search-anysearch'

/** Environment variable naming this provider's endpoint, mirroring the vendor CLI. */
const BASE_URL_ENV = 'ANYSEARCH_API_BASE_URL'

/** Plugin config (all optional - `apply` fills env-var and constant defaults). */
export interface Config {
  /**
   * Which backend serves `web_search`: `anysearch` (default) or the official
   * `deepseek-official` endpoint. The card's switch writes this field.
   */
  searchProvider?: SearchBackend
  /** Literal AnySearch API key; prefer {@link apiKeyEnv} so no secret enters configuration files. */
  apiKey?: string
  /** Credential reference resolved for each search; defaults to `ANYSEARCH_API_KEY`. */
  apiKeyEnv?: string
  /** AnySearch endpoint base; `/v1/search` is appended. Defaults to the public API. */
  baseURL?: string
}

export const Config: z<Config> = z.object({
  searchProvider: z.union(['anysearch', 'deepseek-official'] as const).default(ANYSEARCH_BACKEND_ANYSEARCH),
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(ANYSEARCH_DEFAULT_API_KEY_ENV),
  baseURL: z.string(),
})

/** The switch value currently in force, normalized for the router. */
function currentBackend(config: Config): SearchBackend {
  return config.searchProvider ?? ANYSEARCH_BACKEND_ANYSEARCH
}

/**
 * Project the current AnySearch section into the options the provider serves
 * its next search with. Environment fallbacks stay here rather than in the
 * provider: every value it reads is already fully defaulted.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one AnySearch operation.
 */
function resolveAnySearchOptions(ctx: Context, config: Config): AnySearchProviderOptions {
  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? ANYSEARCH_DEFAULT_API_KEY_ENV)
  return {
    ...config.apiKey !== undefined && config.apiKey.length > 0 ? { apiKey: config.apiKey } : {},
    resolveApiKey: () => readCredential(ctx, apiKeyEnv),
    apiKeyEnv,
    baseURL: config.baseURL ?? readEnv(ctx, BASE_URL_ENV) ?? ANYSEARCH_DEFAULT_BASE_URL,
  }
}

/**
 * Register the switch provider with `ctx.web` and the settings section the
 * Plugins page's card edits. Each operation reads the section's current
 * switch, so a saved card change is live without re-registering.
 * @param ctx - plugin context.
 * @param config - the composition entry of this plugin's row.
 */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  installSection(ctx, WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = source
    },
    // The switch and the AnySearch section are read per search, so a committed
    // change needs nothing except a newer read.
    onChange: () => {},
  })
  ctx.web.registerSearchProvider(new AnySearchSwitchProvider(
    new AnySearchProvider(() => resolveAnySearchOptions(ctx, current())),
    createDeepSeekBackend(ctx),
    () => currentBackend(current()),
  ))
}
