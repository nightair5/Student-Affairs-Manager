import type { Task } from '../types'

export type BrowserNotificationPermission = NotificationPermission | 'unsupported'

export interface BrowserReminderJob {
  key: string
  reminderId: string
  delayMs: number
  title: string
  body: string
}

const RECENT_GRACE_MS = 60_000
const MAX_TIMEOUT_MS = 2_147_000_000

export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return window.Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  const current = getBrowserNotificationPermission()
  if (current === 'unsupported' || current !== 'default') return current
  return window.Notification.requestPermission()
}

export function buildBrowserReminderJobs(
  tasks: Task[],
  now = new Date(),
): BrowserReminderJob[] {
  const nowTime = now.getTime()
  return tasks.flatMap((task) =>
    task.reminders.flatMap((reminder) => {
      if (reminder.channel !== 'browser' || !reminder.enabled) return []
      const scheduledTime = new Date(reminder.scheduledAt).getTime()
      if (!Number.isFinite(scheduledTime)) return []
      const rawDelay = scheduledTime - nowTime
      if (rawDelay < -RECENT_GRACE_MS || rawDelay > MAX_TIMEOUT_MS) return []
      return [
        {
          key: `${reminder.id}:${reminder.scheduledAt}`,
          reminderId: reminder.id,
          delayMs: Math.max(0, rawDelay),
          title: `学生事务管家 · ${task.title}`,
          body: `${task.nextAction}；截止：${new Intl.DateTimeFormat('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(task.deadline))}`,
        },
      ]
    }),
  )
}

export function scheduleBrowserNotifications(
  tasks: Task[],
  delivered: Set<string>,
  onError?: () => void,
): () => void {
  if (getBrowserNotificationPermission() !== 'granted') return () => undefined

  const timeouts = buildBrowserReminderJobs(tasks).flatMap((job) => {
    if (delivered.has(job.key)) return []
    const timeout = window.setTimeout(() => {
      if (delivered.has(job.key)) return
      try {
        new window.Notification(job.title, {
          body: job.body,
          tag: job.reminderId,
        })
        delivered.add(job.key)
      } catch {
        onError?.()
      }
    }, job.delayMs)
    return [timeout]
  })

  return () => timeouts.forEach((timeout) => window.clearTimeout(timeout))
}
