import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { yaml as yamlLang } from '@codemirror/lang-yaml'
import { parseFlowYaml } from '@openhop/shared'
import type { ValidationError } from '@openhop/shared'
import type { MutationError } from '../hooks/useFlowMutations'

/**
 * Default seed used when the parent doesn't supply an `initialYaml`.
 * For path-aware "New flow" / "New folder" calls the parent should build a
 * starter via `buildStarterYaml(path)` and pass it explicitly.
 */
const STARTER_YAML = `meta:
  title: New flow
flow:
  nodes:
    - id: browser
      label: Browser
      type: actor
    - id: api
      label: API
      type: endpoint
  steps:
    - from: browser
      to: api
      data: request
    - from: api
      to: browser
      data: response
`

/** Build the seed YAML for a "New flow" inside a given folder path. */
export function buildStarterYaml(path?: string): string {
  if (!path) return STARTER_YAML
  // Inject `path:` under meta. Match the shape of STARTER_YAML literally.
  return STARTER_YAML.replace(
    /^meta:\n  title: New flow\n/,
    `meta:\n  title: New flow\n  path: ${path}\n`
  )
}

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
}: FlowEditorModalProps) {
  const [text, setText] = useState(initialYaml || STARTER_YAML)
  const onSaveRef = useRef(onSave)
  const onCancelRef = useRef(onCancel)
  const textRef = useRef(text)

  useEffect(() => {
    onSaveRef.current = onSave
    onCancelRef.current = onCancel
    textRef.current = text
  })

  // Re-seed the editor whenever the modal opens with a new flow.
  useEffect(() => {
    if (open) setText(initialYaml || STARTER_YAML)
  }, [open, initialYaml])

  const localValidation = useMemo(() => parseFlowYaml(text), [text])

  // Keyboard shortcuts: Cmd/Ctrl-Enter saves, Esc cancels.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
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
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="flow-editor-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
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
            className="font-pixel text-text/60 hover:text-text transition-colors"
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
            ⌘/Ctrl-Enter to save · Esc to cancel
          </span>
          <button
            onClick={onCancel}
            className="font-pixel text-xs px-3 py-1 border transition-colors"
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
