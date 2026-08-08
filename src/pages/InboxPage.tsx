import { Archive, Check, CheckCheck, FileSearch, PenLine, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { ExtractionDraft, Source } from '../types'

interface InboxPageProps {
  drafts: ExtractionDraft[]
  sources: Source[]
  onOpenDraft: (draftId: string) => void
  onConfirmDrafts: (draftIds: string[]) => void
  onArchiveDrafts: (draftIds: string[]) => void
  onOpenManual: () => void
}

export function InboxPage({ drafts, sources, onOpenDraft, onConfirmDrafts, onArchiveDrafts, onOpenManual }: InboxPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const pendingDrafts = drafts.filter((draft) =>
    (draft.status === '待确认' || draft.status === '部分确认')
      && draft.workflowStatus !== 'archived'
      && draft.workflowStatus !== 'failed'
      && draft.workflowStatus !== 'processing')
  const selectableIds = pendingDrafts.map((draft) => draft.id)
  const selected = selectedIds.filter((id) => selectableIds.includes(id))

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

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">确认前不入库</span>
          <h1>待确认队列</h1>
          <p>每份通知保留原文依据。你可以逐项编辑、确认或拒绝；关闭页面也不会丢失草稿。</p>
        </div>
        <div className="header-stat"><FileSearch size={20} /><span><strong>{pendingDrafts.length}</strong> 份待处理</span></div>
      </header>

      <div className="inbox-actions">
        <button className="secondary-button" type="button" onClick={onOpenManual}><PenLine size={16} />手动录入</button>
        {pendingDrafts.length > 0 && <label className="select-all-drafts">
          <input
            type="checkbox"
            checked={selected.length === pendingDrafts.length}
            onChange={(event) => setSelectedIds(event.target.checked ? selectableIds : [])}
          />
          选择全部
        </label>}
        {selected.length > 0 && <div className="batch-actions" role="group" aria-label={`已选择 ${selected.length} 份草稿`}>
          <span>已选 {selected.length} 份</span>
          <button type="button" onClick={() => runBatch(onConfirmDrafts)}><CheckCheck size={15} />批量确认</button>
          <button type="button" onClick={() => runBatch(onArchiveDrafts)}><Archive size={15} />批量归档</button>
        </div>}
      </div>

      {pendingDrafts.length ? <div className="task-list-grid">
        {pendingDrafts.map((draft) => {
          const source = sources.find((item) => item.id === draft.sourceId)
          const pending = draft.items.filter((item) => item.status === '待确认').length
          return <article className="task-card inbox-card" key={draft.id}>
            <label className="draft-selector"><input type="checkbox" checked={selected.includes(draft.id)} onChange={() => toggleSelected(draft.id)} /><span className="sr-only">选择 {source?.title ?? '草稿'}</span></label>
            <div className="task-card-top"><span className="category-label">{draft.modelName?.includes('deepseek') ? 'DeepSeek V4 Flash 建议' : '本地规则建议'}</span><span className="risk-pill">待确认 {pending} 项</span></div>
            <h2>{source?.title ?? '已保存来源'}</h2>
            <p className="task-description">{source?.contentPreview ?? '来源内容不可用'}</p>
            {source?.processingError && <p className="inline-error" role="alert">{source.processingError}</p>}
            <div className="task-card-actions"><button className="secondary-button" type="button" onClick={() => onOpenDraft(draft.id)}><Pencil size={16} />逐项检查</button><button className="text-button" type="button" onClick={() => onArchiveDrafts([draft.id])}><Archive size={15} />归档</button></div>
          </article>
        })}
      </div> : <div className="empty-state"><Check size={34} /><h2>没有待确认的建议</h2><p>录入一份通知后，可编辑的识别建议会显示在这里。</p><button className="secondary-button" type="button" onClick={onOpenManual}><PenLine size={16} />手动创建一项任务</button></div>}
    </main>
  )
}
