import { AlertTriangle, ExternalLink, File, FileImage, Link2, MessageSquareText } from 'lucide-react'
import type { Source } from '../types'

interface LibraryPageProps {
  sources: Source[]
  onMarkIndependent: (sourceId: string) => void
}

const typeIcon = { text: MessageSquareText, file: File, image: FileImage, link: Link2 }
const typeLabel = { text: '消息', file: '文件', image: '图片', link: '网页' }

export function LibraryPage({ sources, onMarkIndependent }: LibraryPageProps) {
  return <main className="page">
    <header className="page-header"><div><span className="eyebrow">来源与依据</span><h1>文件库</h1><p>每个任务都能回到最初的通知；重复检测只给建议，不会自动合并或删除。</p></div></header>
    <div className="library-list">
      <div className="library-list-head"><span>来源</span><span>原文摘要</span><span>识别状态</span><span /></div>
      {sources.map((source) => {
        const Icon = typeIcon[source.type]
        const duplicates = (source.duplicateOfSourceIds ?? []).map((id) => sources.find((candidate) => candidate.id === id)).filter((candidate): candidate is Source => Boolean(candidate))
        return <article className="source-row" key={source.id}>
          <div className="source-title"><span className="source-icon"><Icon size={19} /></span><span><strong>{source.title}</strong><small>{typeLabel[source.type]} · {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(source.createdAt))}</small></span></div>
          <div className="source-preview"><p>{source.contentPreview}</p>{duplicates.length > 0 && source.duplicateReviewStatus === '待核对' && <div className="duplicate-notice"><AlertTriangle size={15} /><span>可能与“{duplicates[0].title}”重复；请人工核对。</span><button type="button" onClick={() => onMarkIndependent(source.id)}>保留为独立来源</button></div>}{source.duplicateReviewStatus === '保留为独立来源' && <small className="reviewed-note">已人工标记为独立来源</small>}</div>
          <span className={source.extractionStatus === '已识别' ? 'status-badge' : 'status-badge warning'}>{source.extractionStatus}</span>
          <button className="icon-button" type="button" aria-label={`查看来源 ${source.title}`}><ExternalLink size={17} /></button>
        </article>
      })}
    </div>
  </main>
}
