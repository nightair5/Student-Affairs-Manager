import { useEffect, useState } from 'react'

type PilotStatus = { allowed: boolean; phase: string; endsAt?: string; exportEndsAt?: string; dailyRemaining?: number }

function time(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : ''
}

export function PilotNotice() {
  const [status, setStatus] = useState<PilotStatus | null>(null)
  useEffect(() => {
    let live = true
    async function update() {
      try {
        const response = await fetch('/__pilot/status', { cache: 'no-store', credentials: 'same-origin' })
        if (!(response.headers.get('content-type') ?? '').includes('application/json')) return
        const data: unknown = await response.json()
        if (live && data && typeof data === 'object' && 'phase' in data && 'allowed' in data) setStatus(data as PilotStatus)
      } catch { /* A network failure does not delete or hide unsaved local data. */ }
    }
    void update()
    const timer = window.setInterval(() => void update(), 30_000)
    return () => { live = false; window.clearInterval(timer) }
  }, [])
  if (!status) return null
  const notice = !status.allowed
    ? '本轮访问已失效或结束。已打开的本地页面可能暂时保留；云端服务已不可使用。'
    : status.phase === 'export'
      ? `测试已结束，云端功能已关闭。请在 ${time(status.exportEndsAt)} 前从项目档案导出本机备份。页面中已有的本地操作仍可能可用。`
      : `邀请测试中，云端整理今日个人剩余 ${status.dailyRemaining ?? '—'} 次，另受全体额度限制；使用截至 ${time(status.endsAt)}，请在 ${time(status.exportEndsAt)} 前导出需要保留的数据。`
  return <aside role="status" style={{ padding: '10px 18px', background: '#eaf2ee', color: '#173c34', borderBottom: '1px solid #b8d2c5', fontSize: '14px', lineHeight: 1.5 }}>{notice}</aside>
}
