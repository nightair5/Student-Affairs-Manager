import { FilePenLine, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'
import type { Source } from '../types'

interface SourceSupplementPanelProps {
  source: Source
  onClose: () => void
  onSubmit: (content: string, operationId: string) => Promise<void>
}

export function SourceSupplementPanel({ source, onClose, onSubmit }: SourceSupplementPanelProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const operationIdRef = useRef(crypto.randomUUID())
  const originalContent = source.rawText ?? source.content ?? source.contentPreview
  const [content, setContent] = useState(originalContent)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useDialogFocusTrap(panelRef, submitting ? () => undefined : onClose, textRef)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = content.trim()
    if (!normalized || submitting) return
    if (normalized === originalContent.trim()) {
      setError('文字没有变化；请关闭后使用“本地规则重试”。')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(normalized, operationIdRef.current)
    } catch (cause) {
      setError(cause instanceof Error && cause.message.trim() ? cause.message : '手工补充未保存，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <section ref={panelRef} className="detail-panel source-supplement-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="detail-header">
        <div><span className="eyebrow">沿用既有来源</span><h2 id={titleId}>手工补充来源文字</h2><p>{source.title}</p></div>
        <button className="icon-button" type="button" onClick={onClose} disabled={submitting} aria-label="关闭手工补充"><X size={20} /></button>
      </header>
      <form className="detail-body source-supplement-body" onSubmit={(event) => void submit(event)}>
        <div className="source-trust-summary"><ShieldCheck size={19} /><p>提交后会在同一 Source 下新增可追踪版本，并建立本地规则待确认草稿；不会新建重复来源，也不会直接创建任务。</p></div>
        <label className="field">
          <span>核对并补充原始文字</span>
          <textarea ref={textRef} value={content} onChange={(event) => {
            setContent(event.target.value)
            if (error) {
              setError(null)
              operationIdRef.current = crypto.randomUUID()
            }
          }} rows={14} maxLength={50_000} required />
          <small>{content.length.toLocaleString('zh-CN')} / 50,000 字；请保留关键日期、材料与原文措辞。</small>
        </label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <footer className="detail-footer source-supplement-actions">
          <button className="primary-button" type="submit" disabled={!content.trim() || content.trim() === originalContent.trim() || submitting}>
            {submitting ? <LoaderCircle className="spin" size={17} /> : <FilePenLine size={17} />}
            {submitting ? '正在保存版本…' : '建立待确认草稿'}
          </button>
          <button className="text-button" type="button" onClick={onClose} disabled={submitting}>取消</button>
        </footer>
      </form>
    </section>
  </div>
}
