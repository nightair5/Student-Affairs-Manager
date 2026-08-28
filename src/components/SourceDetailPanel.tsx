import { AlertTriangle, FileSearch, ListChecks, RefreshCw, ShieldCheck, SquarePen, X } from 'lucide-react'
import { useId, useRef } from 'react'
import { sourceTypeLabels, type SourceWorkflowItem } from '../lib/sourceWorkflow'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'

interface SourceDetailPanelProps {
  item: SourceWorkflowItem
  onClose: () => void
  onOpenDraft?: (draftId: string) => void
  onRetrySource?: (sourceId: string) => void | Promise<void>
  onManualSupplement?: (sourceId: string) => void
  retrying?: boolean
  actionError?: string | null
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '保存时间不可用'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function SourceDetailPanel({
  item,
  onClose,
  onOpenDraft,
  onRetrySource,
  onManualSupplement,
  retrying = false,
  actionError,
}: SourceDetailPanelProps) {
  const titleId = useId()
  const unavailableId = useId()
  const panelRef = useRef<HTMLElement>(null)
  useDialogFocusTrap(panelRef, onClose)
  const { source, draft, counts } = item
  const sourceText = source.content ?? source.rawText ?? source.contentPreview
  const actionsConnected = Boolean(onRetrySource && onManualSupplement)

  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <aside
      ref={panelRef}
      className="detail-panel source-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-source-status={item.status}
    >
      <header className="detail-header source-detail-header">
        <div>
          <span className={`source-workflow-status status-${item.status}`}>{item.statusLabel}</span>
          <h2 id={titleId}>{source.title}</h2>
          <p>{sourceTypeLabels[source.type]} · {formatDate(source.createdAt)}</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭来源详情"><X size={20} /></button>
      </header>

      <div className="detail-body source-detail-body">
        <section className="source-trust-summary" aria-labelledby={`${titleId}-status`}>
          {item.status === 'failed' ? <AlertTriangle size={19} /> : <ShieldCheck size={19} />}
          <div><h3 id={`${titleId}-status`}>{item.statusLabel}</h3><p>{item.statusDescription}</p></div>
        </section>

        {(item.errorMessage || actionError) && <div className="source-error-detail" role="alert">
          <AlertTriangle size={17} />
          <div><strong>{actionError ? '本次操作未完成' : '识别记录的错误'}</strong><p>{actionError ?? item.errorMessage}</p></div>
        </div>}

        <dl className="source-detail-facts">
          <div><dt>识别方式</dt><dd>{item.modelLabel ?? '未记录'}</dd></div>
          <div><dt>项目归属</dt><dd>{item.projectLabel ?? '未形成项目建议'}</dd></div>
          <div><dt>任务建议</dt><dd>{counts.tasks} 项</dd></div>
          <div><dt>待确认</dt><dd>{counts.pending} 项</dd></div>
          <div><dt>材料</dt><dd>{counts.materials} 项</dd></div>
          <div><dt>时间 / 活动</dt><dd>{counts.timePoints} / {counts.events} 项</dd></div>
        </dl>

        <section className="source-original" aria-labelledby={`${titleId}-original`}>
          <div className="source-section-heading"><FileSearch size={17} /><h3 id={`${titleId}-original`}>保存的来源内容</h3></div>
          <p>{sourceText || '当前来源没有可回看的文字；系统不会据此补写内容。'}</p>
          {source.url && <p className="source-url"><strong>来源网址：</strong><span>{source.url}</span></p>}
          <small>这里展示的是本机已保存文字，不代表已重新读取原文件或网页。</small>
        </section>

        {item.canRetry && !actionsConnected && <p className="source-action-unavailable" id={unavailableId}>
          当前页面尚未连接重试执行器；来源仍安全保留，请勿重复新建同一来源。
        </p>}
      </div>

      <footer className="detail-footer source-detail-actions">
        {item.canOpenDraft && draft && <button className="primary-button" type="button" onClick={() => onOpenDraft?.(draft.id)} disabled={!onOpenDraft}>
          <ListChecks size={16} />打开待确认建议
        </button>}
        {item.canRetry && <button
          className="secondary-button"
          type="button"
          onClick={() => { void onRetrySource?.(source.id) }}
          disabled={!onRetrySource || retrying}
          aria-describedby={!onRetrySource ? unavailableId : undefined}
        ><RefreshCw size={16} />{retrying ? '正在重试…' : '本地规则重试'}</button>}
        {item.canManualSupplement && <button
          className="secondary-button"
          type="button"
          onClick={() => onManualSupplement?.(source.id)}
          disabled={!onManualSupplement || retrying}
          aria-describedby={!onManualSupplement ? unavailableId : undefined}
        ><SquarePen size={16} />手工补充</button>}
        <button className="text-button" type="button" onClick={onClose}>关闭</button>
      </footer>
    </aside>
  </div>
}
