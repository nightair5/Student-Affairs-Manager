import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import { buildCalendarIcs, buildTodoIcs } from './calendarExport'

describe('mobile calendar exports', () => {
  it('creates a calendar event with a real display alarm', () => {
    const task = { ...demoTasks[0], deadline: '2026-08-10T18:00', reminders: [] }
    const content = buildCalendarIcs([task], new Date('2026-08-03T00:00:00Z'))
    expect(content).toContain('BEGIN:VEVENT')
    expect(content).toContain('BEGIN:VALARM')
    expect(content).toContain('TRIGGER;VALUE=DATE-TIME:20260810T090000Z')
    expect(content).toContain('SUMMARY:')
  })

  it('creates standards-based VTODO records and skips completed tasks', () => {
    const openTask = { ...demoTasks[0], deadline: '2026-08-10T18:00' }
    const doneTask = { ...demoTasks[1], status: '已完成' as const }
    const content = buildTodoIcs([openTask, doneTask], new Date('2026-08-03T00:00:00Z'))
    expect(content.match(/BEGIN:VTODO/gu)).toHaveLength(1)
    expect(content).toContain('STATUS:NEEDS-ACTION')
  })

  it('exports date-only deadlines as all-day calendar values', () => {
    const task = { ...demoTasks[0], deadline: '2026-08-10', reminders: [] }
    const event = buildCalendarIcs([task], new Date('2026-08-03T00:00:00Z'))
    const todo = buildTodoIcs([task], new Date('2026-08-03T00:00:00Z'))
    expect(event).toContain('DTSTART;VALUE=DATE:20260810')
    expect(event).toContain('DTEND;VALUE=DATE:20260811')
    expect(todo).toContain('DUE;VALUE=DATE:20260810')
  })
})
