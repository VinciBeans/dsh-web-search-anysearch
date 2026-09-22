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
import { configValueOf, installSection, volatileField } from './section.ts'
import type { ConfigRef } from './section.ts'

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
export {
  configValueOf,
  installSection,
  volatileField,
} from './section.ts'
export type { ConfigRef, SettingsSectionHooks } from './section.ts'

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

/**
 * The config object `apply` is called with: either plain {@link Config} values,
 * or — on dsh `0.1.7-alpha.1` and later — the same fields as stable config
 * references, because the schema marks them volatile. Every read goes through
 * {@link fieldOf}, at the moment the value is used, so one code path serves both
 * shapes and a committed edit is seen.
 */
export interface ConfigSource {
  /** Which backend serves `web_search`. */
  searchProvider?: ConfigRef<SearchBackend> | SearchBackend
  /** Literal AnySearch API key. */
  apiKey?: ConfigRef<string | undefined> | string
  /** Credential reference resolved for each search. */
  apiKeyEnv?: ConfigRef<string> | string
  /** AnySearch endpoint base. */
  baseURL?: ConfigRef<string | undefined> | string
}

/**
 * This plugin's config schema. Every field is marked volatile where the
 * installed builder supports it: on dsh `0.1.7-alpha.1` that is what publishes
 * the field to the derived configuration form and what makes a committed edit
 * arrive in `apply`'s references instead of remounting the plugin. On earlier
 * releases `volatileField` returns the schema unchanged and the settings
 * section registers through `installSection` instead.
 */
export const Config = z.object({
  searchProvider: volatileField(
    z.union(['anysearch', 'deepseek-official'] as const).default(ANYSEARCH_BACKEND_ANYSEARCH),
  ),
  apiKey: volatileField(z.string().role('secret')),
  apiKeyEnv: volatileField(
    z.string().role('credential-ref').default(ANYSEARCH_DEFAULT_API_KEY_ENV),
  ),
  baseURL: volatileField(z.string()),
})

/** Read one field of either config shape as a plain value. */
function fieldOf<T>(field: ConfigRef<T> | T | undefined): T | undefined {
  return configValueOf(field as ConfigRef<T> | undefined)
}

/**
 * Normalize either config shape into plain values.
 * @param source - the config object `apply` received.
 * @returns the resolved values, defaults left to the schema.
 */
export function resolveConfig(source: ConfigSource): Config {
  const searchProvider = fieldOf(source.searchProvider)
  const apiKey = fieldOf(source.apiKey)
  const apiKeyEnv = fieldOf(source.apiKeyEnv)
  const baseURL = fieldOf(source.baseURL)
  return {
    ...searchProvider !== undefined ? { searchProvider } : {},
    ...apiKey !== undefined ? { apiKey } : {},
    ...apiKeyEnv !== undefined ? { apiKeyEnv } : {},
    ...baseURL !== undefined ? { baseURL } : {},
  }
}

/** The switch value currently in force, read from the live source. */
function currentBackend(source: ConfigSource): SearchBackend {
  return fieldOf(source.searchProvider) ?? ANYSEARCH_BACKEND_ANYSEARCH
}

/**
 * Project the current AnySearch section into the options the provider serves
 * its next search with. Environment fallbacks stay here rather than in the
 * provider: every value it reads is already fully defaulted.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param source - the live config object, read now so a committed edit applies.
 * @returns options for one AnySearch operation.
 */
function resolveAnySearchOptions(ctx: Context, source: ConfigSource): AnySearchProviderOptions {
  const apiKey = fieldOf(source.apiKey)
  const apiKeyEnv = credentialRef(fieldOf(source.apiKeyEnv) ?? ANYSEARCH_DEFAULT_API_KEY_ENV)
  return {
    ...apiKey !== undefined && apiKey.length > 0 ? { apiKey } : {},
    resolveApiKey: () => readCredential(ctx, apiKeyEnv),
    apiKeyEnv,
    baseURL: fieldOf(source.baseURL) ?? readEnv(ctx, BASE_URL_ENV) ?? ANYSEARCH_DEFAULT_BASE_URL,
  }
}

/**
 * Register the switch provider with `ctx.web`, and the settings section where
 * the installed dsh still asks a plugin to register one.
 *
 * Two live-config mechanisms meet here, and each release has exactly one:
 *
 * - **dsh >= 0.1.7-alpha.1** hands `apply` Volatile config references that the
 *   framework updates IN PLACE when the profile changes. The config object is
 *   therefore kept as it arrived and every field is read at the moment it is
 *   used — unwrapping it once here would snapshot the composition values and
 *   never see a committed edit.
 * - **dsh 0.1.2-rc.1 ~ 0.1.6-alpha.2** registers the section through
 *   `ctx.settings.installSection`, which hands back the resolved scope through
 *   `setSource`. That scope is a plain object, so the same reads work on both.
 *
 * @param ctx - plugin context.
 * @param config - this plugin's row config, plain or reference-shaped.
 */
export function apply(ctx: Context, config: ConfigSource): void {
  let current: () => ConfigSource = () => config
  installSection(ctx, WEB_SEARCH_ANYSEARCH_SETTINGS_NAMESPACE, Config, config, {
    setSource: (source) => {
      current = () => source as ConfigSource
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
