import type {Task} from '../types'

/** Shared user content for the timeline and editor. Literal source content is
 * useful product information, not a reason to hide a note. */
export function taskPublicDescription(task:Pick<Task,'description'|'history'>&{title?:string}):string {
 if(task.history.some(h=>/description|任务说明|备注/u.test(h.field)))return task.description
 return [...new Set(task.description.split('\n').map(line=>line.trim()).filter(Boolean)
  .filter(line=>!/^按直达规则保留的阅读待办$/u.test(line))
  .map(line=>line.replace(/^完整通知主题：/u,'').replace(/^适用条件待确认：/u,'适用范围：'))
  .filter(line=>line!==task.title?.replace(/^如符合条件\s*/u,'')))].join('\n')
}

/** A labelled location is an editable part of the saved task description.
 * Only project a single unambiguous value; leave everything else in context. */
export function taskPublicContent(task:Pick<Task,'description'|'history'>&{title?:string}):{location?:string;description:string} {
 const description=taskPublicDescription(task),lines=description.split('\n')
 const locations=[...new Set(lines.flatMap(line=>{const match=line.trim().match(/^地点[：:]\s*(.+)$/u);return match?[match[1].trim()]:[]}))]
 if(locations.length!==1)return {description}
 const location=locations[0]
 return {location,description:lines.filter(line=>{const match=line.trim().match(/^地点[：:]\s*(.+)$/u);return !match||match[1].trim()!==location}).join('\n')}
}
