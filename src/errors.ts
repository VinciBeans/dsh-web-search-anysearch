/**
 * The one error shape this plugin reports.
 *
 * `WebError` is the seam's failure taxonomy: callers route on its machine code,
 * so the plugin constructs it in exactly one place instead of scattering the
 * class and the code literal through the provider.
 * @module @wenqi_bian/dsh-web-search-anysearch/errors
 */

import { WebError } from '@deepseek-ai/dsh-web'

/** Transport or provider failure code, as the `ctx.web` seam defines it. */
export const WEB_PROVIDER_ERROR = 'WEB_PROVIDER_ERROR' as const

/**
 * Build the seam error for a provider or transport failure.
 * @param message - human-readable failure text (endpoint, HTTP status, vendor message).
 * @returns the error the seam propagates to the model-facing tool.
 */
export function webError(message: string): WebError {
  return new WebError(message, WEB_PROVIDER_ERROR)
}
