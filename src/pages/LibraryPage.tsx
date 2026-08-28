import { AlertTriangle, Eye, File, FileImage, Link2, MessageSquareText, PenLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SourceDetailPanel } from '../components/SourceDetailPanel'
import { buildSourceWorkflowItems, sourceTypeLabels } from '../lib/sourceWorkflow'
import type { ExtractionDraft, Source } from '../types'

interface LibraryPageProps {
  sources: Source[]
  drafts?: ExtractionDraft[]
  onMarkIndependent: (sourceId: string) => void
  onOpenSource?: (sourceId: string) => void
  onOpenDraft?: (draftId: string) => void
  onRetrySource?: (sourceId: string) => Promise<void>
  onManualSupplementSource?: (sourceId: string) => void
  onOpenIntake?: () => void
}

const typeIcon = { text: MessageSquareText, file: File, image: FileImage, link: Link2 }

export function LibraryPage({
  sources,
  drafts = [],
  onMarkIndependent,
  onOpenSource,
  onOpenDraft,
  onRetrySource,
  onManualSupplementSource,
  onOpenIntake,
}: LibraryPageProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [retryingSourceId, setRetryingSourceId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const items = useMemo(() => buildSourceWorkflowItems(sources, drafts), [sources, drafts])
  const selectedItem = items.find((item) => item.source.id === selectedSourceId) ?? null

  const retrySource = async (sourceId: string): Promise<boolean> => {
    if (!onRetrySource || retryingSourceId) return false
    setRetryingSourceId(sourceId)
    setActionError(null)
    try {
      await onRetrySource(sourceId)
      return true
    } catch (error) {
      setActionError(error instanceof Error && error.message.trim() ? error.message : '重试未完成，未收到可记录的错误信息。')
      return false
    } finally {
      setRetryingSourceId(null)
    }
  }

  return <>
    <main className="page">
      <header className="page-header"><div><span className="eyebrow">来源与依据</span><h1>资料库</h1><p>每个任务都能回到最初通知；这里复用收件箱的真实状态，不会把失败显示为已识别。</p></div></header>
      <div className="library-list">
        <div className="library-list-head"><span>来源</span><span>原文摘要</span><span>处理状态</span><span>操作</span></div>
        {items.length === 0 && <div className="empty-state library-empty-state">
          <File size={34} />
          <h2>资料库还是空的</h2>
          <p>录入通知后，原文、处理状态与人工核对记录会保留在这里。</p>
          {onOpenIntake && <button className="secondary-button" type="button" onClick={onOpenIntake}><PenLine size={16} />新事务</button>}
        </div>}
        {items.map((item) => {
          const source = item.source
          const Icon = typeIcon[source.type]
          const duplicates = (source.duplicateOfSourceIds ?? []).map((id) => sources.find((candidate) => candidate.id === id)).filter((candidate): candidate is Source => Boolean(candidate))
          return <article className="source-row" key={source.id} data-source-status={item.status}>
            <div className="source-title"><span className="source-icon"><Icon size={19} /></span><span><strong>{source.title}</strong><small>{sourceTypeLabels[source.type]} · {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(source.createdAt))}</small></span></div>
            <div className="source-preview"><p>{source.contentPreview || '当前来源没有可显示的文字摘要。'}</p>{duplicates.length > 0 && source.duplicateReviewStatus === '待核对' && <div className="duplicate-notice"><AlertTriangle size={15} /><span>可能与“{duplicates[0].title}”重复；请人工核对。</span><button type="button" onClick={() => onMarkIndependent(source.id)}>保留为独立来源</button></div>}{source.duplicateReviewStatus === '保留为独立来源' && <small className="reviewed-note">已人工标记为独立来源</small>}</div>
            <span className={`source-workflow-status status-${item.status}`}>{item.statusLabel}</span>
            <button className="source-view-button" type="button" aria-label={`查看来源 ${source.title}`} onClick={() => { setSelectedSourceId(source.id); onOpenSource?.(source.id) }}><Eye size={15} />查看来源</button>
          </article>
        })}
      </div>
    </main>

    {selectedItem && <SourceDetailPanel
      item={selectedItem}
      onClose={() => {
        setSelectedSourceId(null)
        setActionError(null)
      }}
      onOpenDraft={onOpenDraft ? (draftId) => {
        setSelectedSourceId(null)
        onOpenDraft(draftId)
      } : undefined}
      onRetrySource={onRetrySource ? async (sourceId) => {
        if (await retrySource(sourceId)) setSelectedSourceId(null)
      } : undefined}
      onManualSupplement={onManualSupplementSource ? (sourceId) => {
        setSelectedSourceId(null)
        onManualSupplementSource(sourceId)
      } : undefined}
      retrying={retryingSourceId === selectedItem.source.id}
      actionError={actionError}
    />}
  </>
}
