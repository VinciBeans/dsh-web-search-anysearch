/**
 * AnySearch configuration surface on the Plugins page, browser half. The bundle
 * ships through `exports["./client"]` (declared by package.json `dsh.client`),
 * so a dsh web GUI composed with this plugin loads this half and registers the
 * configuration its Plugins page renders.
 *
 * Three page generations exist across the supported range, and this module
 * registers into all three — each slot only ever fires where a page declared it:
 *
 * - **0.1.7-alpha.1 and later**: one row's configuration on that row's page,
 *   through `plugins.row.config` keyed `<bundle package>#<row id>`. The page
 *   resolves the entry's config form by the bare row id (which is the profile
 *   entry id) and passes it down as the owner's `form` prop, so the card edits
 *   through `form.mutate`. The same page generation also renders the bundle's own
 *   configuration slot (`plugins.bundle.config`, keyed by package name) on the
 *   bundle's page, and supplies no form there; the card serves it by reading and
 *   writing the namespace's configuration form itself — `ctx.configForms.get(ns)`
 *   — the way the shipped bundles own their data plane.
 * - **0.1.6-alpha.2**: a bundle's own configuration through
 *   `plugins.bundle.config`, keyed by the bundle's package name, with the card
 *   reading and writing a `ctx.settingsScope` binding.
 * - **pre-0.1.6**: the card paired with its settings namespace through
 *   `settings.plugin.item`.
 *
 * @module @wenqi_bian/dsh-web-search-anysearch/client
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only Context merges: the services this browser half injects.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { AnySearchCard } from './card.tsx'
import {
  ANYSEARCH_PACKAGE_NAME,
  ANYSEARCH_SETTINGS_NS,
  AnySearchCardController,
} from './controller.ts'
import type { AnySearchCardFace, SettingsScope, SettingsScopeSnapshot } from './controller.ts'
import { en, zh, LOCALE_NS } from './locales.ts'
import type { AnySearchLocaleKey } from './locales.ts'
import { injectCardStyles } from './styles.ts'

// The stages the browser half owns are exported so the smoke test can exercise
// the form's write plan and the credential path without a React renderer.
export { AnySearchCardController, apiKeyRefOf, formPlanOps } from './controller.ts'
export type { CredentialStatus, FormFieldOp } from './controller.ts'

/** One field edit the Host applies atomically; mirrors the client settings wire op. */
export interface SettingsPathOp {
  /** `set` writes the value at the path, `unset` removes it. */
  op: 'set' | 'unset'
  /** Path from the section root; a single field name for this card. */
  path: string[]
  /** Value written by a `set` op. */
  value?: unknown
}

/**
 * The live values and write command the Plugins page supplies to one row's
 * configuration entry on `0.1.7-alpha.1`. Mirrors `ConfigPageForm`; declared
 * locally so the browser half keeps zero value imports from the monorepo's
 * client packages.
 */
export interface PageConfigForm {
  /** The entry's accepted values, refreshed by the page owner. */
  readonly state: SettingsScopeSnapshot
  /** Apply a batch of field edits against the revision the page read. */
  readonly mutate: (ops: readonly SettingsPathOp[], expectedRevision?: number) => Promise<boolean>
}

/**
 * The owner props a Plugins-page configuration entry is rendered with. Mirrors
 * `PluginConfigViewProps` as each generation declares it: `view` in all of
 * them, and the entry's live form where the page owns one.
 */
export interface PluginConfigViewProps {
  /** `summary` renders the entry's one-liner, `page` the configuration form. */
  readonly view: 'summary' | 'page'
  /** The row's live values and write command; absent on page generations that leave the card to reach settings itself. */
  readonly form?: PageConfigForm | undefined
}

/** Slot key the pre-0.1.6 Plugins page declared for one plugin's card. */
const LEGACY_ITEM_SLOT = 'settings.plugin.item'

/** Slot key the 0.1.6-alpha.2 Plugins page declared for one bundle's own configuration. */
const BUNDLE_CONFIG_SLOT = 'plugins.bundle.config'

/** Slot key the 0.1.7-alpha.1 Plugins page declares for one row's configuration. */
const ROW_CONFIG_SLOT = 'plugins.row.config'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'web-search-anysearch': AnySearchLocaleKey
  }
  interface SlotMap {
    /** This plugin's card on the pre-0.1.6 Plugins page, keyed by its settings namespace. */
    'settings.plugin.item': { kind: 'keyed'; scope: 'root'; owner: { children?: never } }
    /** This bundle's configuration on the 0.1.6 Plugins page's own bundle page, keyed by package name. */
    'plugins.bundle.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewProps }
    /** This row's configuration on the 0.1.7 Plugins page, keyed by row id (the profile entry id). */
    'plugins.row.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewProps }
  }
}

/** Cordis plugin name. */
export const name = 'web-search-anysearch'

