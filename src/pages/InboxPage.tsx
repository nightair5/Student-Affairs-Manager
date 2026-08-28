import { Archive, Check, CheckCheck, Eye, FileSearch, ListChecks, LoaderCircle, PenLine, RefreshCw, SquarePen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SourceDetailPanel } from '../components/SourceDetailPanel'
import { buildSourceWorkflowItems, selectPendingReviewItems, sourceTypeLabels } from '../lib/sourceWorkflow'
import type { ExtractionDraft, Source } from '../types'

interface InboxPageProps {
  drafts: ExtractionDraft[]
  sources: Source[]
  view: 'all' | 'needs_review'
  onChangeView: (view: 'all' | 'needs_review') => void
  onOpenDraft: (draftId: string) => void
  onConfirmDrafts: (draftIds: string[]) => void
  onArchiveDrafts: (draftIds: string[]) => void
  onOpenManual: () => void
  /** Must call retryExistingSourceRecognition (or beginRetry) for this source ID. */
  onRetrySource?: (sourceId: string) => Promise<void>
  /** Opens a manual editor bound to the existing Source/SourceVersion, never a new capture. */
  onManualSupplementSource?: (sourceId: string) => void
}

export function InboxPage({
  drafts,
  sources,
  view,
  onChangeView,
  onOpenDraft,
  onConfirmDrafts,
  onArchiveDrafts,
  onOpenManual,
  onRetrySource,
  onManualSupplementSource,
}: InboxPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [retryingSourceId, setRetryingSourceId] = useState<string | null>(null)
  const [actionFailure, setActionFailure] = useState<{ sourceId: string; message: string } | null>(null)
  const workflowItems = useMemo(() => buildSourceWorkflowItems(sources, drafts), [sources, drafts])
  const pendingItems = useMemo(() => selectPendingReviewItems(sources, drafts), [sources, drafts])
  const visibleItems = view === 'needs_review'
    ? pendingItems
    : workflowItems
  const selectedSource = workflowItems.find((item) => item.source.id === selectedSourceId) ?? null
  const pendingDrafts = pendingItems.flatMap((item) => item.draft ? [item.draft] : [])
  const selectableIds = pendingDrafts.map((draft) => draft.id)
  const selected = selectedIds.filter((id) => selectableIds.includes(id))
  const attentionCount = view === 'needs_review'
    ? visibleItems.length
    : workflowItems.filter((item) => ['unprocessed', 'processing', 'failed', 'needs_review'].includes(item.status)).length

  const toggleSelected = (draftId: string) => {
    setSelectedIds((current) => current.includes(draftId)
      ? current.filter((id) => id !== draftId)
      : [...current, draftId])
  }

  const runBatch = (action: (ids: string[]) => void) => {
    if (!selected.length) return
    action(selected)
    setSelectedIds([])
  }

  const retrySource = async (sourceId: string): Promise<boolean> => {
    if (!onRetrySource || retryingSourceId) return false
    setRetryingSourceId(sourceId)
    setActionFailure(null)
    try {
      await onRetrySource(sourceId)
      return true
    } catch (error) {
      setActionFailure({
        sourceId,
        message: error instanceof Error && error.message.trim() ? error.message : '重试未完成，未收到可记录的错误信息。',
      })
      return false
    } finally {
      setRetryingSourceId(null)
    }
  }

  return <>
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">来源先保存，确认后入库</span>
          <h1>{view === 'needs_review' ? '待确认' : '收件箱'}</h1>
          <p>{view === 'needs_review'
            ? '这里只显示已经形成建议、仍等待你核对的来源；确认前不会创建正式任务。'
            : '查看每份来源的真实处理状态。失败不会删除来源；重新识别会沿用原来源与当前版本。'}</p>
        </div>
        <div className="header-stat"><FileSearch size={20} /><span><strong>{attentionCount}</strong> 份需关注</span></div>
      </header>

      <div className="inbox-actions">
        <div className="inbox-view-tabs" role="group" aria-label="收件箱视图">
          <button type="button" className={view === 'all' ? 'active' : ''} aria-pressed={view === 'all'} onClick={() => onChangeView('all')}>全部来源</button>
          <button type="button" className={view === 'needs_review' ? 'active' : ''} aria-pressed={view === 'needs_review'} onClick={() => onChangeView('needs_review')}>待确认 {pendingDrafts.length}</button>
        </div>
        <button className="secondary-button" type="button" onClick={onOpenManual}><PenLine size={16} />新建手动来源</button>
        {pendingDrafts.length > 0 && <label className="select-all-drafts">
          <input
            type="checkbox"
            checked={selected.length === pendingDrafts.length}
            onChange={(event) => setSelectedIds(event.target.checked ? selectableIds : [])}
          />
          选择全部待核对
        </label>}
        {selected.length > 0 && <div className="batch-actions" role="group" aria-label={`已选择 ${selected.length} 份草稿`}>
          <span>已选 {selected.length} 份</span>
          <button type="button" onClick={() => runBatch(onConfirmDrafts)}><CheckCheck size={15} />批量确认</button>
          <button type="button" onClick={() => runBatch(onArchiveDrafts)}><Archive size={15} />批量归档</button>
        </div>}
      </div>

      {visibleItems.length > 0 ? <div className="task-list-grid inbox-source-grid">
        {visibleItems.map((item) => {
          const { source, draft, counts } = item
          const draftSelectable = Boolean(draft && selectableIds.includes(draft.id))
          const retrying = retryingSourceId === source.id
          return <article className={`task-card inbox-card inbox-status-${item.status}`} key={source.id} data-source-status={item.status}>
            {draftSelectable && draft && <label className="draft-selector">
              <input type="checkbox" checked={selected.includes(draft.id)} onChange={() => toggleSelected(draft.id)} />
              <span className="sr-only">选择 {source.title}</span>
            </label>}
            <div className="task-card-top">
              <span className="category-label">{item.modelLabel ?? sourceTypeLabels[source.type]}</span>
              <span className={`source-workflow-status status-${item.status}`}>{item.statusLabel}</span>
            </div>
            <h2>{source.title}</h2>
            <p className="task-description">{source.contentPreview || '当前来源没有可显示的文字摘要。'}</p>
            <p className="source-status-description">{item.statusDescription}</p>
            <dl className="inbox-source-meta">
              <div><dt>项目</dt><dd>{item.projectLabel ?? '未形成项目建议'}</dd></div>
              <div><dt>实体</dt><dd>{counts.tasks} 任务 · {counts.materials} 材料 · {counts.timePoints} 时间 · {counts.events} 活动</dd></div>
            </dl>
            {item.errorMessage && <p className="inline-error" role="alert">{item.errorMessage}</p>}
            {actionFailure?.sourceId === source.id && <p className="inline-error" role="alert">{actionFailure.message}</p>}
            {item.canRetry && (!onRetrySource || !onManualSupplementSource) && <p className="source-action-note">重试接线未完成；系统不会用“新建来源”代替重试。</p>}
            <div className="task-card-actions inbox-card-actions">
              {item.canOpenDraft && draft && <button className="secondary-button" type="button" onClick={() => onOpenDraft(draft.id)}><ListChecks size={16} />核对 {counts.pending} 项</button>}
              {item.canRetry && <button
                className="secondary-button"
                type="button"
                onClick={() => void retrySource(source.id)}
                disabled={!onRetrySource || retrying}
                title={!onRetrySource ? '需要连接既有来源重试执行器' : undefined}
              >{retrying ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}{retrying ? '正在重试…' : '本地规则重试'}</button>}
              {item.canManualSupplement && <button
                className="secondary-button"
                type="button"
                onClick={() => onManualSupplementSource?.(source.id)}
                disabled={!onManualSupplementSource || retrying}
                title={!onManualSupplementSource ? '需要连接既有来源手工补充入口' : undefined}
              ><SquarePen size={16} />手工补充</button>}
              <button className="text-button" type="button" onClick={() => setSelectedSourceId(source.id)}><Eye size={15} />查看来源</button>
              {item.canOpenDraft && draft && <button className="text-button" type="button" onClick={() => onArchiveDrafts([draft.id])}><Archive size={15} />归档</button>}
            </div>
          </article>
        })}
      </div> : <div className="empty-state"><Check size={34} /><h2>{view === 'needs_review' ? '没有等待确认的来源' : '收件箱还是空的'}</h2><p>{view === 'needs_review' ? '新的识别建议会出现在这里；失败或未整理来源仍可在“全部来源”处理。' : '录入通知后，未整理、处理中、失败、待核对、已确认和已归档来源都会保留在这里。'}</p>{view === 'needs_review' ? <button className="secondary-button" type="button" onClick={() => onChangeView('all')}>查看全部来源</button> : <button className="secondary-button" type="button" onClick={onOpenManual}><PenLine size={16} />手动创建来源</button>}</div>}
    </main>

    {selectedSource && <SourceDetailPanel
      item={selectedSource}
      onClose={() => setSelectedSourceId(null)}
      onOpenDraft={(draftId) => {
        setSelectedSourceId(null)
        onOpenDraft(draftId)
      }}
      onRetrySource={onRetrySource ? async (sourceId) => {
        if (await retrySource(sourceId)) setSelectedSourceId(null)
      } : undefined}
      onManualSupplement={onManualSupplementSource ? (sourceId) => {
        setSelectedSourceId(null)
        onManualSupplementSource(sourceId)
      } : undefined}
      retrying={retryingSourceId === selectedSource.source.id}
      actionError={actionFailure?.sourceId === selectedSource.source.id ? actionFailure.message : null}
    />}
  </>
}
