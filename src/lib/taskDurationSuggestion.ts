import type {Task} from '../types'

/** A presentation-only planning estimate. The source fact and calendar are
 * untouched until the user explicitly edits a duration or arranges the task. */
export function suggestedTaskDuration(task:Task):string | undefined {
  if(task.estimatedMinutesKnown===true)return undefined
  const title=task.title.replace(/[\s。！!]+$/gu,'')
  if(/^(?:查看|取消|停止|禁止|不要|无需)/u.test(title))return undefined
  if(!/(?:讲座|培训|咨询|答疑|说明会|材料|文件)/u.test(title)&&/(?:线上|网上|网络|系统)(?:系统)?报名$/u.test(title))return '30 分钟'
  if(/(?:提交|准备|整理|递交).{0,16}(?:报名|申请).{0,8}材料$/u.test(title)||/(?:报名|申请).{0,8}材料(?:提交|准备|整理|递交)$/u.test(title))return '1 小时'
  return undefined
}
