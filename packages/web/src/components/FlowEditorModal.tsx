import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { yaml as yamlLang } from '@codemirror/lang-yaml'
import { parseFlowYaml } from '@openhop/shared'
import type { ValidationError } from '@openhop/shared'
import type { MutationError } from '../hooks/useFlowMutations'
import { STARTER_YAML } from '../lib/starter-yaml'

export interface FlowEditorModalProps {
  open: boolean
  /** Pre-populated YAML for "edit" mode. Empty string ⇒ "new" mode (uses STARTER_YAML). */
  initialYaml: string
  /** Header label — "New flow" / "Edit flow". */
  title: string
  /** True while the parent's mutation is in flight. */
  saving: boolean
  /** Surfaced from the parent's useFlowMutations() — server errors after save. */
  serverError: MutationError | null
  onSave: (yamlText: string) => void
  onCancel: () => void
  /**
   * 'server' (default) — Save POSTs the YAML to /api/flows.
   * 'fragment' — GitHub Pages deploy with no backend; Save copies the YAML
   * into a sharable URL fragment and writes it to the clipboard.
   */
  mode?: 'server' | 'fragment'
}

/**
 * YAML editor modal. Validates locally via parseFlowYaml() (sub-100ms) so the
 * "Save" button is disabled until the schema passes. Server errors land in
 * serverError; we render those distinctly because they may include path
 * suggestions that local validation didn't catch (e.g. node-ref existence).
 */
export function FlowEditorModal({
  open,
  initialYaml,
  title,
  saving,
  serverError,
  onSave,
  onCancel,
  mode = 'server',
}: FlowEditorModalProps) {
  const isFragment = mode === 'fragment'
  const [text, setText] = useState(initialYaml || STARTER_YAML)
  const onSaveRef = useRef(onSave)
  const onCancelRef = useRef(onCancel)
  const textRef = useRef(text)
  // While `saving` is true we freeze every dismiss + save trigger:
  // POST /api/flows is non-idempotent, so allowing Cmd+Enter to fire twice
  // (or Esc/backdrop to "dismiss" while a save is mid-flight) would create
  // duplicate flows or hidden background saves. The Save button itself is
  // already gated via disabled={!canSave}; this ref carries the same gate
  // into the keyboard / backdrop / Cancel paths through the closure.
  const savingRef = useRef(saving)
  // Refs for focus management — see the focus-trap effect below.
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onSaveRef.current = onSave
    onCancelRef.current = onCancel
    textRef.current = text
    savingRef.current = saving
  })

  // Re-seed the editor whenever the modal opens with a new flow.
  useEffect(() => {
    if (open) setText(initialYaml || STARTER_YAML)
  }, [open, initialYaml])

  const localValidation = useMemo(() => parseFlowYaml(text), [text])

  // Focus management: on open, save the previously-focused element and move
  // focus into the dialog. On close, restore focus. Without this, keyboard
  // users could Tab into the sidebar/header behind the overlay even though
  // role="dialog" + aria-modal are set.
  useEffect(() => {
    if (!open) return
    previouslyFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null
    // Defer to next frame so the dialog's children (CodeMirror, buttons) are
    // mounted and focusable.
    const t = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (first) first.focus()
      else dialogRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(t)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open])

  // Keyboard handler — combines:
  //   - Esc: cancel (no-op while saving)
  //   - Cmd/Ctrl-Enter: save (no-op while saving / invalid)
  //   - Tab / Shift-Tab: trap focus inside the dialog
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        // Edge cases: if focus is somehow outside the dialog, pull it back in.
        if (active && !dialogRef.current.contains(active)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
          return
        }
        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      if (savingRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancelRef.current()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (parseFlowYaml(textRef.current).success) {
          onSaveRef.current(textRef.current)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const validationErrors: ValidationError[] = localValidation.success ? [] : localValidation.errors
  const canSave = localValidation.success && !saving

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="flow-editor-modal"
      tabIndex={-1}
      onClick={(e) => {
        // Backdrop click dismisses, but only when no save is in flight — see
        // savingRef rationale at the top of the component.
        if (!saving && e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        className="flex flex-col"
        style={{
          width: 'min(720px, 90vw)',
          height: 'min(640px, 90vh)',
          background: '#141428',
          border: '2px solid #2a2a4a',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 shrink-0"
          style={{ borderBottom: '1px solid #2a2a4a', background: '#1a1a2e' }}
        >
          <h2 className="font-pixel text-accent" style={{ fontSize: 12 }}>
            {title}
          </h2>
          <button
            aria-label="Close"
            onClick={onCancel}
            disabled={saving}
            className="font-pixel text-text/60 hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <CodeMirror
            data-testid="flow-editor-textarea"
            value={text}
            onChange={(v) => setText(v)}
            extensions={[yamlLang()]}
            theme="dark"
            height="100%"
            style={{ height: '100%', fontSize: 13 }}
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
          />
        </div>

        {/* Validation feedback */}
        <div
          className="shrink-0 px-3 py-2 font-terminal text-xs overflow-y-auto"
          style={{
            maxHeight: 120,
            borderTop: '1px solid #2a2a4a',
            background: '#0d0d1a',
            color: validationErrors.length > 0 || serverError ? '#ff8a8a' : '#7df9ff',
          }}
          data-testid="flow-editor-validation"
        >
          {validationErrors.length === 0 && !serverError && '✓ Valid OpenHop flow'}
          {validationErrors.map((err, i) => (
            <div key={i}>
              <span className="text-text/60">{err.path || '(root)'}:</span> {err.message}
              {err.suggestion ? <span className="text-text/40"> — {err.suggestion}</span> : null}
            </div>
          ))}
          {serverError &&
            (serverError.details && serverError.details.length > 0 ? (
              serverError.details.map((d, i) => (
                <div key={`s-${i}`}>
                  <span className="text-text/60">{d.path || '(root)'}:</span> {d.message}
                  {d.suggestion ? <span className="text-text/40"> — {d.suggestion}</span> : null}
                </div>
              ))
            ) : (
              <div>
                <span className="text-text/60">server:</span> {serverError.message}
              </div>
            ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-3 py-2 shrink-0"
          style={{ borderTop: '1px solid #2a2a4a', background: '#1a1a2e' }}
        >
          <span className="font-terminal text-xs text-text/40 mr-auto">
            {isFragment
              ? '⌘/Ctrl-Enter to copy URL · Esc to cancel'
              : '⌘/Ctrl-Enter to save · Esc to cancel'}
          </span>
          <button
            onClick={onCancel}
            disabled={saving}
            className="font-pixel text-xs px-3 py-1 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontSize: 10,
              background: 'transparent',
              borderColor: '#2a2a4a',
              color: 'rgba(224, 224, 255, 0.7)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!canSave}
            onClick={() => canSave && onSave(text)}
            className="font-pixel text-xs px-3 py-1 border transition-colors"
            style={{
              fontSize: 10,
              background: canSave ? 'rgba(125, 249, 255, 0.12)' : 'transparent',
              borderColor: canSave ? '#7df9ff' : '#2a2a4a',
              color: canSave ? '#7df9ff' : 'rgba(224, 224, 255, 0.3)',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            data-testid="flow-editor-save"
          >
            {saving
              ? isFragment
                ? 'Copying…'
                : 'Saving…'
              : isFragment
                ? 'Copy share URL'
                : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
