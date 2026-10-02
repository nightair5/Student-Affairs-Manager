import { Download, RotateCcw, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { MAX_WORKSPACE_IMPORT_BYTES } from '../lib/repository'

interface WorkspaceControlsProps {
  onExport: () => Promise<string>
  onImport: (serialized: string) => Promise<void>
  onClear: () => void
}

export function WorkspaceControls({ onExport, onImport, onClear }: WorkspaceControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [clearArmed, setClearArmed] = useState(false)
  const [message, setMessage] = useState('')
  const [backup,setBackup]=useState<{url:string;name:string;serialized:string}|null>(null)
  useEffect(()=>()=>{if(backup)URL.revokeObjectURL(backup.url)},[backup])

  const exportData = async () => {
    try {
      const serialized = await onExport()
      const blob = new Blob([serialized], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `student-affairs-v8-backup-${new Date().toISOString().slice(0, 10)}.json`
      setBackup({url,name:link.download,serialized})
      link.click()
      setMessage('备份已生成并请求浏览器下载。请检查下载结果；未下载时可再次下载或复制备份内容。')
    } catch {
      setMessage('导出失败：当前权威工作区尚未就绪。')
    }
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
      await onImport(await file.text())
      setMessage('已校验并导入备份，当前本机工作区已原子替换。')
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
    {backup&&<details><summary>下载与查看本次备份</summary><a href={backup.url} download={backup.name}>再次下载本次 JSON 备份</a><label>本次备份内容（请妥善保管）<textarea aria-label="本次备份内容" readOnly value={backup.serialized}/></label></details>}
  </section>
}
