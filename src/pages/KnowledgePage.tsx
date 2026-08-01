import { BookOpenCheck, CheckCircle2, Cloud, Download, FileOutput, FolderOpen, LoaderCircle, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ProxyDeepSeekService } from '../lib/deepseek'
import { answerLocally, buildKnowledgeDocuments, type KnowledgeCitation } from '../lib/knowledge'
import { buildObsidianVault, downloadMarkdownFiles, writeObsidianFolder } from '../lib/obsidian'
import type { Project, Source, Task } from '../types'

interface KnowledgePageProps {
  tasks: Task[]
  sources: Source[]
  projects: Project[]
  localSearchAuthorizedAt?: string
  onSaveLocalAuthorization: () => void
}

const deepSeekService = new ProxyDeepSeekService()

export function KnowledgePage({ tasks, sources, projects, localSearchAuthorizedAt, onSaveLocalAuthorization }: KnowledgePageProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<{ text: string; citations: KnowledgeCitation[]; source: 'local' | 'cloud' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [requestCloudConfirmation, setRequestCloudConfirmation] = useState(false)
  const [cloudAcknowledged, setCloudAcknowledged] = useState(false)
  const [deepSeekConfigured, setDeepSeekConfigured] = useState(false)
  const [configurationChecked, setConfigurationChecked] = useState(false)
  const cloudCancelRef = useRef<HTMLButtonElement>(null)
  const [exportMessage, setExportMessage] = useState('')
  const documents = useMemo(() => buildKnowledgeDocuments(tasks, sources, projects), [projects, sources, tasks])
  const vault = useMemo(() => buildObsidianVault(tasks, sources, projects), [projects, sources, tasks])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRequestCloudConfirmation(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  useEffect(() => {
    if (requestCloudConfirmation) cloudCancelRef.current?.focus()
  }, [requestCloudConfirmation])

  useEffect(() => {
    let active = true
    void deepSeekService.status().then((status) => {
      if (active) {
        setDeepSeekConfigured(status.configured)
        setConfigurationChecked(true)
      }
    })
    return () => { active = false }
  }, [])

  const askLocally = () => {
    if (!localSearchAuthorizedAt || !question.trim()) return
    setLoading(true)
    setError('')
    window.setTimeout(() => {
      const result = answerLocally(question, documents)
      setAnswer({ text: result.answer, citations: result.citations, source: 'local' })
      setLoading(false)
    }, 180)
  }

  const askCloud = async () => {
    if (!cloudAcknowledged) return
    setRequestCloudConfirmation(false)
    setLoading(true)
    setError('')
    try {
      const local = answerLocally(question, documents)
      const response = await deepSeekService.ask({
        question,
        context: local.citations.map((citation) => ({ title: citation.title, kind: citation.kind, excerpt: citation.excerpt })),
      })
      setAnswer({ text: response.answer, citations: response.citations?.length ? response.citations : local.citations, source: 'cloud' })
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
      setExportMessage('当前浏览器不支持选择文件夹。可使用“下载 Markdown”保存，再手动放入 Obsidian 仓库。')
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
      <div><span className="eyebrow">P1 · 本地资料检索</span><h1>知识问答</h1><p>只检索你已保存且明确授权的本地工作区资料。每个回答都带有可回看的任务或来源引用。</p></div>
      <div className={deepSeekConfigured ? 'connection-state connected' : 'connection-state'}><Cloud size={18} /><span>{configurationChecked && deepSeekConfigured ? 'DeepSeek 代理已配置' : 'DeepSeek 尚未连接'}</span></div>
    </header>

    {!localSearchAuthorizedAt ? <section className="knowledge-consent" aria-labelledby="knowledge-consent-title">
      <ShieldCheck size={24} aria-hidden="true" />
      <div><span className="eyebrow">需要本地授权</span><h2 id="knowledge-consent-title">允许本地检索读取此工作区</h2><p>授权后，问答仅在当前浏览器中读取已保存的任务、项目、已关联来源摘要、材料和修改历史。不会发送到外部服务，也不代表跨设备同步。</p><button className="primary-button" type="button" onClick={onSaveLocalAuthorization}><CheckCircle2 size={16} />允许本地检索</button></div>
    </section> : <>
      <section className="knowledge-query" aria-labelledby="knowledge-query-title">
        <div className="knowledge-query-heading"><div><span className="eyebrow">本地问答</span><h2 id="knowledge-query-title">从已有资料中找答案</h2></div><span className="authorized-label"><ShieldCheck size={14} />本地授权已保存</span></div>
        <label className="sr-only" htmlFor="knowledge-question">你的问题</label>
        <textarea id="knowledge-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：我今天要做什么？有哪些比赛截止日期？" rows={3} />
        <div className="knowledge-actions"><button className="primary-button" type="button" onClick={askLocally} disabled={!question.trim() || loading}><Search size={16} />本地查找</button><button className="secondary-button" type="button" onClick={() => setRequestCloudConfirmation(true)} disabled={!question.trim() || loading || !deepSeekConfigured}><Sparkles size={16} />使用 DeepSeek 回答</button></div>
        {!deepSeekConfigured && <p className="configuration-note"><Cloud size={15} />DeepSeek 尚未连接。真实调用需要同源本机代理进程保存密钥；浏览器只请求 <code>/api/deepseek</code>，API Key 绝不能放入 React/Vite 前端。</p>}
      </section>

      {loading && <section className="knowledge-loading" role="status"><LoaderCircle className="spin" size={18} />正在检索已授权资料…</section>}
      {error && <section className="knowledge-error" role="alert">{error}</section>}
      {answer && <section className="knowledge-answer" aria-live="polite"><div className="answer-heading"><div><span className="eyebrow">{answer.source === 'cloud' ? '经 DeepSeek 代理生成' : '本地检索结果'}</span><h2>回答</h2></div><BookOpenCheck size={22} aria-hidden="true" /></div><p>{answer.text}</p><div className="citation-section"><h3>引用依据</h3>{answer.citations.length ? <ul>{answer.citations.map((citation) => <li key={citation.id}><span>{citation.kind}</span><div><strong>{citation.title}</strong><p>{citation.excerpt}</p></div></li>)}</ul> : <p className="muted-copy">没有匹配引用，因此未给出未被资料支持的结论。</p>}</div></section>}
    </>}

    <section className="obsidian-export" aria-labelledby="obsidian-export-title">
      <div><span className="eyebrow">Obsidian 兼容 Markdown</span><h2 id="obsidian-export-title">导出本地知识库</h2><p>导出任务、项目、来源摘要、材料与修改历史，并生成日期、标签及 <code>[[内部链接]]</code>。浏览器不会自动写入或同步你的 Obsidian 文件夹。</p></div>
      <div className="obsidian-actions"><button className="secondary-button" type="button" onClick={() => { downloadMarkdownFiles(vault); setExportMessage(`已开始下载 ${vault.length} 个 Markdown 文件；请手动放入 Obsidian 仓库。`) }}><Download size={16} />下载 Markdown</button><button className="primary-button" type="button" onClick={() => void chooseFolder()}><FolderOpen size={16} />选择文件夹导出</button></div>
      {exportMessage && <p className="workspace-control-message" role="status"><FileOutput size={14} />{exportMessage}</p>}
    </section>

    {requestCloudConfirmation && <div className="modal-backdrop knowledge-dialog-backdrop" role="presentation"><section className="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-confirm-title"><span className="eyebrow">首次云端问答确认</span><h2 id="cloud-confirm-title">确认发送范围</h2><p>本次会发送你的问题，以及本地检索命中的最多 4 条引用摘要（任务、来源、材料或历史片段）到你配置的 DeepSeek 安全代理。不会发送整个 IndexedDB 工作区。</p><label className="cloud-acknowledgement"><input type="checkbox" checked={cloudAcknowledged} onChange={(event) => setCloudAcknowledged(event.target.checked)} />我已了解本次发送的数据范围，并同意使用已配置的代理。</label><div className="panel-actions"><button ref={cloudCancelRef} className="secondary-button" type="button" onClick={() => setRequestCloudConfirmation(false)}>取消</button><button className="primary-button" type="button" disabled={!cloudAcknowledged} onClick={() => void askCloud()}>确认并发送</button></div></section></div>}
  </main>
}
