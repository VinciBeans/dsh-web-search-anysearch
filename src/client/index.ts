/**
 * AnySearch configuration surface on the Plugins page, browser half. The
 * bundle ships through `exports["./client"]` (declared by package.json
 * `dsh.client`), so a dsh web GUI composed with this plugin loads this half and
 * registers the configuration the page renders on this bundle's own page.
 *
 * The card edits the `web-search-anysearch` namespace the host half installs.
 * Which slot carries it depends on the dsh version, because the Plugins page
 * was rebuilt in 0.1.6-alpha.2: the page used to pair a card with a settings
 * namespace through the `settings.plugin.item` slot, and now dispatches a
 * bundle's own configuration through `plugins.bundle.config`, keyed by the
 * bundle's package name. Both declarations are merged here and both
 * registrations are attempted — a slot no deployment declares never runs its
 * callback — so one browser half serves the whole supported range.
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
import type { AnySearchCardFace, SettingsScope } from './controller.ts'
import { en, zh, LOCALE_NS } from './locales.ts'
import type { AnySearchLocaleKey } from './locales.ts'
import { injectCardStyles } from './styles.ts'

/**
 * The view a Plugins-page configuration entry is asked for. Mirrors the
 * `PluginConfigViewProps` the 0.1.6-alpha.2 page declares; declared locally so
 * the browser half keeps zero value imports from the monorepo's client
 * packages.
 */
export interface PluginConfigViewProps {
  /** `summary` renders the entry's one-liner, `page` the bundle's configuration form. */
  readonly view: 'summary' | 'page'
}

/** Slot key the pre-0.1.6 Plugins page declared for one plugin's card. */
const LEGACY_ITEM_SLOT = 'settings.plugin.item'

/** Slot key the 0.1.6-alpha.2 Plugins page declares for one bundle's own configuration. */
const BUNDLE_CONFIG_SLOT = 'plugins.bundle.config'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'web-search-anysearch': AnySearchLocaleKey
  }
  interface SlotMap {
    /** This plugin's card on the pre-0.1.6 Plugins page, keyed by its settings namespace. */
    'settings.plugin.item': { kind: 'keyed'; scope: 'root'; owner: { children?: never } }
    /** This bundle's configuration on the 0.1.6 Plugins page's own bundle page, keyed by package name. */
    'plugins.bundle.config': { kind: 'keyed'; scope: 'root'; owner: PluginConfigViewProps }
  }
}

/** Cordis plugin name. */
export const name = 'web-search-anysearch'

/**
 * Required services: the slot registry, locale copy, the wire namespaces that
 * answer this card's reads and writes, and the settings-scope service.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'settingsScope']

/**
 * Mount the card's controller and register it into whichever configuration
 * slot this deployment's Plugins page declares. A slot no page declares is
 * simply never injected, so registering twice is how one bundle serves both
 * page generations.
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

  const scope = ctx.settingsScope.bind({ namespace: ANYSEARCH_SETTINGS_NS }) as unknown as SettingsScope
  const controller = new AnySearchCardController(scope, ctx.remote.credentials)

  // The credential a card reports is not part of any settings section, so its
  // scope publishes nothing when one is written — the host's event is the only
  // signal that a key written on another surface reached the Host.
  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref: string) => { controller.refreshCredential(ref) }),
    'web-search-anysearch: credential invalidations',
  )

  /**
   * The share both registrations carry: the dictionary namespace that
   * synthesizes the card's `t` seat, and the business face its renderer binds.
   * `locale` keeps the literal type — a slot constrains it to its declared
   * namespaces, and a widened `string` would fail that check.
   */
  const entry: { locale: typeof LOCALE_NS; inject: () => AnySearchCardFace } = {
    locale: LOCALE_NS,
    inject: (): AnySearchCardFace => controller.inject(),
  }

  // 0.1.6-alpha.2: the Plugins page renders a bundle's own configuration on the
  // bundle's page, keyed by the bundle's package name.
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
