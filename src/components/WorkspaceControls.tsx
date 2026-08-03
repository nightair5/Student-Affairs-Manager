import { Download, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import type { WorkspaceData } from '../types'
import { MAX_WORKSPACE_IMPORT_BYTES } from '../lib/repository'

interface WorkspaceControlsProps {
  workspace: WorkspaceData
  onImport: (serialized: string) => void
  onClear: () => void
}

export function WorkspaceControls({ workspace, onImport, onClear }: WorkspaceControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [clearArmed, setClearArmed] = useState(false)
  const [message, setMessage] = useState('')

  const exportData = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `student-affairs-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('已下载本机数据备份。')
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_WORKSPACE_IMPORT_BYTES) {
      setMessage('导入失败：JSON 备份不能超过 5 MB。')
      event.target.value = ''
      return
    }
    try {
      onImport(await file.text())
      setMessage('已导入备份并替换当前本机工作区。')
    } catch {
      setMessage('导入失败：请选择由本产品导出的 JSON 文件。')
    } finally {
      event.target.value = ''
    }
  }

  const clearData = () => {
    if (!clearArmed) {
      setClearArmed(true)
      setMessage('再次点击“确认清空”才会移除本机工作区。')
      return
    }
    onClear()
    setClearArmed(false)
    setMessage('已清空本机工作区；此操作无法撤销。')
  }

  return <section className="workspace-controls" aria-labelledby="workspace-controls-title">
    <div><span className="eyebrow">本机数据</span><h2 id="workspace-controls-title">备份与清空</h2><p>数据保存在当前设备、浏览器和站点中，不含文件本体，不支持跨设备同步。</p></div>
    <div className="workspace-control-actions">
      <button className="secondary-button" type="button" onClick={exportData}><Download size={16} />导出 JSON</button>
      <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}><Upload size={16} />导入 JSON</button>
      <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={importData} />
      <button className={clearArmed ? 'danger-button armed' : 'danger-button'} type="button" onClick={clearData}><RotateCcw size={16} />{clearArmed ? '确认清空' : '清空数据'}</button>
    </div>
    {message && <p className="workspace-control-message" role="status">{message}</p>}
  </section>
}
