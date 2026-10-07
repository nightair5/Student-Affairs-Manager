import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, LockKeyhole } from 'lucide-react'
import type { CanonicalWorkspaceRepository, WorkspaceRecordStore } from '../domain/v2/repository'
import type { WorkspaceV8 } from '../domain/v2/types'
import { acknowledgePersonalPlan, applyPersonalPlan, buildPersonalPlan, defaultPlanOptions, pendingPersonalPlan, PLAN_UNDO, planBaseline, planLocalValue, storedPersonalPlans, undoPersonalPlan, validatePlanOptions, verifyPersonalPlan, type PlanOptions, type PlanProposal, type PlanReceipt } from '../domain/v2/personalPlanD27'
import { createPlanMeasurement } from '../domain/v2/planMeasurementD27'
import './PersonalPlanPanel.css'

const errors: Record<string, string> = {
  PERSONAL_PLAN_INPUTS_CHANGED: '与安排有关的任务、原文版本或活动已经改变。你的调整仍在；请重新读取最新内容，再核对差异。',
  PERSONAL_PLAN_UNDO_INPUTS_CHANGED: '安排后又有相关内容变化，不能直接撤回；请基于最新内容重新安排。',
  PERSONAL_PLAN_READBACK_PENDING: '有一笔已提交安排还未验证。先重新读回，不能重复提交。',
  PERSONAL_PLAN_OPTIONS_INVALID: '请检查可用时段、日期与耗时：最多14天，每项5—480分钟，结束须晚于开始。',
  PERSONAL_PLAN_NOTHING_TO_APPLY: '没有可以新保存的安排；已锁定的安排继续保留。',
  PERSONAL_PLAN_ELAPSED_SLOT: '预览中的开工时间已经过去。这次没有保存；请重新读取并核对，生成现在可用的时段。',
}
const message = (e: unknown) => { const text = e instanceof Error ? e.message : '保存失败'; return errors[text] ?? `操作未完成：${text}。输入仍在，可手动恢复。` }
function timeLabel(value: string, timezone: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) }
const durationLabel = { user: '你的估计', recorded_estimate: '已存估计', product_estimate: '产品暂估，可改' }
export function PersonalPlanPanel({ workspace, repository, reader, store, onReload }: { workspace: WorkspaceV8; repository: CanonicalWorkspaceRepository; reader: CanonicalWorkspaceRepository; store: WorkspaceRecordStore; onReload: () => Promise<void> }) {
  const measurement = useMemo(() => createPlanMeasurement(store), [store])
  const [options, setOptions] = useState<PlanOptions>(() => defaultPlanOptions(new Date(), workspace.settings.defaultTimezone))
  const original = useRef(options), edits = useRef<Record<string, string>>({})
  const [ready, setReady] = useState(false), [problem, setProblem] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [unsaved, setUnsaved] = useState(false), [report, setReport] = useState('')
  const [localReceipt, setReceipt] = useState<PlanReceipt | null>(null)
  const receipt = pendingPersonalPlan(workspace) ?? localReceipt
  const lock = useRef(false), idle = useRef<ReturnType<typeof setTimeout>>()
  const baseline = planBaseline(workspace), stored = storedPersonalPlans(workspace)
  const [editing, setEditing] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [conflict, setConflict] = useState<{ name: string; before: string; latest: string; mine: string }[]>([])
  const measuring = useRef(false)
  const track = (kind: Parameters<typeof measurement.append>[0]) => { if (measuring.current) void measurement.append(kind).catch(() => setUnsaved(true)) }
  useEffect(() => {
    let live = true
    void measurement.restore().then(saved => {
      if (!live) return
      if (saved?.version === 'personal-plan-measurement-d27-1') {
        validatePlanOptions(saved.options); setOptions(saved.options); edits.current = saved.editIds; original.current = saved.initialOptions ?? saved.options
        setNotice(Object.keys(saved.editIds).length
          ? '上次未确认的安排调整已恢复；请查看当前结果后接受。'
          : '可用时间与估计已恢复。已保存安排仍保留；下面是可再次调整的方案。')
      }
      setReady(true)
    }).catch(e => { if (live) { setProblem(message(e)); setReady(true) } })
    return () => { live = false }
  }, [measurement])
  // Derived preview follows confirmed facts and user options, without cascading state updates.
  const generated = useMemo((): { proposal: PlanProposal | null; error: string } => {
    if (!ready) return { proposal: null, error: '' }
    try { return { proposal: buildPersonalPlan(workspace, options), error: '' } } catch (e) { return { proposal: null, error: message(e) } }
  }, [workspace, options, ready])
  const proposal = generated.proposal
  useEffect(() => {
    if (!started) return
    const visibility = () => track(document.hidden ? 'hidden' : 'read')
    document.addEventListener('visibilitychange', visibility)
    return () => { document.removeEventListener('visibilitychange', visibility); if (idle.current) clearTimeout(idle.current) }
    // Tracking closure is tied to the same persistent measurement instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurement, started])
  const begin = async () => { if (!measuring.current) { measuring.current = true; try { await measurement.begin(); setStarted(true) } catch (e) { measuring.current = false; throw e } } }
  const change = (next: PlanOptions, field: string) => {
    next = { ...next, now: new Date().toISOString() }
    setOptions(next); setUnsaved(true)
    edits.current[field] ??= crypto.randomUUID()
    void begin().then(() => measurement.append('edit', { field, editId: edits.current[field] })).then(() => measurement.checkpoint(next, baseline, { ...edits.current }, original.current)).then(() => setUnsaved(false)).catch(() => setUnsaved(true))
    if (idle.current) clearTimeout(idle.current)
    idle.current = setTimeout(() => track('idle'), 5000)
  }
  const override = (id: string, patch: Partial<PlanOptions['overrides'][string]>, field: string) => change({ ...options, overrides: { ...options.overrides, [id]: { ...options.overrides[id], ...patch } } }, id + ':' + field)
  const changes = () => {
    let n = ['startDate', 'days', 'startTime', 'endTime', 'estimateMinutes'].filter(k => options[k as keyof PlanOptions] !== original.current[k as keyof PlanOptions]).length
    for (const [id, value] of Object.entries(options.overrides)) for (const [field, after] of Object.entries(value)) if (after !== original.current.overrides[id]?.[field as keyof typeof value]) n++
    return n
  }
  const readback = async (r: PlanReceipt) => { const read = await verifyPersonalPlan(reader, r); await measurement.append('readback', { commitId: r.commitId }); await acknowledgePersonalPlan(repository, r); setReceipt(null); await onReload(); await measurement.close(); measuring.current = false; setStarted(false); original.current = structuredClone(options); edits.current = {}; await measurement.checkpoint(options, planBaseline(read), {}, options).catch(() => setUnsaved(true)); setNotice(r.kind === 'undo' ? '已撤回上次个人安排并独立读回；任务和原文截止未改变。' : '安排已正式保存并独立读回。原文截止没有变化。') }
  const execute = async (kind: 'apply' | 'read' | 'undo') => {
    if (lock.current) return
    lock.current = true; setBusy(true); setProblem('')
    let committed = kind === 'read' ? receipt : null
    try {
      await begin(); if (idle.current) clearTimeout(idle.current); await measurement.append('wait')
      if (kind === 'apply') { if (!proposal) throw Error('PERSONAL_PLAN_PROPOSAL_INVALID'); committed = await applyPersonalPlan(repository, proposal) }
      if (kind === 'undo') { const last = workspace.preferences.legacyData?.[PLAN_UNDO] as unknown as PlanReceipt; committed = await undoPersonalPlan(repository, last.commitId) }
      if (!committed) throw Error('PERSONAL_PLAN_RECEIPT_MISSING')
      setReceipt(committed); await measurement.commit(committed, kind === 'read' ? undefined : changes()); await readback(committed)
    } catch (e) {
      if (committed) setNotice('已提交，独立读回尚未验证。下面的恢复只重新读取，不会重复正式提交。')
      if (e instanceof Error && e.message === 'PERSONAL_PLAN_INPUTS_CHANGED') {
        const latest = await repository.load().catch(() => null)
        if (latest && proposal) {
          const previous = JSON.parse(proposal.baseline) as { tasks: Array<{ id: string; title: string; snoozedUntil: string | null; status: string; dependencyIds: string[]; estimatedMinutes: number | null }> }
          const labels = { todo: '待执行', in_progress: '进行中', completed: '已完成', cancelled: '已取消' }
          const values = previous.tasks.flatMap(before => {
            const current = latest.tasks.find(t => t.id === before.id), segment = proposal.segments.find(s => s.taskId === before.id)
            if (!current) return [{ name: before.title, before: '原先存在', latest: '事项已移除', mine: segment ? timeLabel(segment.start, workspace.settings.defaultTimezone) : '暂未排入' }]
            const changes: string[] = []
            if (current.status !== before.status) changes.push(`状态：${labels[current.status]}`)
            if (current.snoozedUntil !== before.snoozedUntil) changes.push(`稍后至：${current.snoozedUntil ? timeLabel(current.snoozedUntil, latest.settings.defaultTimezone) : '未设置'}`)
            if (JSON.stringify([...current.dependencyIds].sort()) !== JSON.stringify(before.dependencyIds)) changes.push('前置事项已改变')
            if (current.estimatedMinutes !== before.estimatedMinutes) changes.push(`估计耗时：${current.estimatedMinutes ?? '未知'}分钟`)
            if (current.title !== before.title) changes.push(`事项内容：${current.title}`)
            return changes.length ? [{ name: before.title, before: `状态：${labels[before.status as keyof typeof labels]}；稍后时间：${before.snoozedUntil ? timeLabel(before.snoozedUntil, latest.settings.defaultTimezone) : '未设置'}`, latest: changes.join('；'), mine: segment ? `${timeLabel(segment.start, latest.settings.defaultTimezone)}，${segment.minutes}分钟` : '暂未排入' }] : []
          })
          setConflict(values.length ? values : [{ name: '相关来源、时间或课程', before: '本次预览所读取的版本', latest: '当前存储的版本已经不同', mine: '安排输入仍保留；重读后须重新核对' }])
        }
      }
      setProblem(message(e)); await measurement.append('failure', { reason: e instanceof Error ? e.message : 'UNKNOWN' }).catch(() => setUnsaved(true))
    } finally { setBusy(false); lock.current = false }
  }
  const last = workspace.preferences.legacyData?.[PLAN_UNDO]
  return <section className="personal-plan" aria-labelledby="personal-plan-title">
    <div className="section-heading"><div><span className="section-index">PLAN</span><h2 id="personal-plan-title"><CalendarClock size={22} /> 今日与近期安排</h2><p>原文截止保留；以下时段是可修改、可撤回的个人建议。</p></div></div>
    <details onToggle={e => { if (e.currentTarget.open) void begin().catch(() => setUnsaved(true)) }}>
      <summary>可用时间与估计 · {options.startTime}—{options.endTime} · {options.days}天</summary>
      <p>尚未录入偏好时，先预览下列假设；接受安排表示采用本次时段。仅依据本机已记录行程。已接受的个人耗时保留，默认暂估只用于尚无个人耗时的事项。</p>
      <div className="plan-options" onBlur={() => { if (started) track('read') }}>
        <label>安排从哪天开始<input type="date" value={options.startDate} onChange={e => change({ ...options, startDate: e.target.value }, 'window:date')} /></label>
        <label>安排几天<input type="number" min={1} max={14} value={options.days} onChange={e => change({ ...options, days: Number(e.target.value) }, 'window:days')} /></label>
        <label>每天可用开始<input type="time" value={options.startTime} onChange={e => change({ ...options, startTime: e.target.value }, 'window:start')} /></label>
        <label>每天可用结束<input type="time" value={options.endTime} onChange={e => change({ ...options, endTime: e.target.value }, 'window:end')} /></label>
        <label>未知耗时暂估分钟<input type="number" min={5} max={480} disabled={options.estimateMinutes === null} value={options.estimateMinutes ?? 30} onChange={e => change({ ...options, estimateMinutes: Number(e.target.value) }, 'estimate')} /></label>
        <label><input type="checkbox" checked={options.estimateMinutes !== null} onChange={e => change({ ...options, estimateMinutes: e.target.checked ? 30 : null }, 'estimate')} />允许采用明确标注的耗时估计</label>
      </div>
    </details>
    {stored.length > 0 && <details open><summary>已保存安排 · {stored.length}项</summary><ul className="plan-list">{stored.map(s => <li key={s.taskId}><strong>{s.title}</strong><span>{timeLabel(s.start, workspace.settings.defaultTimezone)}—{timeLabel(s.end, workspace.settings.defaultTimezone)} · {s.minutes}分钟 · {durationLabel[s.durationOrigin]} {s.locked && <><LockKeyhole size={14} />已锁定</>}</span><small>原文截止：{s.originalDeadline ?? '未说明'}</small>{s.conditionalOn.length > 0 && <small>须实际完成前置事项才能开始，安排在后不代表已完成。</small>}</li>)}</ul></details>}
    {proposal && <><h3>待接受方案 · {proposal.segments.length}项时段</h3><ul className="plan-list">{proposal.segments.map(s => <li key={s.taskId}>
      <strong>{s.title}</strong><span>{timeLabel(s.start, workspace.settings.defaultTimezone)}—{timeLabel(s.end, workspace.settings.defaultTimezone)} · {s.minutes}分钟 · {durationLabel[s.durationOrigin]}</span><small>原文截止：{s.originalDeadline ?? '未说明'}。{s.reason}</small>
      <div><button type="button" className="text-button" onClick={() => { void begin(); setEditing(editing === s.taskId ? null : s.taskId) }}>调整安排</button><label><input type="checkbox" checked={s.locked} onChange={e => override(s.taskId, { locked: e.target.checked }, 'lock')} />保留并锁定</label><button type="button" className="text-button" disabled={s.locked} onClick={() => override(s.taskId, { later: true }, 'later')}>以后再安排</button></div>
      {editing === s.taskId && <div className="plan-options" onBlur={() => track('read')}><label>建议开工时间<input type="datetime-local" disabled={s.locked} value={planLocalValue(s.start, workspace.settings.defaultTimezone)} onChange={e => override(s.taskId, { start: e.target.value }, 'start')} /></label><label>个人估计分钟<input type="number" min={5} max={480} disabled={s.locked} value={s.minutes} onChange={e => override(s.taskId, { minutes: Number(e.target.value) }, 'duration')} /></label>{s.locked && <small>先明确取消锁定，才能调整该时段。</small>}</div>}
    </li>)}</ul>{proposal.unscheduled.length > 0 && <details open><summary>未新排入或需要处理 · {proposal.unscheduled.length}项</summary><ul>{proposal.unscheduled.map(s => <li key={s.taskId}><strong>{s.title}</strong>：{s.reason}{options.overrides[s.taskId] && <button type="button" className="text-button" onClick={() => { const next = { ...options.overrides }; delete next[s.taskId]; change({ ...options, overrides: next }, s.taskId + ':reset') }}>撤销该项调整</button>}</li>)}</ul></details>}
      {editing && !proposal.segments.some(s => s.taskId === editing) && <div className="plan-options"><strong>继续调整：{workspace.tasks.find(t => t.id === editing)?.title}</strong><label>建议开工时间<input type="datetime-local" value={options.overrides[editing]?.start ?? ''} onChange={e => override(editing, { start: e.target.value }, 'start')}/></label><label>个人估计分钟<input type="number" min={5} max={480} value={options.overrides[editing]?.minutes ?? workspace.tasks.find(t => t.id === editing)?.estimatedMinutes ?? options.estimateMinutes ?? ''} onChange={e => override(editing, { minutes: Number(e.target.value) }, 'duration')}/></label></div>}
      <details><summary>安排依据与待定点</summary><ul>{proposal.warnings.map(text => <li key={text}>{text}</li>)}</ul><p>未排入的原有非锁定个人时段会在接受新方案时移除；任务和原文事实仍保留。锁定冲突只提示，不静默移动。</p></details>
    </>}
    {unsaved && <p role="status">安排输入尚未确认持久化；留在本页，或手动重试检查点。<button type="button" onClick={() => void measurement.checkpoint(options, baseline, edits.current, original.current).then(() => setUnsaved(false)).catch(() => setUnsaved(true))}>重试保存安排输入</button></p>}
    {(receipt || notice) && <p role="status">{receipt ? '安排已提交，独立读回尚未验证；恢复只重新读取，不会重复正式提交。' : notice}</p>}{(problem || generated.error) && <p className="plan-error" role="alert">{problem || generated.error}</p>}
    {conflict.length > 0 && <div className="plan-conflicts"><p>这次没有覆盖最新事实。请核对变化后，选择“重新读取并核对”；你的安排输入仍会保留。</p><table><thead><tr><th>事项</th><th>编辑前</th><th>最新值</th><th>我的安排</th></tr></thead><tbody>{conflict.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.before}</td><td>{row.latest}</td><td>{row.mine}</td></tr>)}</tbody></table></div>}
    <div className="plan-actions">
      {receipt ? <button className="primary-button" type="button" disabled={busy} onClick={() => void execute('read')}>重新独立读回已提交安排</button> : <button className="primary-button" type="button" disabled={busy || !proposal || !workspace.tasks.length} onClick={() => void execute('apply')}>{busy ? '正在保存安排…' : '接受这份安排'}</button>}
      {!!last && !receipt && <button className="text-button" type="button" disabled={busy} onClick={() => void execute('undo')}>撤回上次安排</button>}
      <button className="text-button" type="button" disabled={busy} onClick={() => void onReload().then(() => { setOptions(current => ({ ...current, now: new Date().toISOString() })); setProblem(''); setConflict([]); setNotice('已重新读取。调整仍保留，请核对新方案后再接受。') }).catch(e => setProblem(message(e)))}>重新读取并核对</button>
    </div>
    <details><summary>本次安排记录与时间</summary><p>这是个人计划工程记录，与首次识别质量、历史measurement3.2及low-edit-v2分开；不计真人指标。</p><button type="button" onClick={() => { track('read'); void measurement.report().then(v => setReport(JSON.stringify(v, null, 2))) }}>查看安排测量记录</button><pre>{report}</pre></details>
  </section>
}
