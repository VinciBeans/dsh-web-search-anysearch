/**
 * The AnySearch card's staged form over the `web-search-anysearch` settings
 * namespace — a plugin-local twin of the shipped plugin-card form model, so
 * the browser half needs no value imports from the monorepo's client packages.
 *
 * The card stages what the user types and writes it only on save. The API key
 * is the one control that does not live in the section: its literal never
 * rides a response, so the card learns only whether one is configured and
 * writes it through the credentials domain, addressed by the reference the
 * section names.
 * @module @wenqi_bian/dsh-web-search-anysearch/client/controller
 */

/** Settings namespace this card edits. */
export const ANYSEARCH_SETTINGS_NS = 'web-search-anysearch'

/** Credential reference resolved when the section names none. */
export const ANYSEARCH_DEFAULT_API_KEY_ENV = 'ANYSEARCH_API_KEY'

/** Backend values of the switch. */
export const ANYSEARCH_BACKENDS = ['anysearch', 'deepseek-official'] as const

export type CardBackend = (typeof ANYSEARCH_BACKENDS)[number]

/** The bare observable source the slot renderer binds as a selector hook. */
export interface SnapshotStore<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

/** Minimal snapshot store (reference-stable until the next set). */
export function createSnapshotStore<T>(initial: T): SnapshotStore<T> & { set(next: T): void } {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    set: (next) => {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** One namespace's mirror view, as the client settings scope serves it. */
export interface SettingsScopeSnapshot {
  status: string
  value?: Record<string, unknown>
  base?: Record<string, unknown>
  user?: Record<string, unknown>
  revision?: number
  writable: boolean
}

/** The bound scope a card stages over (structural subset of the client service). */
export interface SettingsScope {
  getSnapshot(): SettingsScopeSnapshot
  subscribe(fn: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}

/** Credentials-domain answers (structural subset of the client remote). */
export interface CredentialsRemote {
  describe(refs: string[]): Promise<{ ok: boolean; value?: Record<string, { configured?: boolean; writable?: boolean }> }>
  set(ref: string, value: string): Promise<{ ok: boolean }>
}

/** One field as the card renders it. */
export interface CardFieldState {
  /** Draft text the control renders. */
  text: string
  /** Whether a save would leave a user-layer entry for this field. */
  overridden: boolean
  /** Whether the draft is not a value this field accepts (blocks the save). */
  invalid: boolean
}

/** What the AnySearch card renders. */
export interface AnySearchCardState {
  /** False while the namespace is not served to this client; the card renders nothing. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Whether the form holds edits a save would write. */
  dirty: boolean
  /** Whether any staged draft is invalid, which blocks the save. */
  invalid: boolean
  /** Whether a save is crossing the wire. */
  saving: boolean
  /** Whether the last save did not land as staged; cleared by the next edit. */
  failed: boolean
  /** The switch: which backend serves the next search. */
  backend: CardFieldState
  /** AnySearch endpoint. */
  baseURL: CardFieldState
  /** The staged credential, which starts blank on every load. */
  apiKey: CardFieldState
  /** Whether the Host reports a credential configured for the referenced key. */
  apiKeyConfigured: boolean
  /** Whether the credentials domain accepts a write for it. */
  apiKeyWritable: boolean
}

/** The registration-side face the card's slot entry injects. */
export interface AnySearchCardFace {
  hooks: {
    /** Card snapshot bound by the renderer as useAnysearchCard. */
    anysearchCard: SnapshotStore<AnySearchCardState>
  }
  /** Stage draft text for one field. */
  edit: (field: string, text: string) => void
  /** Stage a clear, so saving lets the field re-inherit the composition layer. */
  resetField: (field: string) => void
  /** Write every staged edit, then re-seed from what the Host accepted. */
  save: () => void
  /** Drop every staged edit. */
  discard: () => void
}

/** One staged edit. */
interface StagedEdit {
  text: string
  clear: boolean
}

/** One planned write a save performs; undefined `run` blocks the save. */
interface PlannedWrite {
  field: string
  run: (() => Promise<boolean>) | undefined
}

/** Bridges the `web-search-anysearch` scope and the credentials domain onto the card. */
export class AnySearchCardController {
  private readonly staged = new Map<string, StagedEdit>()
  private readonly snapshot = createSnapshotStore<AnySearchCardState>({
    available: false, writable: false, dirty: false, invalid: false, saving: false, failed: false,
    backend: { text: '', overridden: false, invalid: false },
    baseURL: { text: '', overridden: false, invalid: false },
    apiKey: { text: '', overridden: false, invalid: false },
    apiKeyConfigured: false, apiKeyWritable: true,
  })
  private credential: { ref: string; configured: boolean; writable: boolean }
  private saving = false
  private failed = false

  /**
   * @param scope - the bound settings scope for the `web-search-anysearch` namespace.
   * @param credentials - the credentials domain the section's reference addresses.
   */
  constructor(
    private readonly scope: SettingsScope,
    private readonly credentials: CredentialsRemote,
  ) {
    this.credential = { ref: this.apiKeyRef(), configured: false, writable: true }
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot source and its form actions.
   */
  inject(): AnySearchCardFace {
    return {
      hooks: { anysearchCard: this.snapshot },
      edit: (field, text) => { this.stage(field, { text, clear: false }) },
      resetField: (field) => { this.stage(field, { text: this.baseText(field), clear: true }) },
      save: () => { void this.save() },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return
        this.staged.clear()
        this.failed = false
        this.publish()
      },
    }
  }

  /**
   * Re-read after the Host reports a change to the reference this card watches.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  private stage(field: string, edit: StagedEdit): void {
    this.staged.set(field, edit)
    this.failed = false
    this.publish()
  }

  /** Publish a fresh projection of the form. */
  private publish(): void {
    this.snapshot.set({ ...this.shell(), ...this.fields() })
  }

  private shell(): Pick<AnySearchCardState, 'available' | 'writable' | 'dirty' | 'invalid' | 'saving' | 'failed'> {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0 || this.hasStagedSecret(),
      invalid: plan.some(item => item.run === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  private fields(): Pick<AnySearchCardState, 'backend' | 'baseURL' | 'apiKey' | 'apiKeyConfigured' | 'apiKeyWritable'> {
    return {
      backend: this.field('searchProvider', value => this.backendTextOf(value)),
      baseURL: this.field('baseURL', value => typeof value === 'string' ? value : ''),
      apiKey: {
        text: this.staged.get('apiKey')?.text ?? '',
        overridden: false,
        invalid: false,
      },
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
    }
  }

  /** Derive one section field's control state from the snapshot and its draft. */
  private field(field: string, format: (value: unknown) => string): CardFieldState {
    const staged = this.staged.get(field)
    if (staged === undefined) {
      return { text: format(this.sectionValue(field)), overridden: this.stored(field), invalid: false }
    }
    const write = parsedWrite(field, staged)
    return {
      text: staged.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    }
  }

  private backendTextOf(value: unknown): string {
    return typeof value === 'string' && (ANYSEARCH_BACKENDS as readonly string[]).includes(value) ? value : ANYSEARCH_BACKENDS[0]
  }

  private sectionValue(field: string): unknown {
    return this.scope.getSnapshot().value?.[field]
  }

  private baseValue(field: string): unknown {
    return this.scope.getSnapshot().base?.[field]
  }

  private userLayer(): Record<string, unknown> | undefined {
    return this.scope.getSnapshot().user
  }

  private stored(field: string): boolean {
    const user = this.userLayer()
    return user !== undefined && Object.hasOwn(user, field)
  }

  private baseText(field: string): string {
    const value = this.baseValue(field)
    return field === 'searchProvider'
      ? this.backendTextOf(value)
      : typeof value === 'string' ? value : ''
  }

  private hasStagedSecret(): boolean {
    const secret = this.staged.get('apiKey')
    return secret !== undefined && secret.text.trim() !== '' && !secret.clear
  }

  /** Every staged edit a save would write, in staging order. */
  private plan(): PlannedWrite[] {
    const plan: PlannedWrite[] = []
    for (const [field, staged] of this.staged) {
      if (field === 'apiKey') {
        const value = staged.text.trim()
        if (value !== '') plan.push({ field, run: () => this.writeKey(value) })
        continue
      }
      const write = parsedWrite(field, staged)
      if (write === undefined) {
        plan.push({ field, run: undefined })
        continue
      }
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, run: () => this.clear(field) })
        continue
      }
      if (staged.text === this.currentText(field)) continue
      if (write.kind === 'clear') plan.push({ field, run: () => this.clear(field) })
      else plan.push({ field, run: () => this.store(field, write.value) })
    }
    return plan
  }

  /** The effective text of a section field (user layer over composition over schema default). */
  private currentText(field: string): string {
    const value = this.sectionValue(field)
    return field === 'searchProvider' ? this.backendTextOf(value) : typeof value === 'string' ? value : ''
  }

  private async store(field: string, value: unknown): Promise<boolean> {
    await this.scope.set(field, value)
    return this.sectionValue(field) === value
  }

  private async clear(field: string): Promise<boolean> {
    await this.scope.unset(field)
    return !this.stored(field)
  }

  private async writeKey(value: string): Promise<boolean> {
    await this.credentials.set(this.apiKeyRef(), value)
    await this.readCredential()
    return this.credential.configured
  }

  private apiKeyRef(): string {
    const declared = this.scope.getSnapshot().value?.apiKeyEnv
    return typeof declared === 'string' && declared.length > 0 ? declared : ANYSEARCH_DEFAULT_API_KEY_ENV
  }

  /**
   * Ask the credentials domain about the reference the section currently names.
   * A response is published only while it still answers for the reference in
   * force (the section can change between the request and its settlement).
   */
  private async readCredential(): Promise<void> {
    const ref = this.apiKeyRef()
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true }
      this.publish()
    }
    const response = await this.credentials.describe([ref])
    if (!response.ok || ref !== this.apiKeyRef()) return
    const view = response.value?.[ref]
    const next = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.publish()
  }

  /** Write every staged edit, then re-seed from what the Host accepted. */
  private async save(): Promise<void> {
    const plan = this.plan()
    const writes = plan.flatMap(item => item.run === undefined ? [] : [item.run])
    if (plan.length === 0 || this.saving || writes.length !== plan.length) return
    this.saving = true
    this.failed = false
    this.publish()
    let landed = true
    for (const write of writes) {
      landed = await write() && landed
    }
    if (landed) this.staged.clear()
    this.saving = false
    this.failed = !landed
    this.publish()
  }
}

/** Resolve one field's draft into the write a save performs (undefined = invalid). */
function parsedWrite(
  field: string,
  staged: StagedEdit,
): { kind: 'set'; value: unknown } | { kind: 'clear' } | undefined {
  if (staged.clear) return { kind: 'clear' }
  const text = staged.text.trim()
  if (field === 'searchProvider') {
    return (ANYSEARCH_BACKENDS as readonly string[]).includes(text)
      ? { kind: 'set', value: text }
      : undefined
  }
  // baseURL: free text; an empty draft clears the field.
  return text === '' ? { kind: 'clear' } : { kind: 'set', value: text }
}
