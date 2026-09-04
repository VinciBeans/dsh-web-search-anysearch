/**
 * The switch provider: one WebSearchProvider that answers for the `anysearch`
 * id and routes each operation to the backend the section currently names.
 *
 * The dsh `web` seam resolves its provider at call time from the pinned
 * `web.searchProvider` id, which is fixed at launch. This router exists so the
 * switch between AnySearch and the official DeepSeek search endpoint can live
 * in the GUI instead: the seam pins `anysearch` once (see the bundle patch),
 * and the card edits the section that this provider reads per operation.
 * @module @wenqi_bian/dsh-web-search-anysearch/router
 */

import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import type { DeepSeekSearchProvider } from '@deepseek-ai/dsh-web-search-deepseek'
import { AnySearchProvider, ANYSEARCH_PROVIDER_ID } from './provider.ts'

/** The AnySearch backend of the switch. */
export const ANYSEARCH_BACKEND_ANYSEARCH = 'anysearch'

/** The official DeepSeek search backend of the switch. */
export const ANYSEARCH_BACKEND_DEEPSEEK = 'deepseek-official'

/** The switch's value domain. */
export type SearchBackend = typeof ANYSEARCH_BACKEND_ANYSEARCH | typeof ANYSEARCH_BACKEND_DEEPSEEK

/**
 * Publish the backing provider for the CURRENT switch value.
 * @param backend - the value the card's section currently resolves.
 * @returns the provider one search is handed to.
 */
export function backendProviderOf(
  backend: SearchBackend,
  anysearch: AnySearchProvider,
  deepseek: DeepSeekSearchProvider,
): WebSearchProvider {
  return backend === ANYSEARCH_BACKEND_DEEPSEEK ? deepseek : anysearch
}

/**
 * The `anysearch`-id provider whose routing follows the section's switch.
 * Availability mirrors the selected backend: AnySearch always serves
 * anonymously; the official backend needs its key and a trusted endpoint.
 */
export class AnySearchSwitchProvider implements WebSearchProvider {
  readonly id = ANYSEARCH_PROVIDER_ID

  /**
   * @param anysearch - the AnySearch-backed provider.
   * @param deepseek - the official DeepSeek-backed provider (projects its own options per operation).
   * @param currentBackend - the switch value for the NEXT operation, read from the live section.
   */
  constructor(
    private readonly anysearch: AnySearchProvider,
    private readonly deepseek: DeepSeekSearchProvider,
    private readonly currentBackend: () => SearchBackend,
  ) {}

  available(): boolean {
    return backendProviderOf(this.currentBackend(), this.anysearch, this.deepseek).available()
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    return backendProviderOf(this.currentBackend(), this.anysearch, this.deepseek).search(request, signal)
  }
}
