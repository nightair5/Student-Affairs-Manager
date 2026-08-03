import { CalendarPlus, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { buildCalendarIcs, buildTodoIcs, shareOrDownloadIcs } from '../lib/calendarExport'
import { ProxyDeepSeekService } from '../lib/deepseek'
import { buildActivityReport, buildReportContext, downloadReportFile, type ReportPeriod } from '../lib/reports'
import type { Project, Task } from '../types'

interface ReportsPageProps {
  tasks: Task[]
  projects: Project[]
}

const deepSeek = new ProxyDeepSeekService()

function inputDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function ReportsPage({ tasks, projects }: ReportsPageProps) {
  const [period, setPeriod] = useState<ReportPeriod>('week')
  const [referenceDate, setReferenceDate] = useState(() => inputDate(new Date()))
  const [deepSeekConfigured, setDeepSeekConfigured] = useState(false)
  const [cloudConsent, setCloudConsent] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const report = useMemo(
    () => buildActivityReport(tasks, projects, period, new Date(`${referenceDate}T12:00:00`)),
    [period, projects, referenceDate, tasks],
  )
  const context = useMemo(() => buildReportContext(report), [report])
  const reportName = period === 'week' ? '周报' : '月报'

  useEffect(() => {
    let active = true
    void deepSeek.status().then((status) => { if (active) setDeepSeekConfigured(status.configured) })
    return () => { active = false }
  }, [])

  const resetGeneratedReport = () => {
    setAiSummary('')
    setCloudConsent(false)
    setMessage('')
  }

  const askDeepSeek = async () => {
    if (!cloudConsent || !deepSeekConfigured) return
    setLoading(true)
    setMessage('')
    try {
      const result = await deepSeek.ask({
        question: `请仅根据引用，为 ${report.range.label} 生成一份简洁的学生事务${reportName}：总结完成情况、风险、下期三项行动。不要编造引用外事实。`,
        context,
      })
      setAiSummary(result.answer)
      setMessage(`DeepSeek 已依据 4 条本地汇总生成${reportName}草稿，请核对后再导出。`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'DeepSeek 暂时无法生成报告。')
    } finally {
      setLoading(false)
      setCloudConsent(false)
    }
  }

  const markdown = aiSummary
    ? `${report.markdown}\n## DeepSeek 整理建议\n\n${aiSummary}\n\n> 此段由 DeepSeek 基于页面所列 4 条汇总生成，已确认任务未被修改。\n`
    : report.markdown
  const dateSlug = inputDate(report.range.start)

  const exportCalendar = async (kind: 'calendar' | 'todo') => {
    try {
      const openTasks = tasks.filter((task) => task.status !== '已完成')
      const result = await shareOrDownloadIcs(
        `学生事务-${kind === 'calendar' ? '日历提醒' : '待办'}-${dateSlug}.ics`,
        kind === 'calendar' ? buildCalendarIcs(openTasks) : buildTodoIcs(openTasks),
      )
      setMessage(result === 'shared' ? '已打开手机系统分享，请选择日历或待办应用。' : '已下载 ICS，请在手机日历或待办应用中导入。')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setMessage('系统分享或下载失败，请检查浏览器的下载权限。')
    }
  }

  return <main className="page reports-page">
    <header className="page-header">
      <div><span className="eyebrow">复盘与跨端提醒</span><h1>周报与月报</h1><p>先由本机数据生成可核对报告；可选用 DeepSeek 整理表达，再导出文档、表格、日历或待办。</p></div>
    </header>

    <section className="report-controls" aria-label="报告范围">
      <div className="segmented-control">
        <button type="button" className={period === 'week' ? 'active' : ''} onClick={() => { setPeriod('week'); resetGeneratedReport() }}>周报</button>
        <button type="button" className={period === 'month' ? 'active' : ''} onClick={() => { setPeriod('month'); resetGeneratedReport() }}>月报</button>
      </div>
      <label><span>选择范围内的日期</span><input type="date" value={referenceDate} onChange={(event) => { setReferenceDate(event.target.value); resetGeneratedReport() }} /></label>
      <strong>{report.range.label}</strong>
    </section>

    <section className="report-metrics" aria-label="报告概览">
      <article><span>完成</span><strong>{report.completed.length}</strong><small>本期完成记录</small></article>
      <article><span>到期</span><strong>{report.due.length}</strong><small>范围内截止</small></article>
      <article className={report.overdue.length ? 'risk' : ''}><span>逾期</span><strong>{report.overdue.length}</strong><small>当前需补救</small></article>
      <article><span>完成率</span><strong>{report.completionRate}%</strong><small>本期到期事项</small></article>
    </section>

    <div className="report-layout">
      <section className="report-preview" aria-labelledby="report-preview-title">
        <div className="report-section-heading"><div><span className="eyebrow">本机生成</span><h2 id="report-preview-title">{reportName}预览</h2></div><CheckCircle2 size={22} /></div>
        <div className="report-category-table"><span>分类</span><span>事项数</span>{report.categoryCounts.map((item) => <div key={item.category}><strong>{item.category}</strong><span>{item.count}</span></div>)}</div>
        <h3>已完成</h3>
        {report.completed.length ? <ul>{report.completed.slice(0, 8).map((task) => <li key={task.id}>{task.title}</li>)}</ul> : <p className="muted-copy">本期还没有完成记录。</p>}
        <h3>当前逾期</h3>
        {report.overdue.length ? <ul>{report.overdue.slice(0, 8).map((task) => <li key={task.id}><strong>{task.title}</strong><span>{task.nextAction}</span></li>)}</ul> : <p className="muted-copy">当前没有逾期事项。</p>}
        {aiSummary && <div className="ai-report-copy"><span className="eyebrow">DeepSeek 整理草稿</span><p>{aiSummary}</p></div>}
      </section>

      <aside className="report-actions">
        <section>
          <span className="eyebrow">可选云端整理</span><h2>用 DeepSeek 写复盘</h2>
          <p>只发送右侧列出的 4 条聚合摘要：统计、完成事项标题、截止事项标题、逾期与下一步；不发送来源全文、文件或整个工作区。</p>
          <label className="link-authorization"><input type="checkbox" checked={cloudConsent} onChange={(event) => setCloudConsent(event.target.checked)} /><span>我确认本次发送范围，并同意生成一份可编辑草稿。</span></label>
          <button className="primary-button wide" type="button" disabled={!deepSeekConfigured || !cloudConsent || loading} onClick={() => void askDeepSeek()}>{loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{loading ? '正在整理…' : `生成${reportName}草稿`}</button>
          {!deepSeekConfigured && <small className="configuration-note">DeepSeek 服务端未连接，本机报告与导出仍可使用。</small>}
        </section>
        <section>
          <span className="eyebrow">文档与表格</span><h2>导出报告</h2>
          <div className="stacked-actions"><button className="secondary-button wide" type="button" onClick={() => downloadReportFile(`学生事务${reportName}-${dateSlug}.md`, markdown, 'text/markdown')}><Download size={16} />导出 Markdown 文档</button><button className="secondary-button wide" type="button" onClick={() => downloadReportFile(`学生事务${reportName}-${dateSlug}.csv`, `\uFEFF${report.csv}`, 'text/csv')}><FileSpreadsheet size={16} />导出 CSV 表格</button></div>
        </section>
        <section>
          <span className="eyebrow">手机系统导入</span><h2>日历与待办</h2>
          <p>网页不能静默写入原生闹钟。这里生成标准 ICS，通过系统分享或下载后，由你选择手机日历/待办应用并确认导入。</p>
          <div className="stacked-actions"><button className="secondary-button wide" type="button" onClick={() => void exportCalendar('calendar')}><CalendarPlus size={16} />导出日历与提醒</button><button className="secondary-button wide" type="button" onClick={() => void exportCalendar('todo')}><CheckCircle2 size={16} />导出手机待办</button></div>
        </section>
      </aside>
    </div>
    {message && <div className="workspace-control-message" role="status">{message}</div>}
  </main>
}
