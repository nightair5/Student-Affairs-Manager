import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import './pilot.css'

type PilotStatus = { allowed: false; phase: 'closed' | 'notice' | 'unauthorized' } | {
  allowed: true
  phase: 'active' | 'export'
  endsAt: string
  exportEndsAt: string
  dailyRemaining: number
  cloudEnabled: boolean
  deadline: number
}

async function readStatus(controller: AbortController): Promise<PilotStatus> {
  const started = performance.now()
  const timeout = window.setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch('/__pilot/status', { cache: 'no-store', signal: controller.signal })
    if (response.status === 401) {
      const data: unknown = await response.json()
      const phase = data && typeof data === 'object' && 'phase' in data ? data.phase : undefined
      return { allowed: false, phase: phase === 'closed' || phase === 'notice' ? phase : 'unauthorized' }
    }
    if (!response.ok) throw new Error('PILOT_STATUS_UNAVAILABLE')
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('allowed' in data) || data.allowed !== true
      || !('phase' in data) || (data.phase !== 'active' && data.phase !== 'export')
      || !('endsAt' in data) || typeof data.endsAt !== 'string'
      || !('exportEndsAt' in data) || typeof data.exportEndsAt !== 'string'
      || !('checkedAtMs' in data) || typeof data.checkedAtMs !== 'number'
      || !('dailyRemaining' in data) || typeof data.dailyRemaining !== 'number'
      || !('cloudEnabled' in data) || typeof data.cloudEnabled !== 'boolean') throw new Error('PILOT_STATUS_INVALID')
    const next = Date.parse(data.phase === 'active' ? data.endsAt : data.exportEndsAt)
    if (!Number.isFinite(next) || next <= data.checkedAtMs) throw new Error('PILOT_STATUS_INVALID')
    return { allowed: true, phase: data.phase, endsAt: data.endsAt, exportEndsAt: data.exportEndsAt,
      dailyRemaining: data.dailyRemaining, cloudEnabled: data.cloudEnabled, deadline: started + (next - data.checkedAtMs) }
  } finally {
    window.clearTimeout(timeout)
  }
}

function chinaTime(value: string) {
  return `${new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）`
}

function PilotPage({ title, children }: { title: string; children: ReactNode }) {
  return <>
    <main className="pilot-page" aria-labelledby="pilot-title">
      <h1 id="pilot-title">{title}</h1>
      {children}
    </main>
    <footer className="site-icp"><a href="https://beian.miit.gov.cn/">桂ICP备2026027233号-1</a></footer>
  </>
}

const workspaceRepository = new IndexedDbWorkspaceRepository()

function PilotExport({ exportEndsAt }: { exportEndsAt: string }) {
  const request = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [backup, setBackup] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => () => { if (backup) URL.revokeObjectURL(backup.url) }, [backup])

  async function downloadWorkspace() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setMessage('正在准备本机备份。')
    try {
      const status = await readStatus(controller)
      if (!status.allowed || status.phase !== 'export') {
        setBackup(null)
        setMessage('当前备份窗口已关闭。')
        return
      }
      let recovery = false
      let serialized: string | null
      try {
        serialized = await workspaceRepository.exportCurrentJson()
      } catch {
        serialized = await workspaceRepository.exportProtectedCurrentSnapshot()
        recovery = true
      }
      if (controller.signal.aborted) return
      if (performance.now() >= status.deadline) {
        setBackup(null)
        setMessage('当前备份窗口已关闭。')
        return
      }
      if (!serialized) {
        setMessage('当前浏览器没有可下载的工作区。请检查是否用了保存数据的原浏览器。')
        return
      }
      const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }))
      const name = `student-affairs-${recovery ? 'original-rescue' : 'v8-backup'}-${new Date().toISOString().slice(0, 10)}.json`
      setBackup({ url, name })
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setMessage(recovery ? '已请求下载原始数据备份。请保存文件并联系邀请人协助恢复。' : '已请求浏览器下载。请确认文件已保存。')
    } catch {
      setMessage('暂时无法导出，请检查网络和浏览器的存储权限后重试。')
    } finally {
      request.current = null
      setBusy(false)
    }
  }

  return <PilotPage title="下载本机工作区备份">
    <p>本轮测试已结束。请在 {chinaTime(exportEndsAt)} 前，用保存数据的原浏览器下载 JSON。</p>
    <button type="button" className="primary-button" disabled={busy} onClick={() => void downloadWorkspace()}>导出 JSON</button>
    {message && <p role="status">{message}</p>}
    {backup && <a href={backup.url} download={backup.name}>再次下载本次备份</a>}
  </PilotPage>
}

export function PilotAccess({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PilotStatus | 'unavailable' | null>(null)

  useEffect(() => {
    let pending: AbortController | null = null
    let timer = 0
    let deadlineTimer = 0
    let deadline = 0
    let stopped = false

    async function refresh() {
      if (pending || stopped) return
      window.clearTimeout(timer)
      if (deadline && deadline <= performance.now()) setStatus(null)
      const controller = new AbortController()
      pending = controller
      try {
        const result = await readStatus(controller)
        if (stopped) return
        deadline = result.allowed ? result.deadline : 0
        window.clearTimeout(deadlineTimer)
        if (deadline) {
          const remaining = deadline - performance.now()
          if (remaining > 0) {
            // Longer deadlines are renewed on the next status poll.
            if (remaining <= 30_000) deadlineTimer = window.setTimeout(() => {
              setStatus(null)
              void refresh()
            }, remaining)
            setStatus(result)
          } else setStatus(null)
        } else setStatus(result)
      } catch {
        if (!stopped && deadline <= performance.now()) {
          deadline = 0
          setStatus('unavailable')
        }
      } finally {
        pending = null
        if (!stopped) {
          const delay = deadline ? Math.max(200, Math.min(30_000, deadline - performance.now())) : 30_000
          timer = window.setTimeout(() => void refresh(), delay)
        }
      }
    }

    void refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      stopped = true
      pending?.abort()
      window.clearTimeout(timer)
      window.clearTimeout(deadlineTimer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  if (!status) return <PilotPage title="邀请测试"><p role="status">正在核对访问权限。</p></PilotPage>
  if (status === 'unavailable') return <PilotPage title="暂时无法核对权限"><p>请连接网络后刷新页面。</p></PilotPage>
  if (!status.allowed) {
    if (status.phase === 'notice') return <PilotPage title="请先确认用户须知"><a href="/__pilot/notice">阅读用户须知和免责声明</a></PilotPage>
    if (status.phase === 'closed') return <PilotPage title="本轮测试已结束"><p>备份窗口已关闭。已下载的文件仍保存在你的设备上。</p></PilotPage>
    return <PilotPage title="访问权限已失效"><a href="/__pilot/login">返回邀请码入口</a></PilotPage>
  }
  if (status.phase === 'export') return <PilotExport exportEndsAt={status.exportEndsAt} />

  return <>
    <aside role="status" className="pilot-notice">
      邀请测试截至 {chinaTime(status.endsAt)}。{status.cloudEnabled ? `今日还能使用云端整理 ${status.dailyRemaining} 次。` : '当前使用本机整理。'}
    </aside>
    {children}
  </>
}
