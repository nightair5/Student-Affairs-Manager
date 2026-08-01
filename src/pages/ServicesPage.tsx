import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CloudCog,
  KeyRound,
  LoaderCircle,
  Mail,
  ListRestart,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import {
  emailJobStatusLabel,
  HttpEmailClient,
  type EmailQueueJob,
} from '../lib/emailClient'
import {
  HttpSyncClient,
  ServiceClientError,
  syncErrorMessage,
  type RemoteWorkspaceRecord,
  type ServiceHealth,
} from '../lib/syncClient'
import type { SyncIntegrationState, WorkspaceData } from '../types'

interface ServicesPageProps {
  workspace: WorkspaceData
  syncState: SyncIntegrationState
  onUpdateSyncState: (patch: Partial<SyncIntegrationState>) => void
  onReplaceWorkspace: (record: RemoteWorkspaceRecord, endpoint: string) => void
}

type OperationState = 'idle' | 'checking' | 'pushing' | 'pulling'

function maskedEmail(value: string): string {
  const [name, domain] = value.split('@')
  return domain ? `${name.slice(0, 2)}***@${domain}` : '已隐藏'
}

export function ServicesPage({ workspace, syncState, onUpdateSyncState, onReplaceWorkspace }: ServicesPageProps) {
  const [endpoint, setEndpoint] = useState(syncState.endpoint)
  const [token, setToken] = useState('')
  const [operation, setOperation] = useState<OperationState>('idle')
  const [health, setHealth] = useState<ServiceHealth | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'neutral' | 'success' | 'warning'>('neutral')
  const [pendingRemote, setPendingRemote] = useState<RemoteWorkspaceRecord | null>(null)
  const [conflictRevision, setConflictRevision] = useState<string | null>(null)
  const emailTasks = workspace.tasks.filter((task) => task.reminders.some((reminder) => reminder.channel === 'email' && reminder.enabled))
  const [emailTaskId, setEmailTaskId] = useState(emailTasks[0]?.id ?? '')
  const [recipient, setRecipient] = useState('')
  const [emailJobs, setEmailJobs] = useState<EmailQueueJob[]>([])
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')

  const client = () => new HttpSyncClient(endpoint.trim(), token)
  const emailClient = () => new HttpEmailClient(endpoint.trim(), token)
  const requireToken = () => {
    if (token.trim()) return true
    setMessage('请输入服务端同步令牌。令牌只保留在当前页面内存中。')
    setMessageTone('warning')
    return false
  }

  const checkService = async () => {
    setOperation('checking')
    setMessage('')
    try {
      const result = await client().health()
      setHealth(result)
      onUpdateSyncState({ endpoint: endpoint.trim() })
      setMessage(result.capabilities.sync === 'configured'
        ? '本地服务可达，同步已在服务端配置；仍需令牌验证。'
        : '本地服务可达，但同步令牌尚未在服务端配置。')
      setMessageTone(result.capabilities.sync === 'configured' ? 'success' : 'warning')
    } catch (error) {
      setHealth(null)
      setMessage(syncErrorMessage(error))
      setMessageTone('warning')
    } finally {
      setOperation('idle')
    }
  }

  const pushWorkspace = async (resolution: 'fail' | 'replace-remote' = 'fail') => {
    if (!requireToken()) return
    setOperation('pushing')
    setPendingRemote(null)
    try {
      const result = await client().push(workspace, syncState.lastRemoteRevision, resolution)
      onUpdateSyncState({
        endpoint: endpoint.trim(),
        lastRemoteRevision: result.revision,
        lastSyncedAt: result.updatedAt,
      })
      setConflictRevision(null)
      setMessage(result.conflictResolved ? '已按你的明确选择用本机数据覆盖远端。' : '本机工作区已上传到本地服务。')
      setMessageTone('success')
    } catch (error) {
      if (error instanceof ServiceClientError && error.code === 'SYNC_CONFLICT') {
        const revision = error.details?.remoteRevision
        setConflictRevision(typeof revision === 'string' ? revision : 'unknown')
      }
      setMessage(syncErrorMessage(error))
      setMessageTone('warning')
    } finally {
      setOperation('idle')
    }
  }

  const previewRemote = async () => {
    if (!requireToken()) return
    setOperation('pulling')
    setConflictRevision(null)
    try {
      const record = await client().pull()
      setPendingRemote(record)
      setMessage('已读取远端摘要。确认前不会替换本机数据。')
      setMessageTone('neutral')
    } catch (error) {
      setPendingRemote(null)
      setMessage(syncErrorMessage(error))
      setMessageTone('warning')
    } finally {
      setOperation('idle')
    }
  }

  const confirmRemote = () => {
    if (!pendingRemote) return
    onReplaceWorkspace(pendingRemote, endpoint.trim())
    setMessage('已用预览过的远端工作区替换本机数据。')
    setMessageTone('success')
    setPendingRemote(null)
  }

  const refreshEmail = async () => {
    if (!requireToken()) return
    setEmailBusy(true)
    try {
      const [status, jobs] = await Promise.all([emailClient().status(), emailClient().jobs()])
      setEmailConfigured(status.configured)
      setEmailJobs(jobs)
      setEmailMessage(status.configured
        ? '服务端邮件适配器已配置；队列状态来自真实服务。'
        : '邮件适配器未配置；队列任务不会被标记为已发送。')
    } catch (error) {
      setEmailMessage(syncErrorMessage(error))
    } finally {
      setEmailBusy(false)
    }
  }

  const enqueueEmail = async () => {
    if (!requireToken()) return
    const task = workspace.tasks.find((candidate) => candidate.id === emailTaskId)
    const reminder = task?.reminders.find((candidate) => candidate.channel === 'email' && candidate.enabled)
    if (!task || !reminder || !recipient.trim()) {
      setEmailMessage('请选择已启用邮件计划的任务并填写收件地址。')
      return
    }
    setEmailBusy(true)
    try {
      const job = await emailClient().enqueue({
        recipient: recipient.trim(),
        taskId: task.id,
        taskTitle: task.title,
        nextAction: task.nextAction,
        deadline: task.deadline,
        scheduledAt: reminder.scheduledAt,
      })
      setEmailJobs((current) => [job, ...current.filter((candidate) => candidate.id !== job.id)])
      setEmailMessage(job.status === 'blocked-not-configured'
        ? '计划已进入服务端队列，但因邮件适配器未配置而阻塞；没有发送。'
        : '计划已进入服务端队列，尚未等同于发送成功。')
    } catch (error) {
      setEmailMessage(syncErrorMessage(error))
    } finally {
      setEmailBusy(false)
    }
  }

  const retryEmail = async (jobId: string) => {
    setEmailBusy(true)
    try {
      const job = await emailClient().retry(jobId)
      setEmailJobs((current) => current.map((candidate) => candidate.id === job.id ? job : candidate))
      setEmailMessage(job.status === 'blocked-not-configured'
        ? '仍未配置邮件适配器，任务继续阻塞且没有发送。'
        : '已重新进入队列；最终结果以队列状态为准。')
    } catch (error) {
      setEmailMessage(syncErrorMessage(error))
    } finally {
      setEmailBusy(false)
    }
  }

  const processEmailQueue = async () => {
    setEmailBusy(true)
    try {
      const jobs = await emailClient().process()
      setEmailJobs(jobs)
      setEmailMessage('已要求服务端处理到期任务；请核对每项状态，不以按钮点击代替发送结果。')
    } catch (error) {
      setEmailMessage(syncErrorMessage(error))
    } finally {
      setEmailBusy(false)
    }
  }

  return <main className="page services-page">
    <header className="page-header">
      <div><span className="eyebrow">P2 · 安全服务边界</span><h1>服务接入</h1><p>真实服务默认关闭。密钥只属于服务端；浏览器令牌不持久化，任何覆盖都需要你再次确认。</p></div>
      <div className="header-stat"><ShieldCheck size={20} /><span><strong>{health?.status === 'ok' ? '可达' : '本机'}</strong> 安全边界</span></div>
    </header>

    <section className="service-hero" aria-labelledby="sync-title">
      <div className="service-hero-mark"><CloudCog size={28} /></div>
      <div><span className="section-index">SYNC FOUNDATION</span><h2 id="sync-title">本地服务与可替换同步接口</h2><p>服务端使用文件原子写入保存一份工作区，并以修订号检测冲突。它不是云账号系统，也不会自动同步。</p></div>
      <span className={`capability-badge ${health?.capabilities.sync === 'configured' ? 'ready' : 'offline'}`}>{health?.capabilities.sync === 'configured' ? '服务端已配置' : '尚未验证'}</span>
    </section>

    <div className="service-layout">
      <section className="service-card">
        <div className="service-card-heading"><div><span className="eyebrow">连接设置</span><h2>只连接你启动的服务</h2></div><KeyRound size={20} /></div>
        <label className="field"><span>服务地址</span><input type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="http://127.0.0.1:8787" /><small>地址会保存在本机工作区；不要填写包含密钥的 URL。</small></label>
        <label className="field"><span>同步令牌（仅当前页面）</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" placeholder="从本机 .env 中配置的令牌" /><small>不会写入 IndexedDB、JSON 备份或 Git；刷新后自动清空。</small></label>
        <button className="secondary-button" type="button" disabled={operation !== 'idle' || !endpoint.trim()} onClick={() => void checkService()}>{operation === 'checking' ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}检查服务状态</button>
        {message && <div className={`service-message ${messageTone}`} role="status">{messageTone === 'warning' ? <TriangleAlert size={17} /> : <CheckCircle2 size={17} />}<span>{message}</span></div>}
      </section>

      <section className="service-card">
        <div className="service-card-heading"><div><span className="eyebrow">手动同步</span><h2>先预览，再覆盖</h2></div><RefreshCw size={20} /></div>
        <div className="sync-summary"><div><small>本机任务</small><strong>{workspace.tasks.length}</strong></div><div><small>本机来源</small><strong>{workspace.sources.length}</strong></div><div><small>远端修订</small><strong>{syncState.lastRemoteRevision?.slice(0, 7) ?? '未同步'}</strong></div></div>
        <div className="service-actions"><button className="primary-button" type="button" disabled={operation !== 'idle'} onClick={() => void pushWorkspace()}><ArrowUpFromLine size={17} />上传本机</button><button className="secondary-button" type="button" disabled={operation !== 'idle'} onClick={() => void previewRemote()}><ArrowDownToLine size={17} />预览远端</button></div>
        {conflictRevision && <div className="conflict-panel"><strong>检测到远端冲突</strong><p>远端修订 {conflictRevision.slice(0, 8)} 与本机记录不同。可先预览远端；只有下方按钮会覆盖远端。</p><button className="danger-button" type="button" onClick={() => void pushWorkspace('replace-remote')}>确认以本机覆盖远端</button></div>}
        {pendingRemote && <div className="remote-preview"><span>远端预览 · {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(pendingRemote.updatedAt))}</span><div><strong>{pendingRemote.workspace.tasks.length}</strong> 项任务 · <strong>{pendingRemote.workspace.sources.length}</strong> 份来源 · 修订 {pendingRemote.revision.slice(0, 8)}</div><button className="danger-button" type="button" onClick={confirmRemote}>确认替换本机工作区</button></div>}
      </section>
    </div>

    <section className="boundary-list" aria-label="同步能力边界"><div><CheckCircle2 size={17} /><span><strong>真实可用</strong> 本地 HTTP 服务、令牌认证、原子保存、拉取/推送和冲突检测。</span></div><div><TriangleAlert size={17} /><span><strong>需要配置</strong> 用户需复制 `.env.example` 为 `.env`，设置随机令牌并启动服务。</span></div><div><CloudCog size={17} /><span><strong>尚未提供</strong> 账号登录、互联网托管、端到端加密和后台自动同步。</span></div></section>

    <section className="integration-section" aria-labelledby="email-service-title">
      <div className="integration-section-heading"><div><span className="section-index">EMAIL QUEUE</span><h2 id="email-service-title">邮件提醒队列</h2><p>收件地址和任务摘要只提交给你配置的本地服务；浏览器不保存邮件服务商密钥。</p></div><span className={`capability-badge light ${emailConfigured ? 'ready' : 'offline'}`}>{emailConfigured ? '适配器已配置' : '未接通'}</span></div>
      <div className="email-layout">
        <div className="service-card email-compose">
          <div className="service-card-heading"><div><span className="eyebrow">最小发送范围</span><h2>把已有提醒加入队列</h2></div><Mail size={20} /></div>
          <label className="field"><span>已有邮件提醒计划</span><select value={emailTaskId} onChange={(event) => setEmailTaskId(event.target.value)}><option value="">请选择任务</option>{emailTasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select><small>仅发送任务标题、下一步动作和截止时间，不发送来源原文或材料文件。</small></label>
          <label className="field"><span>收件邮箱</span><input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="student@example.com" autoComplete="email" /></label>
          <div className="service-actions"><button className="primary-button" type="button" disabled={emailBusy || !emailTaskId || !recipient.trim()} onClick={() => void enqueueEmail()}><Send size={16} />加入服务端队列</button><button className="secondary-button" type="button" disabled={emailBusy} onClick={() => void refreshEmail()}>{emailBusy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}读取真实状态</button></div>
          {emailMessage && <div className="service-message warning" role="status"><TriangleAlert size={17} /><span>{emailMessage}</span></div>}
        </div>
        <div className="service-card email-queue-card">
          <div className="service-card-heading"><div><span className="eyebrow">服务端记录</span><h2>发送与重试状态</h2></div><ListRestart size={20} /></div>
          <div className="queue-toolbar"><span>{emailJobs.length} 项队列记录</span><button className="secondary-button" type="button" disabled={emailBusy || !token.trim()} onClick={() => void processEmailQueue()}><RefreshCw size={15} />处理到期任务</button></div>
          {emailJobs.length ? <div className="email-job-list">{emailJobs.slice(0, 8).map((job) => <article className="email-job" key={job.id}><div><strong>{job.subject.replace('学生事务提醒 · ', '')}</strong><small>{maskedEmail(job.recipient)} · {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(job.scheduledAt))}</small></div><span className={`job-status ${job.status}`}>{emailJobStatusLabel(job.status)}</span><small>尝试 {job.attempts}/{job.maxAttempts}</small>{job.status !== 'sent' && <button type="button" onClick={() => void retryEmail(job.id)} disabled={emailBusy}>重试</button>}</article>)}</div> : <div className="empty-service-state"><Mail size={24} /><strong>尚未读取队列</strong><p>输入服务令牌并点击“读取真实状态”。未配置时不会生成虚假发送记录。</p></div>}
        </div>
      </div>
    </section>
  </main>
}
