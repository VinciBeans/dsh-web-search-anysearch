/**
 * Official DeepSeek search delegation for the AnySearch switch card.
 *
 * The dsh `web` seam cannot be re-pinned at runtime, so this plugin registers
 * itself as the provider the seam picks (`searchProvider: anysearch`, see the
 * bundle patch) and routes each search to the backend the card's switch names:
 * AnySearch, or the official DeepSeek search endpoint. The official side is a
 * `DeepSeekSearchProvider` whose options are projected per search from the
 * `web-search-deepseek` settings section when that plugin is composed, with
 * environment and constant fallbacks otherwise — so the built-in DeepSeek
 * search card stays the single place that configures the official endpoint,
 * and switching back to it here never re-introduces a second copy of those
 * settings.
 * @module @wenqi_bian/dsh-web-search-anysearch/official
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  DeepSeekSearchProvider,
  DEEPSEEK_DEFAULT_API_VERSION,
  DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_DEFAULT_MAX_TOKENS,
  DEEPSEEK_DEFAULT_MAX_USES,
  DEEPSEEK_DEFAULT_MODEL,
} from '@deepseek-ai/dsh-web-search-deepseek'
import type { DeepSeekSearchProviderOptions } from '@deepseek-ai/dsh-web-search-deepseek'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'

/** Settings namespace of the built-in DeepSeek search provider. */
export const DEEPSEEK_SEARCH_SETTINGS_NAMESPACE = 'web-search-deepseek'

/** Environment variable naming the official search endpoint; mirrors the built-in provider. */
export const DEEPSEEK_SEARCH_BASE_URL_ENV = 'DEEPSEEK_SEARCH_BASE_URL'

/** Credential reference the official provider resolves when its section names none. */
export const DEEPSEEK_DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'

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

/** Read one optional string field: section, then environment, then constant default. */
function stringOf(
  ctx: Context,
  section: Record<string, unknown> | undefined,
  field: string,
  env: string | undefined,
  fallback: string,
): string {
  const declared = section?.[field]
  if (typeof declared === 'string' && declared.length > 0) return declared
  const ambient = env !== undefined ? launchEnvironmentOf(ctx).get(env) : undefined
  return ambient?.value ?? fallback
}

/**
 * Project the DeepSeek side's options for the NEXT search. Field order mirrors
 * the built-in provider's own `resolveOptions`: section, environment, constant.
 * @param ctx - plugin context supplying the settings, credential, and environment planes.
 * @returns options one official search runs with.
 */
export function resolveDeepSeekOptions(ctx: Context): DeepSeekSearchProviderOptions {
  const section = deepseekSection(ctx)
  const declaredKeyEnv = section?.apiKeyEnv
  const apiKeyEnv: CredentialRef = credentialRef(
    typeof declaredKeyEnv === 'string' && declaredKeyEnv.length > 0
      ? declaredKeyEnv
      : DEEPSEEK_DEFAULT_API_KEY_ENV,
  )
  const declaredKey = section?.apiKey
  return {
    ...typeof declaredKey === 'string' && declaredKey.length > 0 ? { apiKey: declaredKey } : {},
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    baseURL: stringOf(ctx, section, 'baseURL', DEEPSEEK_SEARCH_BASE_URL_ENV, DEEPSEEK_DEFAULT_BASE_URL),
    model: stringOf(ctx, section, 'model', undefined, DEEPSEEK_DEFAULT_MODEL),
    apiVersion: stringOf(ctx, section, 'apiVersion', undefined, DEEPSEEK_DEFAULT_API_VERSION),
    maxTokens: numberOf(section, 'maxTokens', DEEPSEEK_DEFAULT_MAX_TOKENS),
    maxUses: numberOf(section, 'maxUses', DEEPSEEK_DEFAULT_MAX_USES),
  }
}

/** Read one optional positive number field with a constant fallback. */
function numberOf(section: Record<string, unknown> | undefined, field: string, fallback: number): number {
  const declared = section?.[field]
  return typeof declared === 'number' && Number.isFinite(declared) && declared > 0 ? declared : fallback
}

/**
 * The official DeepSeek search provider, projecting its options per search.
 * @param ctx - plugin context supplying the settings, credential, and environment planes.
 * @returns the provider implementation backing the switch's official side.
 */
export function createDeepSeekProvider(ctx: Context): DeepSeekSearchProvider {
  return new DeepSeekSearchProvider(() => resolveDeepSeekOptions(ctx))
}
