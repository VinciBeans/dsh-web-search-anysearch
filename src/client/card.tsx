/**
 * The AnySearch configuration form: its backend switch, the AnySearch
 * endpoint, and the AnySearch key — written through the credentials domain,
 * never into the settings section, so the literal never rides a response.
 *
 * Three page generations render this component, and it answers each with the
 * shape that generation supplies:
 *
 * - `form` present (`0.1.7-alpha.1`): the page owns the entry's values and its
 *   write command, so the card stages a draft and saves through `form.mutate`.
 * - `view: 'page'` without a form (`0.1.6-alpha.2`): the card reads the settings
 *   seam itself through the injected face and owns its save control.
 * - no `view` (pre-0.1.6): a disclosure card with its own chrome, save and
 *   discard.
 *
 * `view: 'summary'` is the one-liner every page generation may ask for.
 * @module @wenqi_bian/dsh-web-search-anysearch/client/card
 */

import * as React from 'react'
import type { AnySearchCardState } from './controller.ts'
import type { AnySearchLocaleKey } from './locales.ts'
import type { PageConfigForm, PluginConfigViewProps } from './index.ts'
import { classes as css } from './styles.ts'

/** Props the renderer binds for the anysearch card. */
export interface AnySearchCardProps {
  /** Translate a dictionary key of this card's namespace. */
  t: (key: AnySearchLocaleKey) => string
  /** Card snapshot selector (bound from the inject face's hooks compartment). */
  useAnysearchCard: <S>(selector: (state: AnySearchCardState) => S, equal?: (a: S, b: S) => boolean) => S
  /** Stage draft text for one field. */
  edit: (field: string, text: string) => void
  /** Stage a clear, so saving lets the field re-inherit the composition layer. */
  resetField: (field: string) => void
  /** Write every staged edit. */
  save: () => void
  /** Drop every staged edit. */
  discard: () => void
  /** Which view the page asks for; absent on the pre-0.1.6 card, which owns its own chrome. */
  view?: PluginConfigViewProps['view']
  /**
   * The entry's live values and write command, supplied by a page generation
   * that owns the configuration form. Absent where the card reaches the
   * settings seam itself.
   */
  form?: PluginConfigViewProps['form']
}

/**
 * Render the AnySearch configuration.
 * @param props - locale copy, the injected card face, and the view and form the page supplied.
 * @returns the requested view.
 */
export function AnySearchCard(props: AnySearchCardProps) {
  // Unconditional: the injected face's hook is a selector the renderer binds,
  // and only the branches without a page-owned form read it.
  const state = props.useAnysearchCard(snapshot => snapshot)
  // Leaving the page drops every staged edit — a page that gives an entry no
  // discard gesture is left with unmount as the only point at which one can be
  // offered. The ref keeps the effect at mount-only while calling the live action.
  const discard = React.useRef(props.discard)
  discard.current = props.discard
  React.useEffect(() => () => { discard.current() }, [])
  if (props.view === 'summary') return <>{props.t('description')}</>
  // A page that owns the form is authoritative for availability: while the Host
  // has not served the entry there is nothing to configure, so nothing renders.
  // The check precedes the draft state so an unserved entry claims no slots.
  if (props.form !== undefined) {
    return props.form.state.status === 'ready' ? <FormCard {...props} form={props.form} /> : null
  }
  if (props.view === 'page') {
    if (!state.available) return null
    return (
      <>
        <CardBody
          t={props.t}
          state={state}
          disabled={!state.writable}
          edit={props.edit}
          resetField={props.resetField}
        />
        <CardFooter {...props} state={state} />
      </>
    )
  }
  return <LegacyCard {...props} state={state} />
}

/** Props of the form-backed card. */
interface FormCardProps extends AnySearchCardProps {
  /** The entry's live values and write command. */
  form: PageConfigForm
}

/**
 * The configuration body on a page that supplies the entry's form.
 *
 * The page owns the form: `form.state` is the value it read for this render,
 * and `form.mutate` is the revision-fenced write whose answer says whether the
 * Host accepted it. The draft therefore lives here — the card decides what a
 * save sends — and a landed write clears it, so the page's next render re-seeds
 * every control from the Host.
 * @param props - locale copy, the page's form, and the card's own actions.
 * @returns the controls with this card's save control.
 */
