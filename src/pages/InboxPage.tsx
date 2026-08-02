import { Check, FileSearch, Pencil } from 'lucide-react'
import type { ExtractionDraft, Source } from '../types'

interface InboxPageProps {
  drafts: ExtractionDraft[]
  sources: Source[]
  onOpenDraft: (draftId: string) => void
}

export function InboxPage({ drafts, sources, onOpenDraft }: InboxPageProps) {
  const pendingDrafts = drafts.filter((draft) => draft.status === '待确认' || draft.status === '部分确认')
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
      {pendingDrafts.length ? <div className="task-list-grid">
        {pendingDrafts.map((draft) => {
          const source = sources.find((item) => item.id === draft.sourceId)
          const pending = draft.items.filter((item) => item.status === '待确认').length
          return <article className="task-card" key={draft.id}>
            <div className="task-card-top"><span className="category-label">{source?.extractionMethod === 'deepseek-v4-flash' ? 'DeepSeek V4 Flash 建议' : '本地规则建议'}</span><span className="risk-pill">待确认 {pending} 项</span></div>
            <h2>{source?.title ?? '已保存来源'}</h2>
            <p className="task-description">{source?.contentPreview ?? '来源内容不可用'}</p>
            <div className="task-card-actions"><button className="secondary-button" type="button" onClick={() => onOpenDraft(draft.id)}><Pencil size={16} />逐项检查</button></div>
          </article>
        })}
      </div> : <div className="empty-state"><Check size={34} /><h2>没有待确认的建议</h2><p>录入一份通知后，可编辑的识别建议会显示在这里。</p></div>}
    </main>
  )
}
