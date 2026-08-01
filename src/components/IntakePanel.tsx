import {
  FileImage,
  FileText,
  Link2,
  LoaderCircle,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { createSuggestions } from '../lib/parser'
import type { ParsedSuggestion, Source, SourceType } from '../types'

interface IntakePanelProps {
  onClose: () => void
  onCreateDraft: (source: Source, suggestions: ParsedSuggestion[]) => void
}

export function IntakePanel({ onClose, onCreateDraft }: IntakePanelProps) {
  const [sourceType, setSourceType] = useState<SourceType>('text')
  const [content, setContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [fileName, setFileName] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const titleId = useId()
  const firstControlRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    firstControlRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setSourceTitle(file.name)
    if (file.type.startsWith('text/') || file.name.endsWith('.md')) {
      setContent((await file.text()).slice(0, 5000))
    } else {
      setContent('')
    }
  }

  const handleParse = (event: FormEvent) => {
    event.preventDefault()
    if (!content.trim() && !sourceTitle.trim() && !fileName) return
    setIsParsing(true)
    window.setTimeout(() => {
      const now = new Date().toISOString()
      const title =
        sourceTitle ||
        fileName ||
        (sourceType === 'link' ? '网页通知链接' : '手动粘贴消息')
      const suggestions = createSuggestions(content, sourceType, title)
      onCreateDraft(
        {
          id: `source-${Date.now()}`,
          type: sourceType,
          title,
          contentPreview:
            content.trim().slice(0, 500) ||
            suggestions.map((suggestion) => suggestion.evidence).join('；'),
          content: sourceType === 'text' ? content.trim().slice(0, 5000) : undefined,
          url: sourceType === 'link' ? content.trim() : undefined,
          createdAt: now,
          extractionStatus: '待确认',
        },
        suggestions,
      )
      setIsParsing(false)
      onClose()
    }, 480)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="intake-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="intake-header">
          <div>
            <span className="eyebrow">统一录入</span>
            <h2 id={titleId}>把通知交给管家整理</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭录入面板">
            <X size={20} />
          </button>
        </header>
        <form className="intake-body" onSubmit={handleParse}>
          <div className="source-tabs" role="tablist" aria-label="选择来源">
            <button type="button" className={sourceType === 'text' ? 'active' : ''} onClick={() => setSourceType('text')}>
              <FileText size={17} />粘贴消息
            </button>
            <button type="button" className={sourceType === 'file' || sourceType === 'image' ? 'active' : ''} onClick={() => setSourceType('file')}>
              <FileImage size={17} />上传文件
            </button>
            <button type="button" className={sourceType === 'link' ? 'active' : ''} onClick={() => setSourceType('link')}>
              <Link2 size={17} />网页链接
            </button>
          </div>
          {sourceType === 'text' && (
            <label className="field">
              <span>老师或群聊消息</span>
              <textarea ref={firstControlRef} value={content} onChange={(event) => setContent(event.target.value)} rows={10} placeholder="例如：请大家 8 月 4 日 18:00 前提交报名表和确认函……" required />
              <small>原文与演示建议会先进入待确认队列，不会直接创建任务。</small>
            </label>
          )}
          {sourceType === 'file' && (
            <div className="upload-zone">
              <Upload size={30} strokeWidth={1.5} />
              <strong>{fileName || '选择文件、图片或扫描件'}</strong>
              <p>当前只保存文件名；文本文件可在本机读取。PDF、图片和 OCR 尚未接通。</p>
              <label className="secondary-button file-picker">选择文件
                <input type="file" accept=".txt,.md,.pdf,.doc,.docx,image/*" onChange={handleFile} required />
              </label>
            </div>
          )}
          {sourceType === 'link' && (
            <>
              <label className="field"><span>网页标题</span><input type="text" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="例如：学院 2026 推免预通知" required /></label>
              <label className="field"><span>网页链接</span><input type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://..." required /><small>当前只保存链接，尚未抓取网页正文或监测变更。</small></label>
            </>
          )}
          <div className="privacy-note"><Sparkles size={18} /><p><strong>本地演示识别</strong> 不会上传内容。日期、分类和材料均为可编辑建议，须经你确认后才创建任务。</p></div>
          <button className="primary-button wide" type="submit" disabled={isParsing || (!content.trim() && !sourceTitle.trim() && !fileName)}>
            {isParsing ? <><LoaderCircle className="spin" size={18} />正在生成演示建议</> : <><Sparkles size={18} />保存并查看待确认建议</>}
          </button>
        </form>
      </section>
    </div>
  )
}
