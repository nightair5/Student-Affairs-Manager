import {
  ArrowLeft,
  Check,
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
import { createSuggestion } from '../lib/parser'
import type {
  ParsedSuggestion,
  Source,
  SourceType,
  Task,
  TaskCategory,
} from '../types'

interface IntakePanelProps {
  onClose: () => void
  onConfirm: (task: Task, source: Source) => void
}

type IntakeStep = 'input' | 'review'

const categories: TaskCategory[] = ['比赛', '保研', '课程', '老师任务', '其他']

export function IntakePanel({ onClose, onConfirm }: IntakePanelProps) {
  const [sourceType, setSourceType] = useState<SourceType>('text')
  const [step, setStep] = useState<IntakeStep>('input')
  const [content, setContent] = useState('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [fileName, setFileName] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [suggestion, setSuggestion] = useState<ParsedSuggestion | null>(null)
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
      setSuggestion(
        createSuggestion(content, sourceType, sourceTitle || fileName),
      )
      setIsParsing(false)
      setStep('review')
    }, 480)
  }

  const updateSuggestion = <K extends keyof ParsedSuggestion>(
    key: K,
    value: ParsedSuggestion[K],
  ) => {
    setSuggestion((current) =>
      current ? { ...current, [key]: value } : current,
    )
  }

  const handleConfirm = (event: FormEvent) => {
    event.preventDefault()
    if (!suggestion) return
    const now = new Date().toISOString()
    const sourceId = `source-${Date.now()}`
    const taskId = `task-${Date.now()}`
    const source: Source = {
      id: sourceId,
      type: sourceType,
      title:
        sourceTitle ||
        fileName ||
        (sourceType === 'link' ? '网页通知' : '手动粘贴消息'),
      contentPreview: suggestion.evidence,
      createdAt: now,
      extractionStatus: '已识别',
    }
    const task: Task = {
      id: taskId,
      title: suggestion.title,
      category: suggestion.category,
      status: '待开始',
      deadline: suggestion.deadline,
      estimatedMinutes: suggestion.estimatedMinutes,
      nextAction: suggestion.nextAction,
      description: suggestion.description,
      priority: suggestion.priority,
      riskFlags: suggestion.confidence === '低' ? ['待确认'] : [],
      materials: suggestion.materials.map((name, index) => ({
        id: `${taskId}-material-${index}`,
        name,
        done: false,
      })),
      dependencies: [],
      reminders: [],
      sourceIds: [sourceId],
      priorityReason:
        suggestion.confidence === '低'
          ? '识别置信度较低，请优先核对截止时间'
          : '新录入事项，建议确认后安排开工时间',
      createdAt: now,
      updatedAt: now,
      history: [
        {
          id: `${taskId}-history-created`,
          field: '任务',
          before: '',
          after: '从识别建议确认创建',
          changedAt: now,
          actor: 'user',
        },
      ],
    }
    onConfirm(task, source)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="intake-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="intake-header">
          <div>
            <span className="eyebrow">
              {step === 'input' ? '统一录入' : '确认后再入库'}
            </span>
            <h2 id={titleId}>
              {step === 'input' ? '把通知交给管家整理' : '检查识别建议'}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="关闭录入面板"
          >
            <X size={20} />
          </button>
        </header>

        {step === 'input' ? (
          <form className="intake-body" onSubmit={handleParse}>
            <div className="source-tabs" role="tablist" aria-label="选择来源">
              <button
                type="button"
                className={sourceType === 'text' ? 'active' : ''}
                onClick={() => setSourceType('text')}
              >
                <FileText size={17} />
                粘贴消息
              </button>
              <button
                type="button"
                className={
                  sourceType === 'file' || sourceType === 'image' ? 'active' : ''
                }
                onClick={() => setSourceType('file')}
              >
                <FileImage size={17} />
                上传文件
              </button>
              <button
                type="button"
                className={sourceType === 'link' ? 'active' : ''}
                onClick={() => setSourceType('link')}
              >
                <Link2 size={17} />
                网页链接
              </button>
            </div>

            {sourceType === 'text' && (
              <label className="field">
                <span>老师或群聊消息</span>
                <textarea
                  ref={firstControlRef}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={10}
                  placeholder="例如：请大家 8 月 4 日 18:00 前提交报名表和确认函……"
                  required
                />
                <small>直接粘贴原文，后续可以随时回看来源依据。</small>
              </label>
            )}

            {sourceType === 'file' && (
              <div className="upload-zone">
                <Upload size={30} strokeWidth={1.5} />
                <strong>{fileName || '选择文件、图片或扫描件'}</strong>
                <p>
                  文本文件可在本地读取；PDF 与图片当前按文件名生成演示建议。
                </p>
                <label className="secondary-button file-picker">
                  选择文件
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.doc,.docx,image/*"
                    onChange={handleFile}
                    required
                  />
                </label>
              </div>
            )}

            {sourceType === 'link' && (
              <>
                <label className="field">
                  <span>网页标题</span>
                  <input
                    type="text"
                    value={sourceTitle}
                    onChange={(event) => setSourceTitle(event.target.value)}
                    placeholder="例如：学院 2026 推免预通知"
                    required
                  />
                </label>
                <label className="field">
                  <span>网页链接</span>
                  <input
                    type="url"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="https://..."
                    required
                  />
                  <small>
                    当前仅保存链接并生成演示建议，尚未启用网页自动抓取。
                  </small>
                </label>
              </>
            )}

            <div className="privacy-note">
              <Sparkles size={18} />
              <p>
                <strong>本地演示识别</strong>
                内容不会上传服务器；系统给出的分类和日期都只是建议。
              </p>
            </div>

            <button
              className="primary-button wide"
              type="submit"
              disabled={
                isParsing || (!content.trim() && !sourceTitle.trim() && !fileName)
              }
            >
              {isParsing ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  正在整理信息
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  生成识别建议
                </>
              )}
            </button>
          </form>
        ) : (
          <form className="intake-body review-form" onSubmit={handleConfirm}>
            <div className="suggestion-banner">
              <span>
                <Sparkles size={16} />
                演示识别建议
              </span>
              <strong>置信度：{suggestion?.confidence}</strong>
              <p>请核对每一项。自动结果不会替你做最终决定。</p>
            </div>

            <div className="form-grid">
              <label className="field span-2">
                <span>任务名称</span>
                <input
                  value={suggestion?.title ?? ''}
                  onChange={(event) =>
                    updateSuggestion('title', event.target.value)
                  }
                  required
                />
              </label>
              <label className="field">
                <span>分类</span>
                <select
                  value={suggestion?.category}
                  onChange={(event) =>
                    updateSuggestion(
                      'category',
                      event.target.value as TaskCategory,
                    )
                  }
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>优先级</span>
                <select
                  value={suggestion?.priority}
                  onChange={(event) =>
                    updateSuggestion(
                      'priority',
                      event.target.value as ParsedSuggestion['priority'],
                    )
                  }
                >
                  <option>高</option>
                  <option>中</option>
                  <option>低</option>
                </select>
              </label>
              <label className="field">
                <span>截止时间</span>
                <input
                  type="datetime-local"
                  value={suggestion?.deadline ?? ''}
                  onChange={(event) =>
                    updateSuggestion('deadline', event.target.value)
                  }
                  required
                />
              </label>
              <label className="field">
                <span>预计耗时（分钟）</span>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={suggestion?.estimatedMinutes ?? 60}
                  onChange={(event) =>
                    updateSuggestion(
                      'estimatedMinutes',
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="field span-2">
                <span>下一步动作</span>
                <input
                  value={suggestion?.nextAction ?? ''}
                  onChange={(event) =>
                    updateSuggestion('nextAction', event.target.value)
                  }
                  required
                />
              </label>
            </div>

            <div className="evidence-box">
              <span>来源依据</span>
              <p>{suggestion?.evidence}</p>
            </div>

            <div className="panel-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setStep('input')}
              >
                <ArrowLeft size={17} />
                返回原文
              </button>
              <button className="primary-button" type="submit">
                <Check size={17} />
                确认并加入任务中心
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
