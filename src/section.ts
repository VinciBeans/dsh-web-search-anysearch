/**
 * The `web-search-anysearch` settings section, in both dsh settings shapes.
 *
 * Across the supported range (`dsh-v0.1.5-alpha.1` and later) the seam has two
 * shapes, and this module detects which one is installed rather than branching on
 * a version string:
 *
 * - **0.1.7-alpha.1 and later**: the registration call is gone. A schema field
 *   marked `.volatile()` is handed to `apply` as a stable reference whose `get()`
 *   returns the current value, and the framework commits a profile edit into that
 *   reference (emitting `loader/volatile-update`) instead of remounting the
 *   plugin. The value `apply` received IS the live one.
 * - **0.1.5-alpha.1 ~ 0.1.6-alpha.2**: `.volatile()` does not exist on the schema
 *   builder those releases ship, so fields stay plain and the section registers
 *   with `ctx.settings.installSection`, which hands the resolved scope back
 *   through `setSource`.
 * - **No settings service at all**: the plugin runs from its composition entry.
 *
 * @module @wenqi_bian/dsh-web-search-anysearch/section
 */

import type { Context } from '@deepseek-ai/cordis'
import type z from '@deepseek-ai/schemastery'

/**
 * A config field as `apply` receives it. A plain builder chain yields the value
 * itself (`T`); a `.volatile()` chain yields a stable reference to it. Reading
 * through {@link configValueOf} covers both.
 */
export interface ConfigRef<T> {
  get(): T
}

/** Whether a value is a config reference rather than the value itself. */
function isConfigRef(value: unknown): value is ConfigRef<unknown> {
  return typeof value === 'object' && value !== null
    && typeof (value as { get?: unknown }).get === 'function'
}

/**
 * Read one config field, whether the installed dsh handed over the value or a
 * Volatile reference to it.
 * @param field - the field as it arrived in `apply`.
 * @returns the current value, or undefined when absent.
 */
export function configValueOf<T>(field: ConfigRef<T> | T | undefined): T | undefined {
  if (field === undefined) return undefined
  return isConfigRef(field) ? field.get() as T : field
}

/**
 * Mark a schema field volatile when the installed builder supports it.
 *
 * `volatile()` arrived in schemastery 3.18.3, which dsh 0.1.7-alpha.1 is the
 * first release to carry; on 3.18.2 the call does not exist and the field must
 * stay plain. Older dsh resolves the section through `installSection` instead,
 * so the two shapes are alternatives rather than a version check: this returns
 * the plain schema unchanged whenever the builder has no `volatile`.
 *
 * `.volatile()` keeps the field's type and UI metadata, so the derived form
 * still renders it as before — it only changes how the value reaches `apply`.
 *
 * @param schema - the field's builder chain.
 * @returns the same schema, marked volatile where that is supported.
 */
export function volatileField<T extends z<any>>(schema: T): T {
  const volatile = (schema as unknown as { volatile?: () => T }).volatile
  if (typeof volatile !== 'function') return schema
  return volatile.call(schema)
}

/** What a consumer hands the section installer (shape identical across versions). */
export interface SettingsSectionHooks<T> {
  /** Receive the active configuration source: the resolved scope while attached, the composition entry otherwise. */
  setSource(current: () => T): void
  /** Re-judge anything derived from the source after attach, detach, or a committed change. */
  onChange(): void
  /** Optional owner constraint the schema cannot express. */
  validate?: (value: T) => void
}

/** One installer call, as the settings service of every supported release declares it. */
type SectionInstaller = (
  owner: Context,
  ns: string,
  schema: z<unknown>,
  entry: unknown,
  hooks: SettingsSectionHooks<unknown>,
) => void

/** The settings service as a consumer of its section installer sees it. */
interface SettingsService {
  installSection?: SectionInstaller
}

/**
 * Register this plugin's settings section when the installed dsh still has a
 * section installer. Across the whole supported range the installer is one
 * method on the settings service (`0.1.5-alpha.1` through `0.1.6-alpha.2`); a
 * release that moved to Volatile config (`0.1.7-alpha.1` and later) has no
 * installer at all, because there the value `apply` received is already the live
 * one — this then installs nothing and leaves the composition entry
 * authoritative.
 *
 * The 0.1.2 line's module-level `installSettingsSection` export is gone from
 * this code: that line and 0.1.3 are below the supported floor.
 *
 * @param ctx - the plugin's context (also the section's owner for disposal).
 * @param ns - the settings namespace this plugin owns.
 * @param schema - the section schema, as a configuration surface renders it.
 * @param entry - the plugin's composition entry; the section's base layer.
 * @param hooks - source sink and change notification.
 * @returns whether a section installer took the registration.
 */
export function installSection<T>(
  ctx: Context,
  ns: string,
  schema: unknown,
  entry: T,
  hooks: SettingsSectionHooks<T>,
): boolean {
  let installed = false
  ctx.inject(['settings'], (settingsCtx: Context) => {
    const service = settingsCtx.get('settings') as SettingsService | undefined
    // Call it through the service so `this` binds to the provider; an unbound
    // extraction would lose its state.
    if (typeof service?.installSection !== 'function') return
    service.installSection(
      ctx,
      ns,
      schema as z<unknown>,
      entry,
      hooks as unknown as SettingsSectionHooks<unknown>,
    )
    installed = true
  })
  return installed
}
