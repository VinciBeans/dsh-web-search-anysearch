/**
 * AnySearch-backed WebSearchProvider for the dsh `ctx.web` seam.
 * Protocol: POST {base}/v1/search with JSON `{ query, max_results? }` and an
 * optional `Authorization: Bearer <key>` header; the response envelope is
 * `{ code, message?, request_id?, data: { results?: [{ title?, url, content?, snippet? }] } }`.
 * The seam request carries `query` and `maxResults` only, so this provider
 * serves AnySearch general search; vertical tags and params need a richer
 * request contract (see README known limitations).
 * @module @wenqi_bian/dsh-web-search-anysearch/provider
 */

import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { webError } from './errors.ts'

/**
 * Plugin version stamped on outbound requests, injected by the build from
 * package.json (esbuild `define`). Single-sourced so the header cannot drift
 * from the published version.
 */
declare const __DSH_WEB_SEARCH_ANYSEARCH_VERSION__: string

/**
 * The client-identification header value. Reading the injected constant through
 * a guard keeps the module importable from raw source (tests, ts-node) where no
 * build define exists.
 * @returns `dsh-web-search-anysearch/<version>`.
 */
function clientTag(): string {
  try {
    return `dsh-web-search-anysearch/${__DSH_WEB_SEARCH_ANYSEARCH_VERSION__}`
  } catch {
    return 'dsh-web-search-anysearch/0.0.0-dev'
  }
}

/** Stable id this provider registers under; select it with `web.searchProvider`. */
export const ANYSEARCH_PROVIDER_ID = 'anysearch'

/** Public AnySearch endpoint; `/v1/search` is appended. */
export const ANYSEARCH_DEFAULT_BASE_URL = 'https://api.anysearch.com'

/** Credential reference the plugin resolves when the section names none. */
export const ANYSEARCH_DEFAULT_API_KEY_ENV = 'ANYSEARCH_API_KEY'

/** AnySearch per-request result ceiling (`max_results` accepts 1-10). */
export const ANYSEARCH_MAX_RESULTS = 10

/** Resolved provider options (the plugin's `apply` supplies credential and constant defaults). */
export interface AnySearchProviderOptions {
  /** Literal API key; when present it wins over {@link resolveApiKey}. */
  apiKey?: string
  /** Resolve the current API key for one search operation. */
  resolveApiKey?: () => Promise<string | undefined>
  /** Credential reference named by missing-credential diagnostics. */
  apiKeyEnv?: CredentialRef
  /** Endpoint base; `/v1/search` is appended. */
  baseURL: string
}

/** Clamp a requested result count into AnySearch's 1-10 window. */
function clampMaxResults(value: number): number {
  return Math.max(1, Math.min(ANYSEARCH_MAX_RESULTS, Math.floor(value)))
}

/** Prefer `content`, then `snippet`, as the portable `snippet` field. */
function snippetOf(result: Record<string, unknown>): string | undefined {
  const content = result.content
  const snippet = result.snippet
  return typeof content === 'string' && content.length > 0 ? content
    : typeof snippet === 'string' && snippet.length > 0 ? snippet
    : undefined
}

/** Response envelope after basic JSON and status checks. */
interface AnySearchEnvelope {
  code?: number
  message?: string
  request_id?: string
  data?: { results?: unknown[] }
}

/**
 * AnySearch search provider. Anonymous access is permitted; a key only raises
 * the rate limit, so `available()` never depends on credential presence.
 *
 * Options are supplied either as a value or as a thunk: the plugin's apply
 * reads its settings section per operation, and re-registering the provider to
 * carry a new endpoint would make the seam's selection observable as a flicker.
 */
export class AnySearchProvider implements WebSearchProvider {
  readonly id = ANYSEARCH_PROVIDER_ID

  constructor(private readonly source: AnySearchProviderOptions | (() => AnySearchProviderOptions)) {}

  private options(): AnySearchProviderOptions {
    return typeof this.source === 'function' ? this.source() : this.source
  }

  available(): boolean {
    return true
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const options = this.options()
    const apiKey = options.apiKey
      ?? await options.resolveApiKey?.()
      ?? ''
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-anysearch-client': clientTag(),
    }
    if (apiKey !== '') headers.authorization = `Bearer ${apiKey}`
    const body: Record<string, unknown> = { query: request.query }
    if (request.maxResults !== undefined) body.max_results = clampMaxResults(request.maxResults)

    let response: Response
    try {
      response = await fetch(`${options.baseURL}/v1/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })
    } catch (error) {
      // Cancellation is the caller's abort, not a provider failure.
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw webError(`AnySearch request failed: ${String(error)}`)
    }

    let envelope: AnySearchEnvelope
    try {
      envelope = await response.json() as AnySearchEnvelope
    } catch {
      throw webError(`AnySearch returned a non-JSON response (HTTP ${response.status})`)
    }
    // The vendor CLI accepts an absent `code` as success; only a non-zero one fails.
    const code = typeof envelope.code === 'number' ? envelope.code : 0
    if (!response.ok || code !== 0) {
      const requestId = typeof envelope.request_id === 'string' && envelope.request_id.length > 0
        ? ` (request_id: ${envelope.request_id})`
        : ''
      const message = typeof envelope.message === 'string' && envelope.message.length > 0
        ? envelope.message
        : `HTTP ${response.status}`
      throw webError(`AnySearch error: ${message}${requestId}`)
    }

    const results = Array.isArray(envelope.data?.results) ? envelope.data.results : []
    return {
      sources: results
        .filter((result: unknown): result is Record<string, unknown> => {
          if (typeof result !== 'object' || result === null) return false
          const url = (result as Record<string, unknown>).url
          return typeof url === 'string' && url.length > 0
        })
        .map((result) => {
          const url = result.url as string
          const title = typeof result.title === 'string' && result.title.length > 0 ? result.title : undefined
          const snippet = snippetOf(result)
          return {
            url,
            ...title !== undefined ? { title } : {},
            ...snippet !== undefined ? { snippet } : {},
          }
        }),
      // The seam truncates to maxResults; AnySearch already applied it.
      truncated: false,
    }
  }
}
