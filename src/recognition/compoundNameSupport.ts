export const COMPOUND_NAME_SUPPORT_VERSION='source-compound-name-support-1.0.0'
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
/** Closed grammatical equivalence, not a bag of words across source clauses. */
export function supportedCoordinatedObject(value:string,action:string,quotes:string[]):boolean {
  const parts=value.split('和')
  if(parts.length!==2||parts.some(p=>!p.trim()))return false
  const verb='(?:激活|登录|填写|提交|上传|领取|准备|核对)'
  const predicate=new RegExp(`${verb}${escape(parts[0])}和${verb}${escape(parts[1])}(?:$|[，。；])`,'u')
  return predicate.test(action)&&quotes.some(q=>q.includes(action)&&predicate.test(q))
}
/** "活动" may be a generic noun after a literal named activity. It cannot
 * replace a missing identity, bind another owner, or manufacture a second event. */
export function supportedEventDescriptor(value:string,quotes:string[]):boolean {
  if(!value.endsWith('活动'))return false
  const name=value.slice(0,-2)
  if(!name||!/(?:学校|工作坊|讲座|培训|研讨会)$/u.test(name))return false
  return quotes.some(q=>new RegExp(`(?:举办|举行|开展|组织|开办)(?:线上|线下|本次|一次|年度)?${escape(name)}(?:[，。；]|$|于|活动)`,'u').test(q)
    || new RegExp(`${escape(name)}(?:活动)?(?:将|于[^，。；]{1,30})?(?:开始|举行)(?:[，。；]|$)`,'u').test(q))
}
