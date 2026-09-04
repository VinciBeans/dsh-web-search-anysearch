/**
 * AnySearch switch card, browser half. The bundle ships through
 * `exports["./client"]` (declared by package.json `dsh.client`), so a dsh web
 * GUI composed with this plugin loads the card and registers it into the
 * Plugins page's `settings.plugin.item` slot under this plugin's namespace.
 *
 * The card edits the `web-search-anysearch` namespace the host half installs;
 * the ConfigurablePluginsTab pairs the served namespace with this card by key,
 * so nothing here knows about the cards the deployment ships.
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
  ANYSEARCH_SETTINGS_NS,
  AnySearchCardController,
} from './controller.ts'
import type { AnySearchCardFace, SettingsScope } from './controller.ts'
import { en, zh, LOCALE_NS } from './locales.ts'
import type { AnySearchLocaleKey } from './locales.ts'
import { injectCardStyles } from './styles.ts'

/** Card dictionary namespace + the slot key this card claims (the settings ns it edits). */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'web-search-anysearch': AnySearchLocaleKey
  }
  interface SlotMap {
    /** This plugin's card inside the Plugins page configuration tab, keyed by its settings namespace. */
    'settings.plugin.item': { kind: 'keyed'; scope: 'root'; owner: { children?: never } }
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
 * Mount the card's controller and register the slot entry. The slot is
 * declared by the deployed Plugins page; `slots.inject` waits for that
 * declaration, so a host half without the web GUI leaves this entry dormant.
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

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: ANYSEARCH_SETTINGS_NS,
    locale: LOCALE_NS,
    inject: (): AnySearchCardFace => controller.inject(),
  }, AnySearchCard))
}
