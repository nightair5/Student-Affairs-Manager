// A time interval is not a deadline merely because a model chose that enum.
// No end date or event anchor is manufactured here; keep the original literal.
export const DEADLINE_RANGE_ROLE_VERSION='deadline-range-role-1.0.0'
export function deadlineRangeRoleIssue(rawText,type){
 if(typeof rawText!=='string'||!/^(?:registration|submission|task)_deadline$/u.test(type??''))return null
 const q=rawText.replace(/\s/gu,'')
 const start='(?:\\d{4}年)?\\d{1,2}月\\d{1,2}日?'
 const finite=new RegExp(start+'(?:至|到|[-–—])(?:\\d{4}年)?(?:\\d{1,2}月)?\\d{1,2}日','u').exec(q)
 // A separately explicit "...日17:00前" is not rejected by this range guard.
 // Single cutoffs and event/window endpoints continue through their old path.
 if(finite&&!/^(?:\d{1,2}[:：][0-5]\d)?(?:之前|以前|前|为止)/u.test(q.slice(finite.index+finite[0].length)))return 'deadline_is_unqualified_date_range'
 const relative=new RegExp(start+'(?:至|到)(?!\\d)[^，。；]{0,40}(?:(?:开场|开始|开考|结束|完成|举行)前|另行通知|待定|未公布)','u')
 return relative.test(q)?'deadline_range_end_unresolved':null
}
