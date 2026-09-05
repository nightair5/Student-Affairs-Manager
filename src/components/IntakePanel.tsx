import {
  Camera,
  FileImage,
  FileText,
  ImageUp,
  Link2,
  LoaderCircle,
  PenLine,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import {
  extractFileEvidence,
} from '../lib/fileExtraction'
import { fetchAuthorizedLinkText } from '../lib/linkExtraction'
import {
  isSupportedMultimodalImage,
  parsePdfPageSelection,
  prepareMultimodalInput,
} from '../lib/multimodal'
import {
  canSaveLinkOnly,
  canSubmitIntake,
  fileReviewMetadataFromExtraction,
  type IntakeFileStatus,
  type IntakeInput,
} from '../lib/intake'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'
import type { Priority, SourceReviewMetadata, SourceType, TaskCategory } from '../types'

interface IntakePanelProps {
  textOnly?: boolean
  onClose: () => void
  onSubmitIntake: (input: IntakeInput) => Promise<void>
  onSaveSource: (input: IntakeInput) => Promise<void>
  smartExtractionStatus: 'checking' | 'connected' | 'unavailable'
}

export function IntakePanel({ textOnly, onClose, onSubmitIntake, onSaveSource, smartExtractionStatus }: IntakePanelProps) {
  const [sourceType, setSourceType] = useState<SourceType>('text')
  const [manualMode, setManualMode] = useState(false)
  const [content, setContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [fileName, setFileName] = useState('')
  const [mimeType, setMimeType] = useState('')
  const [fileSize, setFileSize] = useState<number | undefined>()
  const [fileHash, setFileHash] = useState('')
  const [fileStatus, setFileStatus] = useState<IntakeFileStatus>('idle')
  const [fileMessage, setFileMessage] = useState('')
  const [fileProgress, setFileProgress] = useState(0)
  const [fileReviewMetadata, setFileReviewMetadata] = useState<SourceReviewMetadata>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [multimodalConsent, setMultimodalConsent] = useState(false)
  const [pdfPageSelection, setPdfPageSelection] = useState('1')
  const [multimodalMessage, setMultimodalMessage] = useState('')
  const [multimodalError, setMultimodalError] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkAuthorized, setLinkAuthorized] = useState(false)
  const [linkStatus, setLinkStatus] = useState<'idle' | 'reading' | 'ready' | 'error'>('idle')
  const [linkMessage, setLinkMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isSavingSource, setIsSavingSource] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualDeadline, setManualDeadline] = useState('')
  const [manualDuration, setManualDuration] = useState(30)
  const [manualNextAction, setManualNextAction] = useState('')
  const [manualCategory, setManualCategory] = useState<TaskCategory>('其他')
  const [manualPriority, setManualPriority] = useState<Priority>('中')
  const [manualMaterials, setManualMaterials] = useState('')
  const titleId = useId()
  const operationIdRef = useRef(crypto.randomUUID())
  const fileGenerationRef = useRef(0)
  const firstControlRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocusTrap(panelRef, onClose, firstControlRef)

  const selectSourceType = (nextType: SourceType) => {
    if (textOnly && nextType !== 'text') return
    fileGenerationRef.current += 1
    setManualMode(false)
    setSourceType(nextType)
    setContent('')
    setSourceTitle('')
    setFileName('')
    setMimeType('')
    setFileSize(undefined)
    setFileHash('')
    setFileStatus('idle')
    setFileMessage('')
    setFileProgress(0)
    setFileReviewMetadata({})
    setSelectedFile(null)
    setMultimodalConsent(false)
    setPdfPageSelection('1')
    setMultimodalMessage('')
    setMultimodalError('')
    setLinkUrl('')
    setLinkAuthorized(false)
    setLinkStatus('idle')
    setLinkMessage('')
  }

  const selectManualMode = () => {
    if (textOnly) return
    fileGenerationRef.current += 1
    setManualMode(true)
    setSourceType('text')
    setContent('')
    setFileName('')
    setFileStatus('idle')
    setFileMessage('')
    setFileProgress(0)
    setFileReviewMetadata({})
    setSelectedFile(null)
    setMultimodalConsent(false)
    setPdfPageSelection('1')
    setMultimodalMessage('')
    setMultimodalError('')
  }

  const processFile = async (file: File) => {
    if (textOnly) return
    const generation = fileGenerationRef.current + 1
    fileGenerationRef.current = generation
    const isCurrent = () => fileGenerationRef.current === generation
    const isImage = file.type.startsWith('image/') || isSupportedMultimodalImage(file)
    setSelectedFile(file)
    setMultimodalConsent(false)
    setPdfPageSelection('1')
    setMultimodalMessage('')
    setMultimodalError('')
    setSourceType(isImage ? 'image' : 'file')
    setFileName(file.name)
    setMimeType(file.type)
    setFileSize(file.size)
    setSourceTitle(file.name)
    setContent('')
    setFileHash('')
    setFileReviewMetadata({})
    setFileStatus('reading')
    setFileMessage('正在本机读取，不会上传文件……')
    setFileProgress(0)
    const evidence = await extractFileEvidence(file, {
      isCurrent,
      onProgress: ({ progress, message }) => {
        if (!isCurrent()) return
        setFileProgress(Math.max(0, Math.min(100, Math.round(progress * 100))))
        setFileMessage(message)
      },
    })
    if (!evidence || !isCurrent()) return
    const { result, fileHash: nextFileHash } = evidence
    setFileHash(nextFileHash)
    setContent(result.text)
    setFileReviewMetadata(fileReviewMetadataFromExtraction(isImage ? 'image' : 'file', file.type, result))
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

  const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
    if (textOnly) return
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'))
    if (!image) return
    event.preventDefault()
    void processFile(image)
  }

  const canSubmit = canSubmitIntake({
    manualMode,
    manualTitle,
    manualDeadline,
    manualNextAction,
    sourceType,
    content,
    fileStatus,
    fileName,
    linkUrl,
  })
  const selectedFileIsPdf = Boolean(selectedFile && (
    selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')
  ))
  const isScannedPdf = selectedFileIsPdf && ['ocr', 'mixed'].includes(String(fileReviewMetadata.extractionMethod))
  const isMultimodalCandidate = Boolean(selectedFile && (sourceType === 'image' || isScannedPdf))
  const imageFormatSupported = Boolean(selectedFile && (
    selectedFileIsPdf || isSupportedMultimodalImage(selectedFile)
  ))
  const pageSelection = isScannedPdf
    ? parsePdfPageSelection(pdfPageSelection, fileReviewMetadata.pageCount ?? 0)
    : { pages: [] as number[] }
  const multimodalReady = isMultimodalCandidate
    && imageFormatSupported
    && smartExtractionStatus === 'connected'
    && (!isScannedPdf || !pageSelection.error)
  const canSubmitWithConsent = canSubmit && (!multimodalConsent || multimodalReady)
  const canSaveLink = sourceType === 'link' && canSaveLinkOnly(linkUrl, sourceTitle)

  const handleParse = async (event: FormEvent) => {
    if (textOnly && (sourceType !== 'text' || manualMode)) { event.preventDefault(); return }
    event.preventDefault()
    if (!canSubmitWithConsent) return
    setIsParsing(true)
    setMultimodalError('')
    try {
      if (manualMode) {
        const evidence = `手动录入：${manualTitle.trim()}；截止 ${manualDeadline}；下一步 ${manualNextAction.trim()}`
        await onSubmitIntake({
          operationId: operationIdRef.current,
          sourceType: 'text',
          content: evidence,
          sourceTitle: `手动任务 · ${manualTitle.trim()}`,
          reviewMetadata: {
            sourceType: 'text',
            characterCount: evidence.length,
            extractionMethod: 'manual',
          },
          manualSuggestion: {
            id: `manual-${new Date().getTime()}`,
            title: manualTitle.trim(),
            category: manualCategory,
            deadline: manualDeadline,
            estimatedMinutes: manualDuration,
            nextAction: manualNextAction.trim(),
            description: '由用户手动录入，仍需确认后创建。',
            priority: manualPriority,
            materials: manualMaterials.split(/[，,、]/).map((value) => value.trim()).filter(Boolean),
            evidence,
            confidence: '高',
          },
        })
      } else {
        const reviewMetadata: SourceReviewMetadata = sourceType === 'file' || sourceType === 'image'
          ? { ...fileReviewMetadata, characterCount: content.trim().length }
          : sourceType === 'link'
            ? {
                sourceType: 'link',
                characterCount: content.trim().length,
                extractionMethod: linkStatus === 'ready' ? 'web' : 'manual',
              }
            : {
                sourceType: 'text',
                characterCount: content.trim().length,
                extractionMethod: 'manual',
              }
        const multimodal = multimodalConsent && selectedFile
          ? await prepareMultimodalInput(selectedFile, {
              pdfPages: isScannedPdf ? pageSelection.pages : undefined,
              onProgress: setMultimodalMessage,
            })
          : undefined
        await onSubmitIntake({ operationId: operationIdRef.current, sourceType, content, sourceTitle, fileName, mimeType, fileSize, fileHash, url: linkUrl, reviewMetadata, multimodal })
      }
    } catch (cause) {
      setMultimodalError(cause instanceof Error ? cause.message : '本次图片准备失败，请关闭多模态开关后使用文字版。')
    } finally {
      setMultimodalMessage('')
      setIsParsing(false)
    }
  }

  const readLink = async () => {
    if (textOnly) return
    if (!linkAuthorized || !linkUrl.trim()) return
    setLinkStatus('reading')
    setLinkMessage('正在通过受控服务读取网页正文，不执行页面脚本……')
    try {
      const result = await fetchAuthorizedLinkText(linkUrl.trim())
      setLinkUrl(result.finalUrl)
      setSourceTitle((current) => current.trim() || result.title)
      setContent(result.text)
      setLinkStatus('ready')
      setLinkMessage(`已读取网页正文（${result.text.length.toLocaleString('zh-CN')} 字）。请核对后再交给 DeepSeek 整理。`)
    } catch (cause) {
      setLinkStatus('error')
      setLinkMessage(cause instanceof Error ? cause.message : '网页正文读取失败，请粘贴正文后继续。')
    }
  }

  const saveLinkOnly = async () => {
    if (textOnly) return
    if (!canSaveLink) return
    setIsSavingSource(true)
    setLinkMessage('正在保存链接；不会读取网页正文，也不会创建识别草稿……')
    try {
      await onSaveSource({
        operationId: operationIdRef.current,
        sourceType: 'link',
        content: '',
        sourceTitle,
        url: linkUrl,
        reviewMetadata: {
          sourceType: 'link',
          characterCount: 0,
          extractionMethod: 'unknown',
        },
      })
    } catch (cause) {
      setLinkStatus('error')
      setLinkMessage(cause instanceof Error ? cause.message : '链接保存失败，请稍后重试。')
    } finally {
      setIsSavingSource(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={panelRef} className="intake-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onPaste={handlePaste}>
        <header className="intake-header">
          <div>
            <span className="eyebrow">E2-MM 独立 Preview · 第 1 步</span>
            <h2 id={titleId}>把通知原样放进来</h2>
            <p>不用先整理。下一步会让你核对拆分结果。</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭录入面板">
            <X size={20} />
          </button>
        </header>
        {textOnly && <p>仅测试旧匿名工程通知文字；文件、图片、链接、手动任务本轮未测量。</p>}
        <form className="intake-body" onSubmit={handleParse}>
          <div className="intake-steps" aria-label="录入流程"><span className="active">1 放入原文</span><span>2 核对拆分</span><span>3 回到今日</span></div>
          <div className="source-tabs" role="tablist" aria-label="选择来源">
            <button type="button" className={!manualMode && sourceType === 'text' ? 'active' : ''} onClick={() => selectSourceType('text')}>
              <FileText size={17} />粘贴消息
            </button>
            <button type="button" className={!manualMode && (sourceType === 'file' || sourceType === 'image') ? 'active' : ''} disabled={textOnly} onClick={() => selectSourceType('file')}>
              <FileImage size={17} />上传文件
            </button>
            <button type="button" className={!manualMode && sourceType === 'link' ? 'active' : ''} disabled={textOnly} onClick={() => selectSourceType('link')}>
              <Link2 size={17} />网页链接
            </button>
            <button type="button" className={manualMode ? 'active' : ''} disabled={textOnly} onClick={selectManualMode}>
              <PenLine size={17} />手动建任务
            </button>
          </div>
          {!manualMode && sourceType === 'text' && (
            <label className="field">
              <span>粘贴老师消息、群通知或网页正文</span>
              <textarea ref={firstControlRef} value={content} onChange={(event) => setContent(event.target.value)} rows={7} placeholder="例如：8 月 4 日 18:00 前提交报名表；8 月 6 日上午 9 点参加说明会……" required />
              <small>包含多个时间也没关系，系统会逐条拆开。</small>
              {!textOnly && !content && <button className="example-fill" type="button" onClick={() => setContent('比赛通知：8月4日18:00提交报名表和确认函；8月6日上午9点参加说明会；8月8日20:00上传作品初稿。')}>不会填？放入一段示例</button>}
            </label>
          )}
          {!manualMode && (sourceType === 'file' || sourceType === 'image') && (
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
                <p>支持 20 MB 内的 TXT、Markdown、DOCX、逐页混合 PDF 和图片；也可直接粘贴截图。只保存提取文字与文件指纹，不保存文件本体。</p>
                <div className="upload-actions">
                  <label className="secondary-button file-picker">选择文件
                    <input type="file" accept=".txt,.md,.markdown,.docx,.pdf,image/*" onChange={handleFile} />
                  </label>
                  <label className="secondary-button file-picker mobile-capture"><Camera size={16} />拍摄截图
                    <input type="file" accept="image/*" capture="environment" onChange={handleFile} />
                  </label>
                </div>
                {fileMessage && (
                  <div className={`extraction-state ${fileStatus}`} role={fileStatus === 'error' || fileStatus === 'unsupported' ? 'alert' : 'status'}>
                    <p>{fileMessage}</p>
                    {fileStatus === 'reading' && fileProgress > 0 && (
                      <progress value={fileProgress} max="100" aria-label="本地文字识别进度">{fileProgress}%</progress>
                    )}
                  </div>
                )}
              </div>
              {fileName && (
                <label className="field manual-source-field">
                  <span>{fileStatus === 'ready' ? '已提取原文（可核对修改）' : '人工补充原文（必填）'}</span>
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} placeholder="请粘贴或输入通知中的日期、事项、材料等原文……" required />
                  <small>默认只发送你核对后的提取文字。仅当你主动打开下方多模态开关时，才会额外发送本次图片或所选 PDF 页面。</small>
                </label>
              )}
              {isMultimodalCandidate && selectedFile && (
                <section className={`multimodal-consent ${multimodalConsent ? 'enabled' : ''}`} aria-labelledby="multimodal-consent-title">
                  <label className="multimodal-switch">
                    <input
                      type="checkbox"
                      checked={multimodalConsent}
                      disabled={smartExtractionStatus !== 'connected' || !imageFormatSupported}
                      onChange={(event) => {
                        setMultimodalConsent(event.target.checked)
                        setMultimodalError('')
                        setMultimodalMessage('')
                      }}
                    />
                    <span>
                      <ImageUp size={18} aria-hidden="true" />
                      <strong id="multimodal-consent-title">允许发送本次图片以提高识别</strong>
                    </span>
                  </label>
                  <p>
                    {isScannedPdf
                      ? '开启后会把你选中的 PDF 页面转换为图片，并连同你核对后的 OCR 文字、来源标题、参考时间/时区，以及限量的已有项目与未完成任务摘要发送给实验模型。'
                      : '开启后会发送这 1 张原图，并连同你核对后的 OCR 文字、来源标题、参考时间/时区，以及限量的已有项目与未完成任务摘要发送给实验模型。'}
                    不会发送其他文件、整个工作区、历史全文或图片到本机存储/导出；输出仍只是待确认建议。
                  </p>
                  {isScannedPdf && (
                    <label className="field multimodal-pages">
                      <span>本次发送的 PDF 页码（最多 4 页）</span>
                      <input
                        type="text"
                        value={pdfPageSelection}
                        onChange={(event) => setPdfPageSelection(event.target.value)}
                        placeholder="例如：1,3 或 2-4"
                        disabled={!multimodalConsent}
                        aria-invalid={multimodalConsent && Boolean(pageSelection.error)}
                      />
                      <small>共 {fileReviewMetadata.pageCount ?? '未知'} 页；只发送这里列出的页面，不发送 PDF 文件本体。</small>
                    </label>
                  )}
                  {!imageFormatSupported && <p className="consent-error" role="alert">实验模型只接收 JPEG、PNG、GIF 或 WebP；请先转为受支持图片。</p>}
                  {smartExtractionStatus !== 'connected' && <p className="consent-error" role="status">云端实验接口当前未连接，开关保持不可用；仍可使用默认文字版。</p>}
                  {multimodalConsent && pageSelection.error && <p className="consent-error" role="alert">{pageSelection.error}</p>}
                  {multimodalMessage && <p className="consent-status" role="status">{multimodalMessage}</p>}
                  {multimodalError && <p className="consent-error" role="alert">{multimodalError}</p>}
                </section>
              )}
            </>
          )}
          {!manualMode && sourceType === 'link' && (
            <>
              <label className="field"><span>网页标题</span><input type="text" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="例如：学院 2026 推免预通知" required /></label>
              <label className="field"><span>网页链接</span><input type="url" value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setContent(''); setLinkStatus('idle'); setLinkMessage('') }} placeholder="https://..." required /><small>支持任意公网 HTTPS 页面；重定向逐跳校验，不读取内网地址，也不执行页面脚本。</small></label>
              <button className="secondary-button wide" type="button" onClick={() => void saveLinkOnly()} disabled={!canSaveLink || isSavingSource || isParsing}>
                {isSavingSource ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />}
                {isSavingSource ? '正在保存链接…' : '仅保存链接，稍后整理'}
              </button>
              <small className="field-help">此操作只建立一个“未整理”来源，不读取网页、不调用 DeepSeek，也不创建待确认任务。</small>
              <label className="link-authorization">
                <input type="checkbox" checked={linkAuthorized} onChange={(event) => setLinkAuthorized(event.target.checked)} />
                <span>我确认有权读取这个公开网页，并同意把读取到的正文用于本次任务整理。</span>
              </label>
              <button className="secondary-button wide" type="button" onClick={() => void readLink()} disabled={!linkAuthorized || !linkUrl.trim() || linkStatus === 'reading'}>
                {linkStatus === 'reading' ? <LoaderCircle className="spin" size={17} /> : <Link2 size={17} />}
                {linkStatus === 'reading' ? '正在读取网页…' : '授权读取网页正文'}
              </button>
              {linkMessage && <p className={`extraction-state ${linkStatus}`} role={linkStatus === 'error' ? 'alert' : 'status'}>{linkMessage}</p>}
              {(content || linkStatus === 'error') && <label className="field"><span>网页正文（可核对修改）</span><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={8} placeholder="若网站要求登录或限制自动读取，请粘贴网页正文……" required /><small>外部网页始终按不可信纯文本处理；DeepSeek 只会生成待确认建议。</small></label>}
            </>
          )}
          {manualMode && (
            <fieldset className="manual-task-form">
              <legend>手动填写一项任务</legend>
              <div className="form-grid">
                <label className="field span-2"><span>任务名称</span><input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} required /></label>
                <label className="field"><span>分类</span><select value={manualCategory} onChange={(event) => setManualCategory(event.target.value as TaskCategory)}>{(['比赛', '保研', '课程', '老师任务', '其他'] as TaskCategory[]).map((category) => <option key={category}>{category}</option>)}</select></label>
                <label className="field"><span>截止时间</span><input type="datetime-local" value={manualDeadline} onChange={(event) => setManualDeadline(event.target.value)} required /></label>
                <label className="field"><span>预计耗时（分钟）</span><input type="number" min="5" max="10080" step="5" value={manualDuration} onChange={(event) => setManualDuration(Number(event.target.value))} /></label>
                <label className="field"><span>优先级</span><select value={manualPriority} onChange={(event) => setManualPriority(event.target.value as Priority)}>{(['高', '中', '低'] as Priority[]).map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                <label className="field span-2"><span>下一步动作</span><input value={manualNextAction} onChange={(event) => setManualNextAction(event.target.value)} placeholder="例如：先下载报名表模板" required /></label>
                <label className="field span-2"><span>材料（可选，用逗号分隔）</span><input value={manualMaterials} onChange={(event) => setManualMaterials(event.target.value)} /></label>
              </div>
            </fieldset>
          )}
          <div className={`privacy-note ${smartExtractionStatus === 'connected' ? 'cloud-enabled' : 'cloud-unavailable'}`}><Sparkles size={18} /><p>
            <strong>{textOnly ? '人工工程响应（非模型预测）' : smartExtractionStatus === 'connected' ? 'DeepSeek 已配置（调用时验证）' : '本地规则兜底可用'}</strong>
            {textOnly ? ' 只在本机测试库承接旧匿名工程通知；不调用模型，不回退识别规则，确认前不会创建任务。' : manualMode
              ? ' 手动填写的内容只保存在本机，仍会先进入待确认。'
              : sourceType === 'link'
              ? ' 只有受控读取成功或你粘贴正文后才会调用 DeepSeek；裸链接不会被伪装成已读取内容。'
              : smartExtractionStatus === 'connected'
                ? multimodalConsent
                  ? ' 本次已显式允许发送当前图片/所选页面与 OCR 文字；实验模型的结果确认前不会创建任务。'
                  : ' 默认点击整理只发送本次粘贴或本机提取的文字，不发送图片或文件本体；结果确认前不会创建任务。'
                : ' DeepSeek 未配置，当前内容不会发往云端，将生成可编辑的本地规则建议。'}
          </p></div>
          <button className="primary-button wide" type="submit" disabled={!canSubmitWithConsent || isParsing || isSavingSource}>
            {isParsing ? <><LoaderCircle className="spin" size={18} />正在智能整理…</> : <><Sparkles size={18} />整理成待确认任务</>}
          </button>
        </form>
      </section>
    </div>
  )
}
