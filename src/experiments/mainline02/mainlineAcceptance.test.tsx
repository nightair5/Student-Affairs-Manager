import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { createMainlineRuntime } from './runtime'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { emptyWorkspace, artificialResponse } from '../mainline01/fixtures'
import { CalendarPage } from '../../pages/CalendarPage'
import { IntakePanel } from '../../components/IntakePanel'
import { TaskCard } from '../../components/TaskCard'
import { demoTasks } from '../../data/demo'
import { calculateTaskPriority } from '../../lib/taskLogic'

describe('MAINLINE-02 actual component entry contract', () => {
  it('renders the actual App from injected empty canonical state without legacy initialization', async () => {
    const name='rco-mainline-01-02-i1-actual-app-ssr'
    const initial=emptyWorkspace(); initial.workspace.id=name
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name})
    const runtime=await createMainlineRuntime({name,store,initialize:initial,recognize:(_,id)=>artificialResponse('no-date',id)})
    const legacy=vi.fn(()=>{throw Error('LEGACY_ACCESS')})
    vi.stubGlobal('localStorage',{getItem:legacy,setItem:legacy})
    try {
      const html=renderToStaticMarkup(<App runtime={runtime}/>)
      expect(html).toContain('人工工程响应')
      expect(html).toContain('生成工程建议')
      expect(html).not.toContain('正在检查智能服务')
      expect(legacy).not.toHaveBeenCalled()
      expect((await runtime.load()).tasks).toHaveLength(0)
    } finally { vi.unstubAllGlobals() }
  })
  it('date-only calendar agenda and day summary do not invent a clock in the explicit experiment', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T08:00:00Z'))
    try {
      const task={...demoTasks[0],deadline:'2026-09-18',status:'待开始' as const,dependencyIds:[],dependencies:[],riskFlags:[]}
      const props={tasks:[task],courseBlocks:[],onOpenTask:()=>{},onAddCourseBlock:()=>{},onRemoveCourseBlock:()=>{}}
      const html=renderToStaticMarkup(<CalendarPage {...props} dateViews={{[task.id]:{kind:'dated',label:'2026-09-18（仅日期）',noDeadlineProven:false,projectedPendingOnly:false}}}/>)
      expect(html).toContain('<span class="agenda-time">仅日期</span>')
      expect(html).not.toMatch(/最早 \d{2}:\d{2}/)
      const ordinary=renderToStaticMarkup(<CalendarPage {...props}/>)
      const oldTime=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(task.deadline))
      expect(ordinary).toContain('<span class="agenda-time">'+oldTime+'</span>')
      expect(ordinary).not.toContain('无截止日期任务')
    } finally { vi.useRealTimers() }
  })
  it('experimental intake accurately labels artificial responses without claiming fallback', () => {
    const html=renderToStaticMarkup(<IntakePanel textOnly onClose={()=>{}} onSubmitIntake={async()=>{}} onSaveSource={async()=>{}} smartExtractionStatus="checking"/>)
    expect(html).toContain('人工工程响应')
    expect(html).not.toContain('本地规则兜底可用')
    expect(html).not.toContain('将生成可编辑的本地规则建议')
  })
  it('rejects an unverified injected runtime before default initialization', () => {
    expect(() => renderToStaticMarkup(React.createElement(App, { runtime: {} } as never))).toThrow('MAINLINE_RUNTIME_INVALID')
  })
  it('keeps a genuinely undated task distinct from an invalid date in the actual card', () => {
    const task = { ...demoTasks[0], deadline: '', riskFlags: [] }
    const html = renderToStaticMarkup(React.createElement(TaskCard, {
      task, onOpen: () => {}, dateView: { kind: 'absent', label: '原文未说明截止时间', noDeadlineProven: true, projectedPendingOnly: true },
    } as never))
    expect(html).toContain('原文未说明截止时间')
    expect(html).not.toContain('待补充')
  })
  it('does not rank proven absent deadlines as date errors while keeping other score factors', () => {
    const task = { ...demoTasks[0], deadline: '', riskFlags: ['待确认' as const] }
    const now = new Date('2026-09-05T08:00:00Z')
    const old = calculateTaskPriority(task, [task], now)
    const next = Reflect.apply(calculateTaskPriority, undefined, [task, [task], now,
      { [task.id]: { noDeadlineProven: true, projectedPendingOnly: true } }])
    expect(next.score).toBe(old.score - 77)
    expect(next.risks).not.toContain('待确认')
  })
})
