/**
 * Environment and credential access shared by this plugin's config projections.
 *
 * The AnySearch side and the delegated official side resolve values the same
 * way — an explicit section value, then the launcher's layered environment
 * snapshot, then a constant default — and both resolve a credential reference
 * through the credentials seam when it is composed. Keeping that chain in one
 * module means the two projections cannot drift apart, and it is the single
 * place a dsh seam (launch-environment, credentials) is touched.
 * @module @wenqi_bian/dsh-web-search-anysearch/env
 */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'

/**
 * Read one environment variable through the launcher's layered snapshot
 * (`$DSH_HOME/.env` over the invoking directory's `.env` over the inherited
 * environment), treating an empty value as unset.
 * @param ctx - plugin context; a missing snapshot falls back to `process.env`.
 * @param name - variable name.
 * @returns the value, or undefined when unset or empty.
 */
export function readEnv(ctx: Context, name: string): string | undefined {
  const value = launchEnvironmentOf(ctx).get(name)?.value
  return value !== undefined && value.length > 0 ? value : undefined
}

/**
 * Resolve one credential reference: the credentials seam when present, else the
 * layered environment.
 * @param ctx - plugin context.
 * @param ref - branded credential reference.
 * @returns the credential value, or undefined when unresolved.
 */
export async function readCredential(ctx: Context, ref: CredentialRef): Promise<string | undefined> {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) return (await credentials.resolve(ref))?.value
  // Without the seam the environment is the whole credential plane.
  return readEnv(ctx, ref)
}

/** Read one optional string field: section, then environment, then constant default. */
export function stringOf(
  ctx: Context,
  section: Record<string, unknown> | undefined,
  field: string,
  env: string | undefined,
  fallback: string,
): string {
  const declared = section?.[field]
  if (typeof declared === 'string' && declared.length > 0) return declared
  return (env !== undefined ? readEnv(ctx, env) : undefined) ?? fallback
}

/** Read one optional positive number field with a constant fallback. */
export function numberOf(
  section: Record<string, unknown> | undefined,
  field: string,
  fallback: number,
): number {
  const declared = section?.[field]
  return typeof declared === 'number' && Number.isFinite(declared) && declared > 0 ? declared : fallback
}