function FormCard(props: FormCardProps) {
  const [drafts, setDrafts] = React.useState<ReadonlyMap<string, string>>(() => new Map())
  const [saving, setSaving] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const { state } = props.form
  const value = state.value ?? {}
  const draftOf = (field: string): string => drafts.get(field) ?? textOf(value[field])
  const dirty = drafts.size > 0
  // A save that did not land keeps its drafts, so the user can correct them.
  const edit = (field: string, text: string): void => {
    setDrafts((current) => new Map(current).set(field, text))
    setFailed(false)
  }
  const reset = (field: string): void => {
    // An empty draft is the clear the Host resolves back to the base layer.
    setDrafts((current) => new Map(current).set(field, ''))
    setFailed(false)
  }
  const save = (): void => {
    const ops = [...drafts].map(([field, text]) => ({ op: 'set' as const, path: [field], value: text }))
    setSaving(true)
    setFailed(false)
    void props.form.mutate(ops, state.revision)
      .then((landed) => {
        if (landed) setDrafts(new Map())
        setSaving(false)
        setFailed(!landed)
      })
      .catch(() => { setSaving(false); setFailed(true) })
  }

  const cardState: AnySearchCardState = {
    available: true,
    writable: state.writable,
    dirty,
    invalid: false,
    saving,
    failed,
    backend: {
      // The switch always names a backend; an absent field reads as the default.
      text: draftOf('searchProvider') || ANYSEARCH_BACKEND_DEFAULT,
      overridden: Object.hasOwn(value, 'searchProvider'),
      invalid: false,
    },
    baseURL: { text: draftOf('baseURL'), overridden: Object.hasOwn(value, 'baseURL'), invalid: false },
    apiKey: { text: draftOf('apiKey'), overridden: false, invalid: false },
    // The credential badge lives on the settings seam, which this page
    // generation does not expose to the card; the control still writes the key.
    apiKeyConfigured: false,
    apiKeyWritable: state.writable,
  }

  return (
    <>
      <CardBody
        t={props.t}
        state={cardState}
        disabled={!state.writable}
        edit={edit}
        resetField={reset}
      />
      <div className={css.footer}>
        {failed ? <p className={css.failed} role="status">{props.t('saveFailed')}</p> : null}
        <button
          type="button"
          className={css.save}
          disabled={!dirty || saving}
          onClick={save}
        >
          {props.t(saving ? 'saving' : 'save')}
        </button>
      </div>
    </>
  )
}

/** Read one section value as control text. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** The backend a section with no explicit switch value serves. */
const ANYSEARCH_BACKEND_DEFAULT = 'anysearch'

/** Props of the form's save control. */
interface CardFooterProps extends AnySearchCardProps {
  /** The card's current snapshot. */
  state: AnySearchCardState
}

/**
 * The form's save control and its failure line. The page view owns it because
 * the 0.1.6 Plugins page mounts an entry as a bare section, and the official
 * form chrome that wraps the shipped cards is internal to
 * `@deepseek-ai/dsh-client-ui-settings-plugins` — not a module-table seed, and
 * a cross-plugin value import is what the client bundle purity gate forbids.
 * @param props - the card's form actions and snapshot.
 * @returns the footer.
 */
function CardFooter(props: CardFooterProps) {
  const { state } = props
  return (
    <div className={css.footer}>
      {state.failed ? <p className={css.failed} role="status">{props.t('saveFailed')}</p> : null}
      <button
        type="button"
        className={css.save}
        disabled={!state.dirty || state.invalid || state.saving}
        onClick={props.save}
      >
        {props.t(state.saving ? 'saving' : 'save')}
      </button>
    </div>
  )
}

/** Props of the pre-0.1.6 disclosure card. */
interface LegacyCardProps extends AnySearchCardProps {
  /** The card's current snapshot. */
  state: AnySearchCardState
}

/**
 * The pre-0.1.6 Plugins page card: a list item that discloses the same body and
 * carries its own save and discard controls.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the disclosure list item.
 */
