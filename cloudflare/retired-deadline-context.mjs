export const RETIRED_DEADLINE_CONTEXT_VERSION='retired-deadline-context-1.0.0'
/** An explicitly cancelled, unowned, deselected historical date is context,
 * not a fresh deadline. No active owner or relation is silently removed. */
export function retiredDeadlineContext(point,result,evidence,source){
 if(typeof source!=='string'||!point||!/(?:registration|submission|task)_deadline$/u.test(point.type??'')||point.selected!==false||point.normalizedValue!==null||point.relatedTaskTempIds?.length||point.relatedMaterialTempIds?.length)return false
 const literal=String(point.rawText??'');if(!/旧截止(?:现已|已经|已)?(?:取消|作废)(?:了|[。；;，,]|$)/u.test(literal)||/没有取消|未取消|不取消|[吗?？]/u.test(literal))return false
 const tasks=[...(result.standaloneTasks??[]),...(result.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])]
 if(tasks.some(t=>t.timePointTempIds?.includes(point.tempId))||(result.events??[]).some(e=>e.startTimePointTempId===point.tempId||e.endTimePointTempId===point.tempId))return false
 return (evidence??[]).some(e=>point.evidenceIds?.includes(e.id)&&typeof(e.quote??e.quotedText)==='string'&&source.includes(e.quote??e.quotedText)&&(e.quote??e.quotedText).includes(literal))
}