/**
 * Required services: the slot registry, locale copy, and the wire namespaces the
 * card reads through. The configuration seam the bundle's own page needs is
 * deliberately absent: `ctx.configForms` exists from `0.1.7-alpha.1` and
 * `ctx.settingsScope` before it, so declaring either would leave the whole
 * browser half pending on the releases that dropped it — and a page generation
 * that supplies its entry's form as owner props needs no seam at all.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials']

/**
 * Resolve the configuration scope for this namespace from whichever seam the
 * installed dsh exposes, so one browser half serves the range.
 *
 * `0.1.7-alpha.1` replaced `ctx.settingsScope` with `ctx.configForms`: a
 * namespace's own form, addressed by name, whose `getSnapshot` / `subscribe` /
 * `set` / `unset` are the reads and writes this card stages over. That is the
 * seam which lets the card configure the bundle from the bundle's own page,
 * where the page supplies no form — the self-sufficient data plane the shipped
 * bundles use. Releases through `0.1.6-alpha.2` carry the older
 * `ctx.settingsScope.bind({ namespace })` answer instead. A build with neither
 * leaves the card dormant rather than failing the plugin.
 *
 * Both services are reached through `ctx.get`, never as a bare property: this
 * plugin cannot declare either in its inject list — a release that removed the
 * service would leave the whole browser half pending and fail the client boot
 * audit — and a bare read of a service outside `inject` throws
 * (`cordis/src/reflect.ts`, "cannot get property … without inject"). `get` is
 * the lookup that answers undefined instead.
 *
 * @param ctx - the browser plugin context.
 * @returns the scope, or undefined when no such seam is composed.
 */
function bindScope(ctx: Context): SettingsScope | undefined {
  const get = (ctx as unknown as { get?: (name: string) => unknown }).get
  if (typeof get !== 'function') return undefined
  const configForms = get.call(ctx, 'configForms') as
    { get?: (namespace: string) => unknown } | undefined
  if (typeof configForms?.get === 'function') {
    const form = configForms.get(ANYSEARCH_SETTINGS_NS)
    if (isScope(form)) return form
  }
  const settingsScope = get.call(ctx, 'settingsScope') as
    { bind?: (spec: { namespace: string }) => unknown } | undefined
  if (typeof settingsScope?.bind === 'function') {
    const scope = settingsScope.bind({ namespace: ANYSEARCH_SETTINGS_NS })
    if (isScope(scope)) return scope
  }
  return undefined
}

/**
 * Whether a value is the scope interface this card stages over. The members are
 * probed rather than trusted: a release that reshapes either seam should leave
 * the card dormant, not hand it a partial object it would then write through.
 * @param value - the candidate a seam answered with.
 * @returns true when every member the card calls is a function.
 */
function isScope(value: unknown): value is SettingsScope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.getSnapshot === 'function'
    && typeof candidate.subscribe === 'function'
    && typeof candidate.set === 'function'
    && typeof candidate.unset === 'function'
}

/**
 * Mount the card's controller and register it into whichever configuration
 * slot this deployment's Plugins page declares. A slot no page declares is
 * simply never injected, so registering once per page generation is how one
 * bundle serves the whole range.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, { zh, en }),
    'web-search-anysearch: card dictionaries',
  )
  ctx.effect(
    () => injectCardStyles(),
    'web-search-anysearch: card chrome',
  )

  const controller = new AnySearchCardController(bindScope(ctx), ctx.remote.credentials)

  // The credential a card reports is not part of any configuration entry, so
  // the host's event is the only signal that a key written on another surface
  // reached the Host.
  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref: string) => { controller.refreshCredential(ref) }),
    'web-search-anysearch: credential invalidations',
  )

  /**
   * The share every registration carries: the dictionary namespace that
   * synthesizes the card's `t` seat, and the business face its renderer binds.
   * `locale` keeps the literal type — a slot constrains it to its declared
   * namespaces, and a widened `string` would fail that check.
   */
  const entry: { locale: typeof LOCALE_NS; inject: () => AnySearchCardFace } = {
    locale: LOCALE_NS,
    inject: (): AnySearchCardFace => controller.inject(),
  }

  // 0.1.7-alpha.1: one row's configuration, keyed `<bundle package>#<row id>`.
  // The page also resolves the entry's config form by the BARE row id — the
  // profile entry id — and passes it down as owner props, so the card needs no
  // settings service of its own there.
  ctx.slots.inject(ROW_CONFIG_SLOT, () => ctx.slots.register({
    name: ROW_CONFIG_SLOT,
    key: `${ANYSEARCH_PACKAGE_NAME}#${ANYSEARCH_SETTINGS_NS}`,
    ...entry,
  }, AnySearchCard))

  // 0.1.6-alpha.2: the bundle's own configuration, keyed by its package name.
  ctx.slots.inject(BUNDLE_CONFIG_SLOT, () => ctx.slots.register({
    name: BUNDLE_CONFIG_SLOT,
    key: ANYSEARCH_PACKAGE_NAME,
    ...entry,
  }, AnySearchCard))

  // Pre-0.1.6: the page paired a card with a settings namespace instead.
  ctx.slots.inject(LEGACY_ITEM_SLOT, () => ctx.slots.register({
    name: LEGACY_ITEM_SLOT,
    key: ANYSEARCH_SETTINGS_NS,
    ...entry,
  }, AnySearchCard))
}
