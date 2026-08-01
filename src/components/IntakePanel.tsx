import {
  ArrowLeft,
  CalendarClock,
  Check,
  FileImage,
  FileText,
  Link2,
  LoaderCircle,
  Sparkles,
  Trash2,
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
import type {
  ParsedSuggestion,
  Source,
  SourceType,
  Task,
  TaskCategory,
} from '../types'

interface IntakePanelProps {
  onClose: () => void
  onConfirm: (tasks: Task[], source: Source) => void
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
  const [suggestions, setSuggestions] = useState<ParsedSuggestion[]>([])
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
      setSuggestions(
        createSuggestions(content, sourceType, sourceTitle || fileName),
      )
      setIsParsing(false)
      setStep('review')
    }, 480)
  }

  const updateSuggestion = <K extends keyof ParsedSuggestion>(
    suggestionId: string,
    key: K,
    value: ParsedSuggestion[K],
  ) => {
    setSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === suggestionId
          ? { ...suggestion, [key]: value }
          : suggestion,
      ),
    )
  }

  const removeSuggestion = (suggestionId: string) => {
    setSuggestions((current) =>
      current.filter((suggestion) => suggestion.id !== suggestionId),
    )
  }

  const handleConfirm = (event: FormEvent) => {
    event.preventDefault()
    if (!suggestions.length) return
    const now = new Date().toISOString()
    const sourceId = `source-${Date.now()}`
    const source: Source = {
      id: sourceId,
      type: sourceType,
      title:
        sourceTitle ||
        fileName ||
        (sourceType === 'link' ? '网页通知' : '手动粘贴消息'),
      contentPreview:
        content.trim().slice(0, 500) ||
        suggestions.map((suggestion) => suggestion.evidence).join('；'),
      createdAt: now,
      extractionStatus: '已识别',
    }
    const tasks = suggestions.map((suggestion, suggestionIndex): Task => {
      const taskId = `task-${Date.now()}-${suggestionIndex}`
      return {
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
        materials: suggestion.materials.map((name, materialIndex) => ({
          id: `${taskId}-material-${materialIndex}`,
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
            after: `从同一来源的第 ${suggestionIndex + 1} 条识别建议确认创建`,
            changedAt: now,
            actor: 'user',
          },
        ],
      }
    })
    onConfirm(tasks, source)
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
                演示识别建议 · {suggestions.length} 项
              </span>
              <strong>
                已拆成 {suggestions.length} 条独立待确认任务
              </strong>
              <p>
                每个时间点对应一张任务卡。你可以逐条修改或删除，确认后才会一起进入任务中心。
              </p>
            </div>

            {suggestions.length ? (
              <div className="suggestion-stack">
                {suggestions.map((suggestion, index) => (
                  <fieldset className="suggestion-card" key={suggestion.id}>
                    <legend className="sr-only">待确认任务 {index + 1}</legend>
                    <header className="suggestion-card-header">
                      <span className="suggestion-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="suggestion-time-summary">
                        <CalendarClock size={15} />
                        {new Intl.DateTimeFormat('zh-CN', {
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        }).format(new Date(suggestion.deadline))}
                      </span>
                      <span className="confidence-label">
                        置信度 {suggestion.confidence}
                      </span>
                      <button
                        className="remove-suggestion-button"
                        type="button"
                        onClick={() => removeSuggestion(suggestion.id)}
                        aria-label={`删除待确认任务 ${index + 1}：${suggestion.title}`}
                      >
                        <Trash2 size={15} />
                        删除
                      </button>
                    </header>

                    <div className="form-grid">
                      <label className="field span-2">
                        <span>任务名称</span>
                        <input
                          value={suggestion.title}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
                              'title',
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>
                      <label className="field">
                        <span>分类</span>
                        <select
                          value={suggestion.category}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
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
                          value={suggestion.priority}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
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
                          value={suggestion.deadline}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
                              'deadline',
                              event.target.value,
                            )
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
                          value={suggestion.estimatedMinutes}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
                              'estimatedMinutes',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label className="field span-2">
                        <span>下一步动作</span>
                        <input
                          value={suggestion.nextAction}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
                              'nextAction',
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>
                      <label className="field span-2">
                        <span>事项说明</span>
                        <textarea
                          rows={3}
                          value={suggestion.description}
                          onChange={(event) =>
                            updateSuggestion(
                              suggestion.id,
                              'description',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="evidence-box">
                      <span>这一条的来源依据</span>
                      <p>{suggestion.evidence}</p>
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : (
              <div className="empty-suggestions">
                <Trash2 size={26} />
                <h3>待确认任务已全部删除</h3>
                <p>返回原文重新解析，或关闭本次录入。</p>
              </div>
            )}

            <div className="panel-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setStep('input')}
              >
                <ArrowLeft size={17} />
                返回原文
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!suggestions.length}
              >
                <Check size={17} />
                确认 {suggestions.length} 项并加入任务中心
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
