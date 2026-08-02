import { Check, CheckCheck, Clock3, FileText, ListChecks, PencilLine, Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
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

function deadlineLabel(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

export function DraftReviewPanel({ draft, source, onClose, onUpdate, onConfirm, onReject, onConfirmAll }: DraftReviewPanelProps) {
  const titleId = useId()
  const [editingId, setEditingId] = useState<string | null>(null)
  const pending = draft.items.filter((item) => item.status === '待确认')
  const processed = draft.items.length - pending.length

  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <aside className="detail-panel review-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="detail-header review-header">
        <div><span className="category-label">第 2 步 · {source?.extractionMethod === 'deepseek-v4-flash' ? 'DeepSeek 建议' : '本地规则建议'}</span><h2 id={titleId}>识别出 {draft.items.length} 件事</h2><p>先看标题和时间；不准确时再点“编辑”。</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="稍后处理并关闭"><X size={20} /></button>
      </header>
      <div className="detail-body review-body">
        <div className="review-progress"><ListChecks size={18} /><span><strong>{pending.length} 项待确认</strong><small>{processed ? `已处理 ${processed} 项` : '确认后才会进入今日和任务中心'}</small></span></div>
        <details className="source-details"><summary><FileText size={16} />查看原文依据</summary><p>{source?.content ?? source?.contentPreview ?? '原文暂不可用'}</p></details>
        <section className="review-list" aria-label="拆分后的待确认事项">
          {draft.items.map((item, index) => <DraftItemReview
            key={item.id}
            index={index}
            item={item}
            editing={editingId === item.id}
            onToggleEdit={() => setEditingId((current) => current === item.id ? null : item.id)}
            onUpdate={onUpdate}
            onConfirm={onConfirm}
            onReject={onReject}
          />)}
        </section>
      </div>
      <footer className="detail-footer review-footer">
        <button className="secondary-button" type="button" onClick={onClose}>{pending.length ? '稍后再处理' : '完成'}</button>
        {pending.length > 0 && <button className="primary-button" type="button" onClick={onConfirmAll}><CheckCheck size={17} />全部加入任务（{pending.length}）</button>}
      </footer>
    </aside>
  </div>
}

interface DraftItemReviewProps {
  index: number
  item: DraftItem
  editing: boolean
  onToggleEdit: () => void
  onUpdate: DraftReviewPanelProps['onUpdate']
  onConfirm: DraftReviewPanelProps['onConfirm']
  onReject: DraftReviewPanelProps['onReject']
}

function DraftItemReview({ index, item, editing, onToggleEdit, onUpdate, onConfirm, onReject }: DraftItemReviewProps) {
  const suggestion = item.suggestion
  if (item.status !== '待确认') return <article className={`review-item processed ${item.status === '已拒绝' ? 'rejected' : ''}`}>
    <span className="review-number">{index + 1}</span><div><strong>{suggestion.title}</strong><p>{item.status === '已确认' ? '已加入任务中心' : '已移除，不会创建任务'}</p></div>
  </article>

  return <article className="review-item">
    <header className="review-item-header">
      <span className="review-number">{index + 1}</span>
      <div><strong>{suggestion.title}</strong><time><Clock3 size={14} />{deadlineLabel(suggestion.deadline)}</time></div>
      <button className={editing ? 'review-edit active' : 'review-edit'} type="button" onClick={onToggleEdit}><PencilLine size={14} />{editing ? '收起' : '编辑'}</button>
    </header>
    <div className="review-meta"><span>{suggestion.category}</span><span>约 {suggestion.estimatedMinutes} 分钟</span>{suggestion.materials.length > 0 && <span>{suggestion.materials.length} 项材料</span>}{suggestion.confidence === '低' && <em>请重点核对</em>}</div>
    <p className="review-next"><span>下一步</span>{suggestion.nextAction}</p>
    {editing && <fieldset className="review-edit-form"><legend>修改这件事</legend><div className="form-grid">
      <label className="field span-2"><span>任务名称</span><input value={suggestion.title} onChange={(event) => onUpdate(item.id, { title: event.target.value })} /></label>
      <label className="field"><span>分类</span><select value={suggestion.category} onChange={(event) => onUpdate(item.id, { category: event.target.value as TaskCategory })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field"><span>截止时间</span><input type="datetime-local" value={suggestion.deadline} onChange={(event) => onUpdate(item.id, { deadline: event.target.value })} /></label>
      <label className="field"><span>预计耗时（分钟）</span><input type="number" min="5" step="5" value={suggestion.estimatedMinutes} onChange={(event) => onUpdate(item.id, { estimatedMinutes: Number(event.target.value) })} /></label>
      <label className="field span-2"><span>下一步动作</span><input value={suggestion.nextAction} onChange={(event) => onUpdate(item.id, { nextAction: event.target.value })} /></label>
    </div></fieldset>}
    <details className="item-evidence"><summary>为什么这样拆？</summary><p>{suggestion.evidence}</p></details>
    <footer className="review-item-actions"><button className="text-button remove" type="button" onClick={() => onReject(item.id)}><Trash2 size={14} />不需要</button><button className="secondary-button" type="button" onClick={() => onConfirm(item.id)}><Check size={15} />加入任务</button></footer>
  </article>
}
