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
import { AnySearchProvider, ANYSEARCH_PROVIDER_ID } from './provider.ts'
import type { OfficialSearchBackend } from './official.ts'

/** The AnySearch backend of the switch. */
export const ANYSEARCH_BACKEND_ANYSEARCH = 'anysearch'

/** The official DeepSeek search backend of the switch. */
export const ANYSEARCH_BACKEND_DEEPSEEK = 'deepseek-official'

/** The switch's value domain. */
export type SearchBackend = typeof ANYSEARCH_BACKEND_ANYSEARCH | typeof ANYSEARCH_BACKEND_DEEPSEEK

/**
 * The `anysearch`-id provider whose routing follows the section's switch.
 * Availability mirrors the selected backend: AnySearch always serves
 * anonymously; the official backend needs its key, a trusted endpoint, and the
 * optional peer package to be loadable.
 */
export class AnySearchSwitchProvider implements WebSearchProvider {
  readonly id = ANYSEARCH_PROVIDER_ID

  /**
   * @param anysearch - the AnySearch-backed provider.
   * @param official - the official DeepSeek backend, which loads its package on demand.
   * @param currentBackend - the switch value for the NEXT operation, read from the live section.
   */
  constructor(
    private readonly anysearch: AnySearchProvider,
    private readonly official: OfficialSearchBackend,
    private readonly currentBackend: () => SearchBackend,
  ) {}

  available(): boolean {
    return this.currentBackend() === ANYSEARCH_BACKEND_DEEPSEEK
      ? this.official.available()
      : this.anysearch.available()
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    return this.currentBackend() === ANYSEARCH_BACKEND_DEEPSEEK
      ? this.official.search(request, signal)
      : this.anysearch.search(request, signal)
  }
}
