import { Check, CheckCheck, Clock3, FileText, Trash2, X } from 'lucide-react'
import { useId } from 'react'
import type { DraftItem, ExtractionDraft, Source, TaskCategory } from '../types'

interface DraftReviewPanelProps {
  draft: ExtractionDraft
  source: Source | null
  onClose: () => void
  onUpdate: (itemId: string, patch: Partial<DraftItem['suggestion']>) => void
  onConfirm: (itemId: string) => void
  onReject: (itemId: string) => void
  onConfirmAll: () => void
}

const categories: TaskCategory[] = ['比赛', '保研', '课程', '老师任务', '其他']

export function DraftReviewPanel({ draft, source, onClose, onUpdate, onConfirm, onReject, onConfirmAll }: DraftReviewPanelProps) {
  const titleId = useId()
  const pending = draft.items.filter((item) => item.status === '待确认')
  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <aside className="detail-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="detail-header"><div><span className="category-label">演示识别建议</span><h2 id={titleId}>{source?.title ?? '待确认来源'}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭待确认草稿"><X size={20} /></button></header>
      <div className="detail-body">
        <section className="detail-section"><div className="detail-section-title"><h3>原文依据</h3><FileText size={18} /></div><p className="source-evidence">{source?.content ?? source?.contentPreview ?? '原文暂不可用'}</p></section>
        <section className="detail-section"><div className="detail-section-title"><h3>识别结果</h3><small>{pending.length} 项待确认</small></div>
          {draft.items.map((item) => <DraftItemEditor key={item.id} item={item} onUpdate={onUpdate} onConfirm={onConfirm} onReject={onReject} />)}
        </section>
      </div>
      {pending.length > 0 && <footer className="detail-footer"><button className="primary-button wide" type="button" onClick={onConfirmAll}><CheckCheck size={17} />确认全部 {pending.length} 项</button></footer>}
    </aside>
  </div>
}

function DraftItemEditor({ item, onUpdate, onConfirm, onReject }: { item: DraftItem; onUpdate: DraftReviewPanelProps['onUpdate']; onConfirm: DraftReviewPanelProps['onConfirm']; onReject: DraftReviewPanelProps['onReject'] }) {
  const suggestion = item.suggestion
  if (item.status !== '待确认') return <div className="source-evidence"><strong>{suggestion.title}</strong><p>{item.status === '已确认' ? '已创建为任务' : '已拒绝，不会创建任务'}</p></div>
  return <fieldset className="suggestion-card"><legend>待确认事项</legend><div className="form-grid">
    <label className="field span-2"><span>任务名称</span><input value={suggestion.title} onChange={(event) => onUpdate(item.id, { title: event.target.value })} /></label>
    <label className="field"><span>分类</span><select value={suggestion.category} onChange={(event) => onUpdate(item.id, { category: event.target.value as TaskCategory })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label className="field"><span>截止时间</span><input type="datetime-local" value={suggestion.deadline} onChange={(event) => onUpdate(item.id, { deadline: event.target.value })} /></label>
    <label className="field"><span>预计耗时（分钟）</span><input type="number" min="5" step="5" value={suggestion.estimatedMinutes} onChange={(event) => onUpdate(item.id, { estimatedMinutes: Number(event.target.value) })} /></label>
    <label className="field span-2"><span>下一步动作</span><input value={suggestion.nextAction} onChange={(event) => onUpdate(item.id, { nextAction: event.target.value })} /></label>
  </div><div className="evidence-box"><span><Clock3 size={15} />来源依据</span><p>{suggestion.evidence}</p></div><div className="panel-actions"><button className="secondary-button" type="button" onClick={() => onReject(item.id)}><Trash2 size={16} />拒绝</button><button className="primary-button" type="button" onClick={() => onConfirm(item.id)}><Check size={16} />确认并创建任务</button></div></fieldset>
}
