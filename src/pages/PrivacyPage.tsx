import { CloudOff, Database, Download, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import type { WorkspaceData } from '../types'

interface PrivacyPageProps {
  workspace: WorkspaceData
  onOpenArchive: () => void
  onExportMigrationBackup: () => void
}

export function PrivacyPage({ workspace, onOpenArchive, onExportMigrationBackup }: PrivacyPageProps) {
  return (
    <main className="page privacy-page">
      <header className="page-header">
        <div><span className="eyebrow">透明的数据边界</span><h1>隐私与数据</h1><p>这里说明哪些数据留在本机、何时可能发往云端，以及你可以怎样备份或清空。</p></div>
        <div className="header-stat"><ShieldCheck size={20} /><span><strong>本机优先</strong> 默认策略</span></div>
      </header>

      <section className="privacy-summary" aria-label="当前本机数据摘要">
        <article><Database size={20} /><span><strong>{workspace.sources.length}</strong> 份来源</span><small>当前站点 IndexedDB</small></article>
        <article><Database size={20} /><span><strong>{workspace.tasks.length}</strong> 项任务</span><small>含材料与修改历史</small></article>
        <article><Download size={20} /><span><strong>JSON</strong> 可迁移备份</span><small>由你主动导出</small></article>
      </section>

      <div className="privacy-grid">
        <article><Database size={22} /><div><h2>保存在当前浏览器</h2><p>来源文字、草稿、任务、项目、时间节点、材料、历史、提醒设置和课程表保存在当前域名的 IndexedDB。刷新或关闭后可恢复；换浏览器、设备或域名不会自动出现。</p></div></article>
        <article><EyeOff size={22} /><div><h2>不保存文件本体</h2><p>TXT、Markdown 与 PDF 只在浏览器本机读取。工作区仅保存提取文字、文件名、类型、大小和 SHA-256 指纹；图片、PDF、附件与二进制文件本体不会写入 IndexedDB 或 JSON 备份。</p></div></article>
        <article><KeyRound size={22} /><div><h2>密钥只在服务端</h2><p>DeepSeek 密钥必须存在 Cloudflare Secret 或其他服务端密钥存储中，前端无法读取。智能整理只在你点击后发送当前文字；不发送整个工作区、文件本体或未读取网页。</p></div></article>
        <article><CloudOff size={22} /><div><h2>尚无账号同步</h2><p>当前公开站点没有账号、用户级鉴权或自动跨设备同步。邮件、网页后台监测和微信仍需合法服务配置或平台审批；界面中的未接通状态不代表已经发送、抓取或授权。</p></div></article>
      </div>

      <section className="privacy-actions">
        <div><h2>备份与删除由你决定</h2><p>在项目档案中导出 JSON。Schema 升级前的原始数据会先另存一份，可在此下载；清空前仍建议手动备份。</p></div>
        <button className="secondary-button" type="button" onClick={onExportMigrationBackup}><Download size={17} />导出迁移前备份</button>
        <button className="primary-button" type="button" onClick={onOpenArchive}><Download size={17} />前往备份与清空</button>
      </section>
    </main>
  )
}
