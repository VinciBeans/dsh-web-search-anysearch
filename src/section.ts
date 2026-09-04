/**
 * Settings section installation bridging the dsh settings seam's two shapes.
 *
 * dsh <= 0.1.2-alpha.5 exposes `installSettingsSection(ctx, ns, schema, entry,
 * hooks)` on the `@deepseek-ai/dsh-settings` module; dsh 0.1.2-rc.1 moved the
 * same wiring onto the `ctx.settings` service as `installSection(owner, ns,
 * schema, entry, hooks)`. Both register the plugin's composition entry as the
 * section's base layer and hand back the resolved scope through `setSource`,
 * so the provider keeps reading the same plugin config section with or without
 * the GUI. This wrapper feature-detects the two shapes so one plugin source
 * serves the whole supported range.
 * @module @wenqi_bian/dsh-web-search-anysearch/section
 */

import type { Context } from '@deepseek-ai/cordis'
import type z from '@deepseek-ai/schemastery'
// Value import for the namespace only: the alpha-era `installSettingsSection`
// export is read through a cast because rc.1 dropped it from this module, and
// a namespace import (unlike a named one) never fails to link on either version.
import * as settingsSdk from '@deepseek-ai/dsh-settings'

/** What a consumer hands the section installer (shape identical across versions). */
export interface SettingsSectionHooks<T> {
  /** Receive the active configuration source: the resolved scope while attached, the composition entry otherwise. */
  setSource(current: () => T): void
  /** Re-judge anything derived from the source after attach, detach, or a committed change. */
  onChange(): void
  /** Optional owner constraint the schema cannot express. */
  validate?: (value: T) => void
}

/** One installer call, as either shape accepts it. */
type SectionInstaller = (
  owner: Context,
  ns: string,
  schema: z<unknown>,
  entry: unknown,
  hooks: SettingsSectionHooks<unknown>,
) => void

/** rc.1 shape: the method rides the settings service. */
interface ModernSettingsService {
  installSection?: SectionInstaller
}

/** alpha shape: the free function rides the settings module namespace. */
interface LegacySettingsModule {
  installSettingsSection?: SectionInstaller
}

/**
 * Register this plugin's settings section whenever the settings service is
 * composed, using whichever installer shape the installed dsh provides.
 * @param ctx - the plugin's context (also the section's owner for disposal).
 * @param ns - the settings namespace this plugin owns.
 * @param schema - the section schema, as a configuration surface renders it.
 * @param entry - the plugin's composition entry; the section's base layer.
 * @param hooks - source sink and change notification.
 */
export function installSection<T>(
  ctx: Context,
  ns: string,
  schema: z<T>,
  entry: T,
  hooks: SettingsSectionHooks<T>,
): void {
  ctx.inject(['settings'], (settingsCtx: Context) => {
    const service = settingsCtx.get('settings') as ModernSettingsService | undefined
    const legacy = settingsSdk as unknown as LegacySettingsModule
    // The rc.1 shape is a class method; call it through the service so `this`
    // binds to the provider (an unbound extraction would lose its state).
    if (typeof service?.installSection === 'function') {
      service.installSection(
        ctx,
        ns,
        schema as unknown as z<unknown>,
        entry,
        hooks as unknown as SettingsSectionHooks<unknown>,
      )
      return
    }
    const installer = legacy.installSettingsSection
    if (installer === undefined) {
      ctx.logger.warn('web-search-anysearch: no settings section installer in this dsh build; the plugin runs from its composition config')
      return
    }
    installer(
      ctx,
      ns,
      schema as unknown as z<unknown>,
      entry,
      hooks as unknown as SettingsSectionHooks<unknown>,
    )
  })
}
