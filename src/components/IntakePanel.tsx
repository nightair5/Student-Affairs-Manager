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
import type { IntakeInput } from '../lib/intake'
import type { SourceType } from '../types'

interface IntakePanelProps {
  onClose: () => void
  onSubmitIntake: (input: IntakeInput) => Promise<void>
  smartExtractionStatus: 'checking' | 'connected' | 'unavailable'
}

type IntakeFileStatus = FileExtractionStatus | 'idle' | 'reading'

export function IntakePanel({ onClose, onSubmitIntake, smartExtractionStatus }: IntakePanelProps) {
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
    fileStatus !== 'reading' &&
    fileStatus !== 'error' &&
    fileStatus !== 'unsupported' &&
    Boolean(content.trim()) &&
    (!fileNeedsContent || Boolean(fileName))

  const handleParse = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setIsParsing(true)
    try {
      await onSubmitIntake({ sourceType, content, sourceTitle, fileName })
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="intake-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="intake-header">
          <div>
            <span className="eyebrow">第 1 步 · 放入原文</span>
            <h2 id={titleId}>把通知原样放进来</h2>
            <p>不用先整理。下一步会让你核对拆分结果。</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭录入面板">
            <X size={20} />
          </button>
        </header>
        <form className="intake-body" onSubmit={handleParse}>
          <div className="intake-steps" aria-label="录入流程"><span className="active">1 放入原文</span><span>2 核对拆分</span><span>3 回到今日</span></div>
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
              <span>粘贴老师消息、群通知或网页正文</span>
              <textarea ref={firstControlRef} value={content} onChange={(event) => setContent(event.target.value)} rows={7} placeholder="例如：8 月 4 日 18:00 前提交报名表；8 月 6 日上午 9 点参加说明会……" required />
              <small>包含多个时间也没关系，系统会逐条拆开。</small>
              {!content && <button className="example-fill" type="button" onClick={() => setContent('比赛通知：8月4日18:00提交报名表和确认函；8月6日上午9点参加说明会；8月8日20:00上传作品初稿。')}>不会填？放入一段示例</button>}
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
          <div className={`privacy-note ${smartExtractionStatus === 'connected' ? 'cloud-enabled' : 'cloud-unavailable'}`}><Sparkles size={18} /><p>
            <strong>{smartExtractionStatus === 'connected' ? 'DeepSeek V4 Flash 智能整理' : '本地规则兜底可用'}</strong>
            {sourceType === 'link'
              ? ' 当前只保存链接，不会把它伪装成已读取的网页正文。'
              : smartExtractionStatus === 'connected'
                ? ' 点击整理会发送本次粘贴或本机提取的文字，不发送文件本体；结果确认前不会创建任务。'
                : ' DeepSeek 未连接，当前内容不会发往云端，将生成可编辑的本地规则建议。'}
          </p></div>
          <button className="primary-button wide" type="submit" disabled={!canSubmit || isParsing}>
            {isParsing ? <><LoaderCircle className="spin" size={18} />正在智能整理…</> : <><Sparkles size={18} />整理成待确认任务</>}
          </button>
        </form>
      </section>
    </div>
  )
}
