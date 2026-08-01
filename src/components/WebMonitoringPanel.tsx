import { CheckCircle2, FileDiff, Globe2, LoaderCircle, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { HttpWebMonitorClient, webFetchErrorMessage } from '../lib/webMonitorClient'
import {
  applyMonitorCheck,
  createWebMonitor,
  MAX_MONITOR_TEXT_LENGTH,
  validateMonitorUrl,
} from '../lib/webMonitoring'
import type { WebMonitor } from '../types'

interface WebMonitoringPanelProps {
  endpoint: string
  token: string
  monitors: WebMonitor[]
  onChange: (monitors: WebMonitor[]) => void
}

function formatCheckedAt(value?: string): string {
  return value
    ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : '尚未比较'
}

export function WebMonitoringPanel({ endpoint, token, monitors, onChange }: WebMonitoringPanelProps) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [baseline, setBaseline] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [activeId, setActiveId] = useState(monitors[0]?.id ?? '')
  const [currentText, setCurrentText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState('')

  const activeMonitor = monitors.find((monitor) => monitor.id === activeId)

  const addMonitor = () => {
    const urlError = validateMonitorUrl(url.trim())
    if (!title.trim() || !baseline.trim() || urlError || !authorized) {
      setMessage(urlError ?? (!authorized ? '请先确认你有权读取该公开页面，并理解内容会保存在本机。' : '请填写名称和首版正文。'))
      return
    }
    const monitor = createWebMonitor(title, url, baseline)
    onChange([monitor, ...monitors])
    setActiveId(monitor.id)
    setTitle('')
    setUrl('')
    setBaseline('')
    setAuthorized(false)
    setMessage('已在本机保存首版基线；尚未启动后台抓取。')
  }

  const updateMonitor = (updated: WebMonitor) => {
    onChange(monitors.map((monitor) => monitor.id === updated.id ? updated : monitor))
  }

  const compareLocal = () => {
    if (!activeMonitor || !currentText.trim()) {
      setMessage('请选择监测项并粘贴当前版本正文。')
      return
    }
    const updated = applyMonitorCheck(activeMonitor, currentText, 'local-paste')
    updateMonitor(updated)
    setCurrentText('')
    setMessage(updated.lastResult?.changed
      ? '检测到变化，差异摘要已保存；当前版本已成为下一次比较的基线。'
      : '未检测到正文变化；本次检查时间已保存。')
  }

  const fetchFromServer = async () => {
    if (!activeMonitor) {
      setMessage('请先选择一个监测项。')
      return
    }
    if (!token.trim()) {
      setMessage('请输入页面上方的服务令牌；令牌不会持久化。')
      return
    }
    setBusy(true)
    try {
      const result = await new HttpWebMonitorClient(endpoint.trim(), token).fetchText(activeMonitor.url)
      const updated = applyMonitorCheck(activeMonitor, result.text, 'server-fetch', result.fetchedAt)
      updateMonitor(updated)
      setMessage(updated.lastResult?.changed
        ? '服务端读取成功并检测到变化；差异摘要已保存。'
        : '服务端读取成功，未检测到正文变化。')
    } catch (error) {
      setMessage(webFetchErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <section className="integration-section" aria-labelledby="web-monitor-title">
    <div className="integration-section-heading">
      <div><span className="section-index">WEB CHANGE CHECK</span><h2 id="web-monitor-title">网页通知变更检查</h2><p>只有你主动添加并授权的 HTTPS 链接才会进入清单。默认使用本地粘贴比较，不会后台抓取。</p></div>
      <span className="capability-badge light offline">主动检查</span>
    </div>

    <div className="monitor-layout">
      <div className="service-card monitor-create">
        <div className="service-card-heading"><div><span className="eyebrow">授权与首版</span><h2>建立本机比较基线</h2></div><ShieldCheck size={20} /></div>
        <label className="field"><span>监测名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：学院竞赛通知" /></label>
        <label className="field"><span>公开页面 HTTPS 链接</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.edu/notice" /></label>
        <label className="field"><span>首版正文</span><textarea value={baseline} onChange={(event) => setBaseline(event.target.value)} maxLength={MAX_MONITOR_TEXT_LENGTH} rows={6} placeholder="粘贴当前通知正文，作为第一次比较基线" /><small>正文保存在当前浏览器 IndexedDB；不会自动执行页面中的任何指令或脚本。</small></label>
        <label className="consent-row"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /><span>我确认有权读取此公开页面，并同意将链接与正文保存在本机；服务端读取时仅发送此链接。</span></label>
        <button className="primary-button" type="button" onClick={addMonitor} disabled={!title.trim() || !url.trim() || !baseline.trim() || !authorized}><Globe2 size={16} />保存本机基线</button>
      </div>

      <div className="service-card monitor-check">
        <div className="service-card-heading"><div><span className="eyebrow">人工触发</span><h2>比较新版本</h2></div><FileDiff size={20} /></div>
        <label className="field"><span>已授权监测项</span><select value={activeId} onChange={(event) => { setActiveId(event.target.value); setCurrentText('') }}><option value="">请选择</option>{monitors.map((monitor) => <option key={monitor.id} value={monitor.id}>{monitor.title}</option>)}</select></label>
        <label className="field"><span>当前版本正文</span><textarea value={currentText} onChange={(event) => setCurrentText(event.target.value)} maxLength={MAX_MONITOR_TEXT_LENGTH} rows={6} placeholder="无需服务端：粘贴新版本后进行本地比较" /><small>点击比较后，当前版本会成为下一次检查的基线。</small></label>
        <div className="service-actions"><button className="primary-button" type="button" disabled={!activeMonitor || !currentText.trim()} onClick={compareLocal}><FileDiff size={16} />比较并更新基线</button><button className="secondary-button" type="button" disabled={!activeMonitor || busy} onClick={() => void fetchFromServer()}>{busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}尝试服务端读取</button></div>
        {message && <div className="service-message warning" role="status"><TriangleAlert size={17} /><span>{message}</span></div>}
      </div>
    </div>

    {monitors.length ? <div className="monitor-list" aria-label="网页监测记录">{monitors.map((monitor) => <article className="monitor-record" key={monitor.id}>
      <div className="monitor-record-title"><div><strong>{monitor.title}</strong><a href={monitor.url} target="_blank" rel="noreferrer">查看原页面</a></div><div className="monitor-record-actions"><span className={`job-status ${monitor.status === 'changed' ? 'failed' : 'sent'}`}>{monitor.status === 'changed' ? '发现变化' : monitor.status === 'unchanged' ? '未变化' : '仅有基线'}</span><button type="button" aria-label={`删除 ${monitor.title} 监测项`} onClick={() => setPendingDeleteId(monitor.id)}><Trash2 size={14} /></button></div></div>
      <small>授权于 {formatCheckedAt(monitor.authorizedAt)} · 最近检查 {formatCheckedAt(monitor.lastCheckedAt)} · 基线 {monitor.baselineHash}</small>
      {monitor.lastResult && <div className="change-explanation">{monitor.lastResult.changed ? <TriangleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{monitor.lastResult.changed ? `新增 ${monitor.lastResult.addedLineCount} 行，移除 ${monitor.lastResult.removedLineCount} 行。` : '规范化正文哈希一致。'} 检查方式：{monitor.lastResult.method === 'server-fetch' ? '服务端主动读取' : '本地粘贴'}。</span>{monitor.lastResult.addedSamples.map((sample) => <q key={`add-${sample}`}>新增：{sample}</q>)}{monitor.lastResult.removedSamples.map((sample) => <q key={`remove-${sample}`}>移除：{sample}</q>)}</div>}
      {pendingDeleteId === monitor.id && <div className="monitor-delete-confirm" role="alert"><span>删除此本机基线和检查记录？原网页不会受影响。</span><button type="button" onClick={() => { onChange(monitors.filter((candidate) => candidate.id !== monitor.id)); setPendingDeleteId(''); if (activeId === monitor.id) setActiveId('') }}>确认删除</button><button type="button" onClick={() => setPendingDeleteId('')}>取消</button></div>}
    </article>)}</div> : <div className="empty-service-state compact"><Globe2 size={24} /><strong>暂无监测项</strong><p>保存首版基线后，可随时粘贴新版本比较；不会自动定时读取。</p></div>}
  </section>
}
