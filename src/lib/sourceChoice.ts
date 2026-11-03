import type {Task} from '../types'

/** Completion of one option satisfies the group without mutating its siblings. */
export function visibleChoiceTasks(tasks:Task[]):Task[] {
 const completed=new Set(tasks.filter(task=>task.status==='已完成'&&task.sourceChoice).map(task=>task.sourceChoice!.id))
 return tasks.filter(task=>!task.sourceChoice||!completed.has(task.sourceChoice.id)||task.status==='已完成')
}