function LegacyCard(props: LegacyCardProps) {
  const { state } = props
  const [open, setOpen] = React.useState(false)
  const saveStarted = React.useRef(false)
  // Collapse only after Host-confirmed settlement; a rejected write keeps its
  // diagnostics and retained drafts visible (same rule as the shipped cards).
  React.useEffect(() => {
    if (state.saving) {
      saveStarted.current = true
      return
    }
    if (!saveStarted.current) return
    saveStarted.current = false
    if (!state.dirty && !state.failed) setOpen(false)
  }, [state.dirty, state.failed, state.saving])
  if (!state.available) return null
  return (
    <li className={open ? `${css.card} ${css.cardOpen}` : css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${props.t(open ? 'collapse' : 'expand')}: ${props.t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{props.t('title')}</span>
          <span className={css.description}>{props.t('description')}</span>
        </span>
        {state.dirty ? <span className={css.pending}>{props.t('unsaved')}</span> : null}
        <ChevronIcon open={open} />
      </button>
      {open
        ? (
          <div className={css.body}>
            {!state.writable ? <p className={css.readOnly} role="status">{props.t('readOnly')}</p> : null}
            <CardBody
              t={props.t}
              state={state}
              disabled={!state.writable}
              edit={props.edit}
              resetField={props.resetField}
            />
            <div className={css.footer}>
              {state.failed ? <p className={css.failed} role="status">{props.t('saveFailed')}</p> : null}
              <button
                type="button"
                className={css.discard}
                disabled={!state.dirty || state.saving}
                onClick={props.discard}
              >
                {props.t('discard')}
              </button>
              <button
                type="button"
                className={css.save}
                disabled={!state.dirty || state.invalid || state.saving}
                onClick={props.save}
              >
                {props.t(state.saving ? 'saving' : 'save')}
              </button>
            </div>
          </div>
        )
        : null}
    </li>
  )
}

/** Props of the configuration controls. */
interface CardBodyProps {
  /** Translate a dictionary key of this card's namespace. */
  t: (key: AnySearchLocaleKey) => string
  /** The card's current snapshot. */
  state: AnySearchCardState
  /** Whether the Host settings document accepts writes. */
  disabled: boolean
  /** Stage draft text for one field. */
  edit: (field: string, text: string) => void
  /** Stage a clear, so saving lets the field re-inherit the composition layer. */
  resetField: (field: string) => void
}

/**
 * The configuration controls themselves, without any page chrome: the backend
 * switch, the endpoint, and the write-only API key. Every page generation
 * stages through the same two actions, so only how a save is submitted differs.
 * @param props - locale copy, the field state, and the staging actions.
 * @returns the card's fields.
 */
function CardBody(props: CardBodyProps) {
  const { state, disabled } = props
  return (
    <>
      <div className={css.field}>
        <div className={css.head}>
          <label className={css.label}>{props.t('backendLabel')}</label>
        </div>
        <div className={css.backend} role="radiogroup" aria-label={props.t('backendLabel')}>
          <BackendOption
            id="dswa-backend-anysearch"
            label={props.t('backendAnysearch')}
            value="anysearch"
            draft={state.backend.text}
            disabled={disabled}
            onPick={(value) => { props.edit('searchProvider', value) }}
          />
          <BackendOption
            id="dswa-backend-deepseek"
            label={props.t('backendDeepseek')}
            value="deepseek-official"
            draft={state.backend.text}
            disabled={disabled}
            onPick={(value) => { props.edit('searchProvider', value) }}
          />
        </div>
        <p className={css.hint}>{props.t('backendHint')}</p>
      </div>
      <SecretField
        id="dswa-anysearch-key"
        label={props.t('apiKey')}
        hint={props.t('apiKeyHint')}
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? props.t('apiKeySet') : props.t('apiKeyUnset')}
        onEdit={(text) => { props.edit('apiKey', text) }}
      />
      <ValueField
        id="dswa-anysearch-endpoint"
        label={props.t('endpoint')}
        hint={props.t('endpointHint')}
        overriddenLabel={props.t('overridden')}
        resetLabel={props.t('reset')}
        disabled={disabled}
        text={state.baseURL.text}
        overridden={state.baseURL.overridden}
        invalid={false}
        onEdit={(text) => { props.edit('baseURL', text) }}
        onReset={() => { props.resetField('baseURL') }}
      />
    </>
  )
}

/** The card's disclosure chevron (inline SVG; no icon dependency). */
function ChevronIcon(props: { open: boolean }) {
  return (
    <svg
      className={props.open ? `${css.chevron} ${css.chevronOpen}` : css.chevron}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3.5 5.25 7 8.75l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** One backend option of the switch. */
function BackendOption(props: {
  id: string
  label: string
  value: string
  draft: string
  disabled: boolean
  onPick: (value: string) => void
}) {
  return (
    <label className={css.backendOption} htmlFor={props.id}>
      <input
        id={props.id}
        className={css.backendInput}
        type="radio"
        name="dswa-backend"
        value={props.value}
        checked={props.draft === props.value}
        disabled={props.disabled}
        onChange={() => { props.onPick(props.value) }}
      />
      {props.label}
    </label>
  )
}

/** A staged value field (endpoint). */
function ValueField(props: {
  id: string
  label: string
  hint: string
  text: string
  overridden: boolean
  invalid: boolean
  overriddenLabel: string
  resetLabel: string
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
}) {
  return (
    <div className={css.field}>
      <div className={css.head}>
        <label className={css.label} htmlFor={props.id}>{props.label}</label>
        {props.overridden
          ? (
            <span className={css.badges}>
              <span className={css.badge}>{props.overriddenLabel}</span>
              <button
                type="button"
                className={css.reset}
                disabled={props.disabled}
                onClick={props.onReset}
              >
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <input
        id={props.id}
        className={css.input}
        type="text"
        value={props.text}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p className={css.hint}>{props.hint}</p>
    </div>
  )
}

/** A write-only credential control. */
function SecretField(props: {
  id: string
  label: string
  hint: string
  text: string
  configured: boolean
  stateLabel: string
  disabled: boolean
  onEdit: (text: string) => void
}) {
  return (
    <div className={css.field}>
      <div className={css.head}>
        <label className={css.label} htmlFor={props.id}>{props.label}</label>
        <span className={css.badges}>
          <span className={props.configured ? css.badge : css.badgeMuted}>{props.stateLabel}</span>
        </span>
      </div>
      <input
        id={props.id}
        className={css.input}
        type="password"
        autoComplete="off"
        value={props.text}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p className={css.hint}>{props.hint}</p>
    </div>
  )
}
