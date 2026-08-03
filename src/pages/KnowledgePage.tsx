import { BookOpenCheck, CheckCircle2, Cloud, Download, FolderOpen, LoaderCircle, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ProxyDeepSeekService } from '../lib/deepseek'
import { answerLocally, buildKnowledgeDocuments, type KnowledgeCitation } from '../lib/knowledge'
import { buildObsidianVault, downloadObsidianZip, writeObsidianFolder } from '../lib/obsidian'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'
import type { Project, Source, Task } from '../types'

interface KnowledgePageProps {
  tasks: Task[]
  sources: Source[]
  projects: Project[]
  localSearchAuthorizedAt?: string
  onSaveLocalAuthorization: () => void
  onClearLocalAuthorization: () => void
}

const deepSeekService = new ProxyDeepSeekService()

export function KnowledgePage({
  tasks, sources, projects, localSearchAuthorizedAt, onSaveLocalAuthorization, onClearLocalAuthorization,
}: KnowledgePageProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<{ text: string; citations: KnowledgeCitation[]; source: 'local' | 'cloud' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false)
  const [cloudAcknowledged, setCloudAcknowledged] = useState(false)
  const [deepSeekConfigured, setDeepSeekConfigured] = useState(false)
  const [configurationChecked, setConfigurationChecked] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set(tasks.map((task) => task.id)))
  const cloudCancelRef = useRef<HTMLButtonElement>(null)
  const cloudDialogRef = useRef<HTMLElement>(null)
  const documents = useMemo(() => buildKnowledgeDocuments(tasks, sources, projects), [projects, sources, tasks])
  const selectedTasks = useMemo(() => tasks.filter((task) => selectedTaskIds.has(task.id)), [selectedTaskIds, tasks])
  const selectedSourceIds = useMemo(() => new Set(selectedTasks.flatMap((task) => task.sourceIds)), [selectedTasks])
  const selectedProjectIds = useMemo(() => new Set(selectedTasks.map((task) => task.projectId).filter(Boolean)), [selectedTasks])
  const vault = useMemo(() => buildObsidianVault(
    selectedTasks,
    sources.filter((source) => selectedSourceIds.has(source.id)),
    projects.filter((project) => selectedProjectIds.has(project.id)),
  ), [projects, selectedProjectIds, selectedSourceIds, selectedTasks, sources])

  useDialogFocusTrap(cloudDialogRef, () => setCloudDialogOpen(false), cloudCancelRef, cloudDialogOpen)

  useEffect(() => {
    let active = true
    void deepSeekService.status().then((status) => {
      if (active) { setDeepSeekConfigured(status.configured); setConfigurationChecked(true) }
    })
    return () => { active = false }
  }, [])

  const localResult = () => answerLocally(question, documents)

  const askLocally = () => {
    if (!localSearchAuthorizedAt || !question.trim()) return
    setLoading(true)
    setError('')
    window.setTimeout(() => {
      const result = localResult()
      setAnswer({ text: result.answer, citations: result.citations, source: 'local' })
      setLoading(false)
    }, 120)
  }

  const prepareCloud = () => {
    const result = localResult()
    if (!result.matched) {
      setAnswer({ text: result.answer, citations: [], source: 'local' })
      setError('没有匹配引用，因此不会把无依据的问题发送到云端。')
      return
    }
    setError('')
    setCloudDialogOpen(true)
  }

  const askCloud = async () => {
    if (!cloudAcknowledged) return
    const local = localResult()
    if (!local.matched) return
    setCloudDialogOpen(false)
    setLoading(true)
    setError('')
    try {
      const response = await deepSeekService.ask({
        question,
        context: local.citations.map(({ title, kind, excerpt }) => ({ title, kind, excerpt })),
      })
      setAnswer({ text: response.answer, citations: local.citations, source: 'cloud' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'DeepSeek 服务暂时无法响应')
    } finally {
      setLoading(false)
      setCloudAcknowledged(false)
    }
  }

  const chooseFolder = async () => {
    const picker = (window as typeof window & { showDirectoryPicker?: () => Promise<Parameters<typeof writeObsidianFolder>[1]> }).showDirectoryPicker
    if (!picker) {
      setExportMessage('当前浏览器不支持选择文件夹。请下载 ZIP，再手动解压到 Obsidian 仓库。')
      return
    }
    try {
      const directory = await picker()
      await writeObsidianFolder(vault, directory)
      setExportMessage(`已写入你主动选择的文件夹，共 ${vault.length} 个 Markdown 文件；这是一份快照，不会自动同步。`)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setExportMessage('写入失败：请检查文件夹权限后重试。')
    }
  }

  return <main className="page knowledge-page">
    <header className="page-header knowledge-header">
      <div><span className="eyebrow">P1 · 本地资料检索</span><h1>知识问答</h1><p>只检索你已保存且明确授权的本地工作区资料，回答会列出依据。</p></div>
      <div className={deepSeekConfigured ? 'connection-state connected' : 'connection-state'}><Cloud size={18} /><span>{configurationChecked && deepSeekConfigured ? 'DeepSeek 代理已配置' : 'DeepSeek 尚未连接'}</span></div>
    </header>

    {!localSearchAuthorizedAt ? <section className="knowledge-consent" aria-labelledby="knowledge-consent-title">
      <ShieldCheck size={24} aria-hidden="true" />
      <div><span className="eyebrow">需要本地授权</span><h2 id="knowledge-consent-title">允许本地检索读取此工作区</h2><p>授权后仅在当前浏览器读取任务、项目、来源摘要、材料和修改历史；默认不向外部服务发送。</p><button className="primary-button" type="button" onClick={onSaveLocalAuthorization}><CheckCircle2 size={16} />允许本地检索</button></div>
    </section> : <>
      <section className="knowledge-query" aria-labelledby="knowledge-query-title">
        <div className="knowledge-query-heading"><div><span className="eyebrow">本地问答</span><h2 id="knowledge-query-title">从已有资料中找答案</h2></div><button className="text-button" type="button" onClick={onClearLocalAuthorization}>撤销本地检索授权</button></div>
        <label className="sr-only" htmlFor="knowledge-question">你的问题</label>
        <textarea id="knowledge-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：我今天要做什么？有哪些比赛截止日期？" rows={3} />
        <div className="knowledge-actions"><button className="primary-button" type="button" onClick={askLocally} disabled={!question.trim() || loading}><Search size={16} />本地查找</button><button className="secondary-button" type="button" onClick={prepareCloud} disabled={!question.trim() || loading || !deepSeekConfigured}><Sparkles size={16} />使用 DeepSeek 回答</button></div>
        {!deepSeekConfigured && <p className="configuration-note"><Cloud size={15} />DeepSeek 尚未连接。真实调用需要服务端配置密钥；API Key 不会进入浏览器或项目仓库。</p>}
      </section>
      {loading && <section className="knowledge-loading" role="status"><LoaderCircle className="spin" size={18} />正在检索已授权资料…</section>}
      {error && <section className="knowledge-error" role="alert">{error}</section>}
      {answer && <section className="knowledge-answer" aria-live="polite"><div className="answer-heading"><div><span className="eyebrow">{answer.source === 'cloud' ? '经 DeepSeek 服务端代理生成' : '本地检索结果'}</span><h2>回答</h2></div><BookOpenCheck size={22} aria-hidden="true" /></div><p className="answer-copy">{answer.text}</p><div className="citation-section"><h3>引用依据</h3>{answer.citations.length ? <ul>{answer.citations.map((citation) => <li key={citation.id}><span>{citation.kind}</span><div><strong>{citation.title}</strong><p>{citation.excerpt}</p></div></li>)}</ul> : <p className="muted-copy">没有匹配引用，因此没有生成未被资料支持的结论。</p>}</div></section>}
    </>}

    <section className="obsidian-export" aria-labelledby="obsidian-export-title">
      <div><span className="eyebrow">Obsidian 兼容 Markdown</span><h2 id="obsidian-export-title">导出本地知识库</h2><p>选择任务后导出相关项目、来源、材料和历史，生成标签与 <code>[[内部链接]]</code>。这是静态快照，不会自动同步。</p></div>
      <div className="export-selection"><div className="export-selection-head"><strong>选择任务（{selectedTaskIds.size}/{tasks.length}）</strong><span><button type="button" className="text-button" onClick={() => setSelectedTaskIds(new Set(tasks.map((task) => task.id)))}>全选</button><button type="button" className="text-button" onClick={() => setSelectedTaskIds(new Set())}>清空</button></span></div>{tasks.length ? <div className="export-task-list">{tasks.map((task) => <label key={task.id}><input type="checkbox" checked={selectedTaskIds.has(task.id)} onChange={() => setSelectedTaskIds((current) => { const next = new Set(current); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next })} />{task.title}</label>)}</div> : <p className="muted-copy">还没有可导出的确认任务。</p>}</div>
      <div className="obsidian-actions"><button className="secondary-button" type="button" disabled={!selectedTasks.length} onClick={() => { downloadObsidianZip(vault); setExportMessage(`已下载包含 ${vault.length} 个 Markdown 文件的 ZIP。`) }}><Download size={16} />下载 ZIP</button><button className="primary-button" type="button" disabled={!selectedTasks.length} onClick={() => void chooseFolder()}><FolderOpen size={16} />选择文件夹导出</button></div>
      {exportMessage && <p className="workspace-control-message" role="status">{exportMessage}</p>}
    </section>

    {cloudDialogOpen && <div className="modal-backdrop knowledge-dialog-backdrop" role="presentation"><section ref={cloudDialogRef} className="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-confirm-title"><span className="eyebrow">每次云端问答确认</span><h2 id="cloud-confirm-title">确认发送范围</h2><p>本次只会发送问题和本地命中的最多 4 条引用摘要到你配置的 DeepSeek 服务端代理，不会发送整个工作区。</p><label className="cloud-acknowledgement"><input type="checkbox" checked={cloudAcknowledged} onChange={(event) => setCloudAcknowledged(event.target.checked)} />我已了解本次发送范围并同意。</label><div className="panel-actions"><button ref={cloudCancelRef} className="secondary-button" type="button" onClick={() => setCloudDialogOpen(false)}>取消</button><button className="primary-button" type="button" disabled={!cloudAcknowledged} onClick={() => void askCloud()}>确认并发送</button></div></section></div>}
  </main>
}
