import { CloudOff, MessageCircleMore, ShieldAlert, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  clearConnectionIntent,
  connectionRequirements,
  connectionStatus,
  connectionStatusLabel,
  recordConnectionIntent,
} from '../lib/integrationConnections'
import type { ConnectionIntent, ConnectionPlatform } from '../types'

interface PlatformConnectionsPanelProps {
  intents: ConnectionIntent[]
  onChange: (intents: ConnectionIntent[]) => void
}

const platforms: ConnectionPlatform[] = ['wechat', 'cross-device']

export function PlatformConnectionsPanel({ intents, onChange }: PlatformConnectionsPanelProps) {
  const [pendingClear, setPendingClear] = useState<ConnectionPlatform | null>(null)
  const [message, setMessage] = useState('')

  return <section className="integration-section" aria-labelledby="platform-connections-title">
    <div className="integration-section-heading">
      <div><span className="section-index">AUTHORIZATION READINESS</span><h2 id="platform-connections-title">平台接入准备</h2><p>这里记录的是“已了解接入条件”，不是账号绑定或授权成功；当前不会传输任何用户内容。</p></div>
      <span className="capability-badge light offline">全部未接通</span>
    </div>

    <div className="connection-grid">{platforms.map((platform) => {
      const requirement = connectionRequirements[platform]
      const status = connectionStatus(intents, platform)
      const intent = intents.find((candidate) => candidate.platform === platform)
      const isWechat = platform === 'wechat'
      return <article className="connection-card" key={platform}>
        <div className="connection-card-heading"><span>{isWechat ? <MessageCircleMore size={22} /> : <Smartphone size={22} />}</span><div><small>{isWechat ? 'WECHAT' : 'CROSS-DEVICE'}</small><h3>{requirement.title}</h3></div><span className="job-status">{connectionStatusLabel(status)}</span></div>
        <p>{isWechat ? '仅规划通过官方许可渠道发送最小化提醒；不读取聊天记录、不模拟登录、不自动外发。' : '现有本地服务只支持手动单工作区同步；没有云账号、设备列表或后台自动同步。'}</p>
        <div className="scope-block"><strong>计划中的最小范围</strong><ul>{requirement.plannedScopes.map((scope) => <li key={scope}>{scope}</li>)}</ul></div>
        <div className="blocker-block"><strong><ShieldAlert size={15} />仍缺少</strong><ul>{requirement.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>
        {intent ? <div className="connection-intent-record"><ShieldCheck size={16} /><span>已于 {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(intent.reviewedAt))} 记录了解；状态仍是“{connectionStatusLabel(status)}”。</span><button type="button" aria-label={`清除${requirement.title}接入意向`} onClick={() => setPendingClear(platform)}><Trash2 size={14} /></button></div> : <button className="secondary-button" type="button" onClick={() => { onChange(recordConnectionIntent(intents, platform)); setMessage(`${requirement.title}的前置条件已记录；没有发起授权，也没有传输数据。`) }}><CloudOff size={16} />记录我已了解条件</button>}
        {pendingClear === platform && <div className="monitor-delete-confirm" role="alert"><span>清除此接入意向记录？不会影响本机任务数据。</span><button type="button" onClick={() => { onChange(clearConnectionIntent(intents, platform)); setPendingClear(null); setMessage(`${requirement.title}的接入意向记录已清除。`) }}>确认清除</button><button type="button" onClick={() => setPendingClear(null)}>取消</button></div>}
      </article>
    })}</div>
    {message && <div className="service-message success" role="status"><ShieldCheck size={17} /><span>{message}</span></div>}
    <div className="boundary-list connection-boundary" aria-label="平台能力边界"><div><CloudOff size={17} /><span><strong>没有真实授权</strong> 页面不会打开微信授权，也不会创建云账号。</span></div><div><ShieldCheck size={17} /><span><strong>没有数据外发</strong> 接入意向只保存在本机工作区，可随时清除。</span></div><div><ShieldAlert size={17} /><span><strong>上线前必需</strong> 平台审批、用户撤权、账号安全与合规评审。</span></div></div>
  </section>
}
