/**
 * Official DeepSeek search delegation for the AnySearch switch card.
 *
 * The dsh `web` seam cannot be re-pinned at runtime, so this plugin registers
 * itself as the provider the seam picks (`searchProvider: anysearch`, see the
 * bundle patch) and routes each search to the backend the card's switch names:
 * AnySearch, or the official DeepSeek search endpoint.
 *
 * The official side is loaded from `@deepseek-ai/dsh-web-search-deepseek` on
 * first use (a dynamic import of an optional peer). That keeps the plugin
 * loadable — and the AnySearch backend fully usable — in a deployment that
 * does not compose the built-in DeepSeek search plugin, and it confines the
 * one cross-plugin dependency to this module. Its options are projected per
 * search from the `web-search-deepseek` settings section, with environment and
 * constant fallbacks, so the built-in DeepSeek search card stays the single
 * place that configures the official endpoint.
 * @module @wenqi_bian/dsh-web-search-anysearch/official
 */

import type { Context } from '@deepseek-ai/cordis'
import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { numberOf, readCredential, stringOf } from './env.ts'
import { webError } from './errors.ts'

/** Settings namespace of the built-in DeepSeek search provider. */
export const DEEPSEEK_SEARCH_SETTINGS_NAMESPACE = 'web-search-deepseek'

/** Environment variable naming the official search endpoint; mirrors the built-in provider. */
export const DEEPSEEK_SEARCH_BASE_URL_ENV = 'DEEPSEEK_SEARCH_BASE_URL'

/** Credential reference the official provider resolves when its section names none. */
export const DEEPSEEK_DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'

/**
 * Local fallbacks mirroring the built-in provider's exported defaults. They
 * only apply when the official package is absent or exports no constant; a
 * guard test asserts they match the installed package whenever it is present.
 */
export const DEEPSEEK_FALLBACK_DEFAULTS = {
  baseURL: 'https://api.deepseek.com/anthropic/v1',
  model: 'deepseek-v4-flash',
  apiVersion: '2023-06-01',
  maxTokens: 4096,
  maxUses: 5,
} as const

/** The defaults one projection runs with. */
interface DeepSeekDefaults {
  baseURL: string
  model: string
  apiVersion: string
  maxTokens: number
  maxUses: number
}

/** Options the official provider projects per search (structural: the class comes from the installed dsh). */
export interface DeepSeekOptionsLike {
  apiKey?: string
  resolveApiKey?: () => Promise<string | undefined>
  apiKeyEnv?: CredentialRef
  baseURL: string
  model: string
  apiVersion: string
  maxTokens: number
  maxUses: number
}

/** The official provider instance as this plugin uses it. */
export interface DeepSeekProviderLike {
  available(): boolean
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
}

/** The official backend the switch router delegates to. */
export interface OfficialSearchBackend {
  /** Whether the official side can serve now; false only once a load has settled as missing. */
  available(): boolean
  /** Run one official search, loading the package on demand. */
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
}

/** The subset of the optional peer's module surface this plugin consumes. */
interface DeepSeekModuleLike {
  DeepSeekSearchProvider: new (resolveOptions: () => DeepSeekOptionsLike) => DeepSeekProviderLike
  DEEPSEEK_DEFAULT_BASE_URL?: unknown
  DEEPSEEK_DEFAULT_MODEL?: unknown
  DEEPSEEK_DEFAULT_API_VERSION?: unknown
  DEEPSEEK_DEFAULT_MAX_TOKENS?: unknown
  DEEPSEEK_DEFAULT_MAX_USES?: unknown
}

/**
 * The built-in provider's section, when the deployment composes it.
 * @param ctx - plugin context; `settings` is an optional seam.
 * @returns the resolved section, or undefined while absent.
 */
export function deepseekSection(ctx: Context): Record<string, unknown> | undefined {
  const settings = ctx.get('settings') as { get?: (ns: string) => unknown } | undefined
  if (typeof settings?.get !== 'function') return undefined
  const section = settings.get(DEEPSEEK_SEARCH_SETTINGS_NAMESPACE)
  return typeof section === 'object' && section !== null && !Array.isArray(section)
    ? section as Record<string, unknown>
    : undefined
}

