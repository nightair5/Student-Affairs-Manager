import { AlertTriangle, Check, CheckCheck, Clock3, FileText, FolderTree, ListChecks, PencilLine, ShieldCheck, Trash2, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'
import type { DraftItem, ExtractionDraft, Project, Source, TaskCategory } from '../types'
import type { InferenceLevel } from '../types'

interface DraftReviewPanelProps {
  draft: ExtractionDraft
  source: Source | null
  onClose: () => void
  onUpdate: (itemId: string, patch: Partial<DraftItem['suggestion']>) => void
  onConfirm: (itemId: string) => void
  onReject: (itemId: string) => void
  onConfirmAll: () => void
  projectWillCreate: boolean
  projects: Project[]
  onProjectChoice: (value: string) => void
  onKeepExplicit: () => void
  onMoveTask: (taskTempId: string, milestoneTempId: string) => void
  onToggleRecognitionEntity: (kind: 'event' | 'material' | 'timePoint', tempId: string, selected: boolean) => void
  onToggleTaskSelected: (itemId: string, selected: boolean) => void
  onSplitTask: (itemId: string) => void
  onMergeTask: (sourceItemId: string, targetItemId: string) => void
}

const categories: TaskCategory[] = ['比赛', '保研', '课程', '老师任务', '其他']

function deadlineLabel(value: string): string {
  if (Number.isNaN(new Date(value).getTime())) return '日期待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

const inferenceLabels: Record<InferenceLevel, string> = {
  explicit: '原文明确',
  strong_inference: '强推断',
  optional_suggestion: '可选建议',
}

export function DraftReviewPanel({ draft, source, onClose, onUpdate, onConfirm, onReject, onConfirmAll, projectWillCreate, projects, onProjectChoice, onKeepExplicit, onMoveTask, onToggleRecognitionEntity, onToggleTaskSelected, onSplitTask, onMergeTask }: DraftReviewPanelProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeEvidence, setActiveEvidence] = useState('')
  const pending = draft.items.filter((item) => item.status === '待确认')
  const selectedPending = pending.filter((item) => item.selected !== false)
  const processed = draft.items.length - pending.length
  const pendingMaterials = selectedPending.reduce((count, item) => count + item.suggestion.materials.length, 0)
  useDialogFocusTrap(panelRef, onClose)
  const sourceText = source?.content ?? source?.rawText ?? source?.contentPreview ?? '原文暂不可用'
  const evidenceIndex = activeEvidence ? sourceText.indexOf(activeEvidence) : -1
  const recognition = draft.recognitionResult
  const taskMeta = new Map(recognition
    ? [
        ...recognition.standaloneTasks,
        ...recognition.milestones.flatMap((milestone) => [
          ...milestone.tasks,
          ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks),
        ]),
      ].map((task) => [task.tempId, task] as const)
    : [])
  const groupedItemIds = new Set<string>()
  const renderItem = (item: DraftItem, index: number, milestoneTempId?: string) => {
    groupedItemIds.add(item.suggestion.id)
    const metadata = taskMeta.get(item.suggestion.id)
    return <DraftItemReview
      key={item.id}
      index={index}
      item={item}
      editing={editingId === item.id}
      inferenceLevel={metadata?.inferenceLevel}
      milestones={recognition?.milestones.map((milestone) => ({ id: milestone.tempId, title: milestone.title })) ?? []}
      milestoneTempId={milestoneTempId}
      onMoveTask={onMoveTask}
      mergeTargets={pending.filter((candidate) => candidate.id !== item.id).map((candidate) => ({ id: candidate.id, title: candidate.suggestion.title }))}
      onSplitTask={onSplitTask}
      onMergeTask={onMergeTask}
      onToggleEdit={() => setEditingId((current) => current === item.id ? null : item.id)}
      onUpdate={onUpdate}
      onConfirm={onConfirm}
      onReject={onReject}
      onToggleSelected={(selected) => onToggleTaskSelected(item.id, selected)}
      onFocusEvidence={setActiveEvidence}
    />
  }

  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <aside ref={panelRef} className="detail-panel review-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="detail-header review-header">
        <div><span className="category-label">第 2 步 · {draft.modelName?.includes('deepseek') ? 'DeepSeek 建议' : '本地规则建议'}</span><h2 id={titleId}>识别出 {draft.items.length} 件事</h2><p>先看标题和时间；不准确时再点“编辑”。</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="稍后处理并关闭"><X size={20} /></button>
      </header>
      <div className="detail-body review-body">
        <div className="review-progress"><ListChecks size={18} /><span><strong>{pending.length} 项待确认</strong><small>{processed ? `已处理 ${processed} 项` : '确认后才会进入今日和任务中心'}</small></span></div>
        {recognition && <section className="recognition-overview" aria-label="项目匹配与识别质量">
          <div className="recognition-project-choice">
            <div><FolderTree size={18} /><span><strong>项目归属建议</strong><small>{recognition.projectMatch.reasons.join('；') || '请人工选择项目归属'}</small></span></div>
            <label><span className="sr-only">选择项目归属</span><select value={recognition.projectMatch.decision === 'existing_project' && recognition.projectMatch.matchedProjectId ? `existing:${recognition.projectMatch.matchedProjectId}` : recognition.projectMatch.decision} onChange={(event) => onProjectChoice(event.target.value)}>
              <option value="new_project">新建项目</option>
              {projects.map((project) => <option key={project.id} value={`existing:${project.id}`}>关联：{project.title}</option>)}
              <option value="standalone_task">作为独立事项</option>
              <option value="uncertain">稍后决定</option>
            </select></label>
          </div>
          <div className={recognition.quality.needsHumanReview ? 'recognition-quality warning' : 'recognition-quality'}>
            {recognition.quality.needsHumanReview ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
            <span><strong>{recognition.quality.needsHumanReview ? '需要重点核对' : '结构校验通过'}</strong><small>{recognition.quality.reviewReasons.join('；') || `证据覆盖 ${Math.round(recognition.quality.evidenceCoverage * 100)}%`}</small></span>
            <button type="button" className="text-button" onClick={onKeepExplicit}>只保留原文明确</button>
          </div>
          {recognition.conflicts.length > 0 && <div className="recognition-conflicts"><strong>发现 {recognition.conflicts.length} 项冲突</strong>{recognition.conflicts.map((conflict) => <p key={conflict.id}>{conflict.message}</p>)}</div>}
        </section>}
        <details className="source-details" open><summary><FileText size={16} />原始通知与定位依据</summary><p>{evidenceIndex >= 0 ? <>{sourceText.slice(0, evidenceIndex)}<mark>{activeEvidence}</mark>{sourceText.slice(evidenceIndex + activeEvidence.length)}</> : sourceText}</p>{activeEvidence && evidenceIndex < 0 && <small>这条依据来自解析结果，但无法在当前保存的原文中精确定位，请人工核对。</small>}</details>
        <section className="review-list recognition-tree" aria-label="项目树待确认事项">
          {recognition?.milestones.map((milestone) => <details className="recognition-stage" key={milestone.tempId} open>
            <summary><span><strong>{milestone.title}</strong><small>{milestone.objective || '阶段目标待确认'}</small></span><em>{milestone.tasks.length + milestone.workPackages.reduce((count, workPackage) => count + workPackage.tasks.length, 0)} 项</em></summary>
            {milestone.tasks.map((task) => {
              const item = draft.items.find((candidate) => candidate.suggestion.id === task.tempId)
              return item ? renderItem(item, draft.items.indexOf(item), milestone.tempId) : null
            })}
            {milestone.workPackages.map((workPackage) => <section className="recognition-work-package" key={workPackage.tempId}><header><strong>{workPackage.title}</strong><small>{workPackage.objective}</small></header>{workPackage.tasks.map((task) => { const item = draft.items.find((candidate) => candidate.suggestion.id === task.tempId); return item ? renderItem(item, draft.items.indexOf(item), milestone.tempId) : null })}</section>)}
          </details>)}
          {draft.items.filter((item) => !groupedItemIds.has(item.suggestion.id)).map((item, index) => renderItem(item, index))}
          {recognition && draft.items.length === 0 && <div className="empty-state compact"><ShieldCheck size={28} /><h3>没有识别到明确行动</h3><p>可保存为资料、关闭稍后处理，或返回录入手动创建任务。</p></div>}
          {recognition?.materials.length ? <section className="recognition-entity-list"><h3>材料</h3>{recognition.materials.map((material) => <label key={material.tempId}><input type="checkbox" checked={material.selected !== false} onChange={(event) => onToggleRecognitionEntity('material', material.tempId, event.target.checked)} /><span><strong>{material.name}</strong><small>{material.formatRequirements.join('；') || '具体要求请回看原文'}</small></span></label>)}</section> : null}
          {recognition?.timePoints.length ? <section className="recognition-entity-list"><h3>时间节点</h3>{recognition.timePoints.map((point) => <label key={point.tempId}><input type="checkbox" checked={point.selected !== false} onChange={(event) => onToggleRecognitionEntity('timePoint', point.tempId, event.target.checked)} /><span><strong>{point.type}</strong><small>{point.rawText}{point.needsConfirmation ? ' · 需要确认' : ''}</small></span></label>)}</section> : null}
          {recognition?.events.length ? <section className="recognition-events"><h3>事件安排</h3>{recognition.events.map((event) => <article key={event.tempId}><label><input type="checkbox" checked={event.selected !== false} onChange={(changeEvent) => onToggleRecognitionEntity('event', event.tempId, changeEvent.target.checked)} /><strong>{event.title}</strong></label><span>{inferenceLabels[event.inferenceLevel]}</span><p>{event.description}</p></article>)}</section> : null}
        </section>
      </div>
      <footer className="detail-footer review-footer">
        {selectedPending.length > 0 && <div className="confirmation-preview" aria-label="确认后创建预览">
          <strong>本次将创建</strong>
          <span>{projectWillCreate ? 1 : 0} 个项目</span>
          <span>{selectedPending.length} 个任务</span>
          <span>{recognition?.timePoints.filter((item) => item.selected !== false).length ?? pending.length} 个时间节点</span>
          <span>{pendingMaterials} 项材料</span>
          {recognition && <span>{recognition.events.filter((item) => item.selected !== false).length} 个事件</span>}
        </div>}
        <button className="secondary-button" type="button" onClick={onClose}>{pending.length ? '稍后再处理' : '完成'}</button>
        {selectedPending.length > 0 && <button className="primary-button" type="button" onClick={onConfirmAll}><CheckCheck size={17} />加入已选任务（{selectedPending.length}）</button>}
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
  onToggleSelected: (selected: boolean) => void
  onFocusEvidence: (quote: string) => void
  inferenceLevel?: InferenceLevel
  milestones: Array<{ id: string; title: string }>
  milestoneTempId?: string
  onMoveTask: DraftReviewPanelProps['onMoveTask']
  mergeTargets: Array<{ id: string; title: string }>
  onSplitTask: DraftReviewPanelProps['onSplitTask']
  onMergeTask: DraftReviewPanelProps['onMergeTask']
}

function DraftItemReview({ index, item, editing, onToggleEdit, onUpdate, onConfirm, onReject, onToggleSelected, onFocusEvidence, inferenceLevel, milestones, milestoneTempId, onMoveTask, mergeTargets, onSplitTask, onMergeTask }: DraftItemReviewProps) {
  const suggestion = item.suggestion
  const [mergeTargetId, setMergeTargetId] = useState('')
  if (item.status !== '待确认') return <article className={`review-item processed ${item.status === '已拒绝' ? 'rejected' : ''}`}>
    <span className="review-number">{index + 1}</span><div><strong>{suggestion.title}</strong><p>{item.status === '已确认' ? '已加入任务中心' : '已移除，不会创建任务'}</p></div>
  </article>

  return <article className="review-item">
    <header className="review-item-header">
      <label className="review-task-select"><input type="checkbox" checked={item.selected !== false} onChange={(event) => onToggleSelected(event.target.checked)} /><span className="sr-only">选择该任务</span></label>
      <span className="review-number">{index + 1}</span>
      <div><strong>{suggestion.title}</strong><time><Clock3 size={14} />{deadlineLabel(suggestion.deadline)}</time></div>
      <button className={editing ? 'review-edit active' : 'review-edit'} type="button" onClick={onToggleEdit}><PencilLine size={14} />{editing ? '收起' : '编辑'}</button>
    </header>
    <div className="review-meta"><span>{suggestion.category}</span><span>约 {suggestion.estimatedMinutes} 分钟</span>{suggestion.materials.length > 0 && <span>{suggestion.materials.length} 项材料</span>}{inferenceLevel && <span className={`inference-badge ${inferenceLevel}`}>{inferenceLabels[inferenceLevel]}</span>}{suggestion.confidence === '低' && <em>请重点核对</em>}</div>
    <p className="review-next"><span>下一步</span>{suggestion.nextAction}</p>
    {editing && <fieldset className="review-edit-form"><legend>修改这件事</legend><div className="form-grid">
      <label className="field span-2"><span>任务名称</span><input value={suggestion.title} onChange={(event) => onUpdate(item.id, { title: event.target.value })} /></label>
      <label className="field"><span>分类</span><select value={suggestion.category} onChange={(event) => onUpdate(item.id, { category: event.target.value as TaskCategory })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field"><span>截止时间</span><input type="datetime-local" value={suggestion.deadline} onChange={(event) => onUpdate(item.id, { deadline: event.target.value })} /></label>
      <label className="field"><span>预计耗时（分钟）</span><input type="number" min="5" step="5" value={suggestion.estimatedMinutes} onChange={(event) => onUpdate(item.id, { estimatedMinutes: Number(event.target.value) })} /></label>
      <label className="field span-2"><span>下一步动作</span><input value={suggestion.nextAction} onChange={(event) => onUpdate(item.id, { nextAction: event.target.value })} /></label>
      <label className="field span-2"><span>材料（用逗号或顿号分隔）</span><input value={suggestion.materials.join('、')} onChange={(event) => onUpdate(item.id, { materials: event.target.value.split(/[，,、]/).map((value) => value.trim()).filter(Boolean) })} /></label>
      {milestones.length > 0 && <label className="field span-2"><span>移动到阶段</span><select value={milestoneTempId ?? ''} onChange={(event) => onMoveTask(suggestion.id, event.target.value)}>{!milestoneTempId && <option value="">未分组</option>}{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select></label>}
      <div className="review-structure-actions span-2"><button className="text-button" type="button" onClick={() => onSplitTask(item.id)}>拆成两项</button>{mergeTargets.length > 0 && <><label><span className="sr-only">选择合并目标</span><select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">选择合并目标</option>{mergeTargets.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}</select></label><button className="text-button" type="button" disabled={!mergeTargetId} onClick={() => mergeTargetId && onMergeTask(item.id, mergeTargetId)}>合并到目标</button></>}</div>
    </div></fieldset>}
    <details className="item-evidence" open={suggestion.confidence === '低'}><summary>为什么这样拆？</summary><p>{suggestion.evidence || '原文未直接说明，需要人工确认。'}</p>{suggestion.evidenceRefs?.length ? <ul>{suggestion.evidenceRefs.map((reference) => { const quote = reference.quotedText ?? reference.quote; return <li key={reference.id}><strong>{reference.field}</strong>：{quote}<button type="button" onClick={() => onFocusEvidence(quote)}>在原文中定位</button></li> })}</ul> : <small>系统推测 · 原文未提供可定位依据</small>}</details>
    <footer className="review-item-actions"><button className="text-button remove" type="button" onClick={() => onReject(item.id)}><Trash2 size={14} />不需要</button><button className="secondary-button" type="button" onClick={() => onConfirm(item.id)}><Check size={15} />加入任务</button></footer>
  </article>
}
