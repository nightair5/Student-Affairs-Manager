import { Download, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { useId, useRef } from 'react'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'

interface WorkspaceRecoveryPanelProps {
  backupId: string
  errorCodes: string[]
  backupExported: boolean
  confirmationArmed: boolean
  busy: 'exporting' | 'recovering' | null
  failureCode: string | null
  onExportBackup: () => void
  onRequestRecovery: () => void
  onCancelRecovery: () => void
}

export function WorkspaceRecoveryPanel({
  backupId,
  errorCodes,
  backupExported,
  confirmationArmed,
  busy,
  failureCode,
  onExportBackup,
  onRequestRecovery,
  onCancelRecovery,
}: WorkspaceRecoveryPanelProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const exportRef = useRef<HTMLButtonElement>(null)

  useDialogFocusTrap(
    dialogRef,
    confirmationArmed ? onCancelRecovery : () => undefined,
    exportRef,
  )

  return <div className="modal-backdrop workspace-recovery-backdrop" role="presentation">
    <section
      ref={dialogRef}
      className="workspace-recovery-panel"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby="workspace-recovery-description"
    >
      <header>
        <span className="workspace-recovery-icon" aria-hidden="true"><ShieldAlert size={24} /></span>
        <div>
          <span className="eyebrow">本机数据保护</span>
          <h2 id={titleId}>迁移数据需恢复</h2>
        </div>
      </header>

      <p id="workspace-recovery-description">
        当前 Workspace v8 未通过迁移完整性检查。应用已停止自动保存，也没有自动回滚。请先下载指定迁移前备份，再显式确认恢复。
      </p>

      <dl className="workspace-recovery-details">
        <div><dt>指定备份</dt><dd><code>{backupId}</code></dd></div>
        <div><dt>安全错误</dt><dd>{errorCodes.map((code) => <code key={code}>{code}</code>)}</dd></div>
      </dl>

      <ol className="workspace-recovery-steps">
        <li className={backupExported ? 'complete' : ''}><strong>1</strong><span>导出并妥善保存上述指定备份。</span></li>
        <li className={confirmationArmed ? 'active' : ''}><strong>2</strong><span>确认后从该备份恢复；恢复失败时继续保持只读保护。</span></li>
      </ol>

      {failureCode && <p className="workspace-recovery-failure" role="alert">操作未完成：<code>{failureCode}</code>。当前数据仍受保护，未继续保存。</p>}
      {backupExported && !confirmationArmed && <p className="workspace-recovery-message" role="status">备份下载已发起。检查下载文件后，可进入恢复确认。</p>}
      {confirmationArmed && <p className="workspace-recovery-confirm" role="alert">再次点击“确认从备份恢复”才会执行恢复。此操作不会使用浏览器确认框。</p>}

      <footer>
        <button
          ref={exportRef}
          className="secondary-button"
          type="button"
          disabled={busy !== null}
          onClick={onExportBackup}
        >
          <Download size={17} />{busy === 'exporting' ? '正在导出…' : backupExported ? '重新导出指定备份' : '先导出指定备份'}
        </button>
        {confirmationArmed && <button className="secondary-button" type="button" disabled={busy !== null} onClick={onCancelRecovery}><X size={17} />取消确认</button>}
        <button
          className={confirmationArmed ? 'danger-button armed' : 'danger-button'}
          type="button"
          disabled={!backupExported || busy !== null}
          onClick={onRequestRecovery}
        >
          <RotateCcw size={17} />
          {busy === 'recovering' ? '正在恢复…' : confirmationArmed ? '确认从备份恢复' : '准备恢复'}
        </button>
      </footer>
    </section>
  </div>
}