/** Project the installed module's exported defaults, falling back to the local mirrors. */
function defaultsOf(module: DeepSeekModuleLike | undefined): DeepSeekDefaults {
  const stringOr = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.length > 0 ? value : fallback
  const numberOr = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
  return {
    baseURL: stringOr(module?.DEEPSEEK_DEFAULT_BASE_URL, DEEPSEEK_FALLBACK_DEFAULTS.baseURL),
    model: stringOr(module?.DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_FALLBACK_DEFAULTS.model),
    apiVersion: stringOr(module?.DEEPSEEK_DEFAULT_API_VERSION, DEEPSEEK_FALLBACK_DEFAULTS.apiVersion),
    maxTokens: numberOr(module?.DEEPSEEK_DEFAULT_MAX_TOKENS, DEEPSEEK_FALLBACK_DEFAULTS.maxTokens),
    maxUses: numberOr(module?.DEEPSEEK_DEFAULT_MAX_USES, DEEPSEEK_FALLBACK_DEFAULTS.maxUses),
  }
}

/**
 * Project the DeepSeek side's options for the NEXT search. Field order mirrors
 * the built-in provider's own `resolveOptions`: section, environment, default.
 * @param ctx - plugin context supplying the settings, credential, and environment planes.
 * @param defaults - defaults the installed module exports, or the local mirrors.
 * @returns options one official search runs with.
 */
export function resolveDeepSeekOptions(ctx: Context, defaults: DeepSeekDefaults): DeepSeekOptionsLike {
  const section = deepseekSection(ctx)
  const declaredKeyEnv = section?.apiKeyEnv
  const apiKeyEnv = credentialRef(
    typeof declaredKeyEnv === 'string' && declaredKeyEnv.length > 0
      ? declaredKeyEnv
      : DEEPSEEK_DEFAULT_API_KEY_ENV,
  )
  const declaredKey = section?.apiKey
  return {
    ...typeof declaredKey === 'string' && declaredKey.length > 0 ? { apiKey: declaredKey } : {},
    resolveApiKey: () => readCredential(ctx, apiKeyEnv),
    apiKeyEnv,
    baseURL: stringOf(ctx, section, 'baseURL', DEEPSEEK_SEARCH_BASE_URL_ENV, defaults.baseURL),
    model: stringOf(ctx, section, 'model', undefined, defaults.model),
    apiVersion: stringOf(ctx, section, 'apiVersion', undefined, defaults.apiVersion),
    maxTokens: numberOf(section, 'maxTokens', defaults.maxTokens),
    maxUses: numberOf(section, 'maxUses', defaults.maxUses),
  }
}

/**
 * Build the official backend: the package loads on demand, once, and a
 * deployment without it keeps AnySearch working while the official side
 * reports unavailable and fails a direct search with a descriptive error.
 * @param ctx - plugin context supplying the settings, credential, and environment planes.
 * @returns the backend the switch router delegates to.
 */
export function createDeepSeekBackend(ctx: Context): OfficialSearchBackend {
  let loaded: DeepSeekProviderLike | undefined
  let failure: unknown
  let settledMissing = false
  const ready: Promise<DeepSeekProviderLike | undefined> = import('@deepseek-ai/dsh-web-search-deepseek')
    .then((module) => {
      const surface = module as unknown as DeepSeekModuleLike
      loaded = new surface.DeepSeekSearchProvider(() => resolveDeepSeekOptions(ctx, defaultsOf(surface)))
      return loaded
    })
    .catch((error: unknown) => {
      settledMissing = true
      failure = error
      return undefined
    })
  // Warm the module at apply so the first official search rarely pays the import.
  void ready
  return {
    available(): boolean {
      if (settledMissing) return false
      // While the import is still in flight the official side is optimistically
      // usable: the search path awaits it and reports precisely if it failed.
      return loaded?.available() ?? true
    },
    async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
      const provider = loaded ?? await ready
      if (provider === undefined) {
        throw webError(
          'official DeepSeek search backend is unavailable: @deepseek-ai/dsh-web-search-deepseek'
          + ` could not be loaded (${String(failure)})`,
        )
      }
      return provider.search(request, signal)
    },
  }
}
