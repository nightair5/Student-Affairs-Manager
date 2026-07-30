import type { Source, Task } from '../types'

const TASKS_KEY = 'student-affairs-steward:tasks:v1'
const SOURCES_KEY = 'student-affairs-steward:sources:v1'

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export function loadTasks(fallback: Task[]): Task[] {
  return readJson(TASKS_KEY, fallback)
}

export function loadSources(fallback: Source[]): Source[] {
  return readJson(SOURCES_KEY, fallback)
}

export function saveTasks(tasks: Task[]): void {
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  } catch {
    // Local persistence is best-effort; the current in-memory session still works.
  }
}

export function saveSources(sources: Source[]): void {
  try {
    window.localStorage.setItem(SOURCES_KEY, JSON.stringify(sources))
  } catch {
    // Local persistence is best-effort; the current in-memory session still works.
  }
}
