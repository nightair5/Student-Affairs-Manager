import {
  Camera,
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
  type DragEvent,
  type FormEvent,
} from 'react'
import {
  extractFileContent,
  type FileExtractionStatus,
} from '../lib/fileExtraction'
import { createSuggestions } from '../lib/parser'
import type { ParsedSuggestion, Source, SourceType } from '../types'

interface IntakePanelProps {
  onClose: () => void
  onCreateDraft: (source: Source, suggestions: ParsedSuggestion[]) => void
}

type IntakeFileStatus = FileExtractionStatus | 'idle' | 'reading'

export function IntakePanel({ onClose, onCreateDraft }: IntakePanelProps) {
  const [sourceType, setSourceType] = useState<SourceType>('text')
  const [content, setContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileStatus, setFileStatus] = useState<IntakeFileStatus>('idle')
  const [fileMessage, setFileMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
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

  const selectSourceType = (nextType: SourceType) => {
    setSourceType(nextType)
    setContent('')
    setSourceTitle('')
    setFileName('')
    setFileStatus('idle')
    setFileMessage('')
  }

  const processFile = async (file: File) => {
    const isImage = file.type.startsWith('image/')
    setSourceType(isImage ? 'image' : 'file')
    setFileName(file.name)
    setSourceTitle(file.name)
    setContent('')
    setFileStatus('reading')
    setFileMessage('正在本机读取，不会上传文件……')
    const result = await extractFileContent(file)
    setContent(result.text)
    setFileStatus(result.status)
    setFileMessage(result.message)
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void processFile(file)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void processFile(file)
  }

  const fileNeedsContent = sourceType === 'file' || sourceType === 'image'
  const canSubmit =
    !isParsing &&
    fileStatus !== 'reading' &&
    fileStatus !== 'error' &&
    fileStatus !== 'unsupported' &&
    Boolean(content.trim()) &&
    (!fileNeedsContent || Boolean(fileName))

  const handleParse = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setIsParsing(true)
    window.setTimeout(() => {
      const now = new Date().toISOString()
      const title =
        sourceTitle ||
        fileName ||
        (sourceType === 'link' ? '网页通知链接' : '手动粘贴消息')
      const cleanContent = content.trim().slice(0, 50_000)
      const suggestions = createSuggestions(cleanContent, sourceType, title)
      onCreateDraft(
        {
          id: `source-${Date.now()}`,
          type: sourceType,
          title,
          contentPreview: cleanContent.slice(0, 500),
          content: sourceType === 'link' ? undefined : cleanContent,
          url: sourceType === 'link' ? cleanContent : undefined,
          createdAt: now,
          extractionStatus: '待确认',
        },
        suggestions,
      )
      setIsParsing(false)
      onClose()
    }, 320)
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
            <button type="button" className={sourceType === 'text' ? 'active' : ''} onClick={() => selectSourceType('text')}>
              <FileText size={17} />粘贴消息
            </button>
            <button type="button" className={sourceType === 'file' || sourceType === 'image' ? 'active' : ''} onClick={() => selectSourceType('file')}>
              <FileImage size={17} />上传文件
            </button>
            <button type="button" className={sourceType === 'link' ? 'active' : ''} onClick={() => selectSourceType('link')}>
              <Link2 size={17} />网页链接
            </button>
          </div>
          {sourceType === 'text' && (
            <label className="field">
              <span>老师或群聊消息</span>
              <textarea ref={firstControlRef} value={content} onChange={(event) => setContent(event.target.value)} rows={10} placeholder="例如：请大家 8 月 4 日 18:00 前提交报名表和确认函……" required />
              <small>原文与本地识别建议会先进入待确认队列，不会直接创建任务。</small>
            </label>
          )}
          {(sourceType === 'file' || sourceType === 'image') && (
            <>
              <div
                className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false)
                }}
                onDrop={handleDrop}
              >
                {fileStatus === 'reading' ? <LoaderCircle className="spin" size={30} /> : <Upload size={30} strokeWidth={1.5} />}
                <strong>{fileName || '拖入文件，或从设备中选择'}</strong>
                <p>支持 TXT、Markdown、带文本层的 PDF 和图片。只保存提取文字，不保存文件本体。</p>
                <div className="upload-actions">
                  <label className="secondary-button file-picker">选择文件
                    <input type="file" accept=".txt,.md,.markdown,.pdf,image/*" onChange={handleFile} />
                  </label>
                  <label className="secondary-button file-picker mobile-capture"><Camera size={16} />拍摄截图
                    <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
                  </label>
                </div>
                {fileMessage && (
                  <p className={`extraction-state ${fileStatus}`} role={fileStatus === 'error' || fileStatus === 'unsupported' ? 'alert' : 'status'}>
                    {fileMessage}
                  </p>
                )}
              </div>
              {fileName && (
                <label className="field manual-source-field">
                  <span>{fileStatus === 'ready' ? '已提取原文（可核对修改）' : '人工补充原文（必填）'}</span>
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} placeholder="请粘贴或输入通知中的日期、事项、材料等原文……" required />
                  <small>扫描件和图片的 OCR 尚未接通；填写的原文会作为后续任务的可回看依据。</small>
                </label>
              )}
            </>
          )}
          {sourceType === 'link' && (
            <>
              <label className="field"><span>网页标题</span><input type="text" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="例如：学院 2026 推免预通知" required /></label>
              <label className="field"><span>网页链接</span><input type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://..." required /><small>当前只保存链接，尚未抓取网页正文或监测变更。</small></label>
            </>
          )}
          <div className="privacy-note"><Sparkles size={18} /><p><strong>本地规则识别</strong> 不会上传内容。日期、分类和材料均为可编辑建议，须经你确认后才创建任务。</p></div>
          <button className="primary-button wide" type="submit" disabled={!canSubmit}>
            {isParsing ? <><LoaderCircle className="spin" size={18} />正在生成本地建议</> : <><Sparkles size={18} />保存并查看待确认建议</>}
          </button>
        </form>
      </section>
    </div>
  )
}
