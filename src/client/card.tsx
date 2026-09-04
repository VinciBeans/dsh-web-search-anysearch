/**
 * The AnySearch switch card on the Plugins page: its backend switch, the
 * AnySearch endpoint, and the AnySearch key — written through the credentials
 * domain, never into the settings section, so the literal never rides a
 * response.
 * @module @wenqi_bian/dsh-web-search-anysearch/client/card
 */

import * as React from 'react'
import type { AnySearchCardState } from './controller.ts'
import type { AnySearchLocaleKey } from './locales.ts'
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
}

/**
 * Render the AnySearch switch card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function AnySearchCard(props: AnySearchCardProps) {
  const [open, setOpen] = React.useState(false)
  const saveStarted = React.useRef(false)
  const state = props.useAnysearchCard(snapshot => snapshot)
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
  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
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
                disabled={blocked}
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
