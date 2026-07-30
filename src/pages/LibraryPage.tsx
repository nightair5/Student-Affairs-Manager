import {
  ExternalLink,
  File,
  FileImage,
  Link2,
  MessageSquareText,
} from 'lucide-react'
import type { Source } from '../types'

interface LibraryPageProps {
  sources: Source[]
}

const typeIcon = {
  text: MessageSquareText,
  file: File,
  image: FileImage,
  link: Link2,
}

const typeLabel = {
  text: '消息',
  file: '文件',
  image: '图片',
  link: '网页',
}

export function LibraryPage({ sources }: LibraryPageProps) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">来源与依据</span>
          <h1>文件库</h1>
          <p>每个任务都能回到最初的通知，不让“系统说”代替“原文说”。</p>
        </div>
      </header>

      <div className="library-list">
        <div className="library-list-head">
          <span>来源</span>
          <span>原文摘要</span>
          <span>识别状态</span>
          <span />
        </div>
        {sources.map((source) => {
          const Icon = typeIcon[source.type]
          return (
            <article className="source-row" key={source.id}>
              <div className="source-title">
                <span className="source-icon">
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{source.title}</strong>
                  <small>
                    {typeLabel[source.type]} ·{' '}
                    {new Intl.DateTimeFormat('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(source.createdAt))}
                  </small>
                </span>
              </div>
              <p>{source.contentPreview}</p>
              <span
                className={
                  source.extractionStatus === '已识别'
                    ? 'status-badge'
                    : 'status-badge warning'
                }
              >
                {source.extractionStatus}
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label={`查看来源 ${source.title}`}
              >
                <ExternalLink size={17} />
              </button>
            </article>
          )
        })}
      </div>
    </main>
  )
}
