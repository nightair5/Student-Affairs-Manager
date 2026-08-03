import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface PageLoadBoundaryProps {
  children: ReactNode
  onRetry: () => void
}

interface PageLoadBoundaryState {
  failed: boolean
}

export class PageLoadBoundary extends Component<PageLoadBoundaryProps, PageLoadBoundaryState> {
  state: PageLoadBoundaryState = { failed: false }

  static getDerivedStateFromError(): PageLoadBoundaryState {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="page page-load-error" role="alert">
        <AlertTriangle size={28} aria-hidden="true" />
        <div>
          <span className="eyebrow">页面资源没有完整载入</span>
          <h1>这次打开没有成功</h1>
          <p>网络波动或刚刚发布新版本时，旧页面可能暂时找不到新的模块。你的本机数据不会因此丢失。</p>
          <button className="primary-button" type="button" onClick={this.props.onRetry}>
            <RefreshCw size={16} aria-hidden="true" />重新加载应用
          </button>
        </div>
      </main>
    )
  }
}
