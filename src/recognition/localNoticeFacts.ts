/** Local fallback only. Never used to rewrite a cloud/recorded RecognitionResult. */
export const LOCAL_NOTICE_FACTS_VERSION = 'local-notice-facts-1.2.0'
export function localDelivery(text: string): {verb: string; sourceVerb: string; object: string; channel: string} | null {
  const source = text.replace(/[（(][^（）()]*[）)]/gu, '')
  const matches = [...source.matchAll(/(?:把|将)\s*([^，,；;。！？\n]{1,60}?)\s*(提交|上传|发送|交到|交至|发到|发至)\s*([^，,；;。！？\n]{1,60})/gu)]
  const direct = [...source.matchAll(/(提交|上传|发送)\s*([^，,；;。！？\n]{1,60}?)\s*(?:至|到|给)\s*([^，,；;。！？\n]{1,60})/gu)]
  const candidates = matches.map(m => ({verb: /^交/u.test(m[2]) ? '提交' : /^发/u.test(m[2]) ? '发送' : m[2], sourceVerb: m[2].replace(/[到至]$/u,''), object: m[1].trim(), channel: m[3].replace(/^(?:到|至|给)\s*/u, '').trim()}))
    .concat(direct.map(m => ({verb: m[1], sourceVerb: m[1], object: m[2].trim(), channel: m[3].trim()})))
  // A separate destination clause may follow only format/naming annotations.
  // A different object, action, condition or second destination cannot be bridged.
  const annotated = /(?:提交|上传|发送)([^，,；;。！？\n]{1,60})[，,]((?:[^，,；;。！？\n]+[，,])+)(?:交到|交至|提交至|上传至|发送至)\s*([^，,；;。！？\n]{1,60})[。]?$/u.exec(source)
  if (annotated && annotated[2].split(/[，,]/u).filter(Boolean).every(part => /^(?:(?:PDF|DOCX?|PPTX?|XLSX?)(?:格式)?|(?:文件)?(?:以|按)?(?:学号[+＋]姓名|姓名[+＋]学号)命名)$/iu.test(part.trim()))) {
    const verb = /(?:提交|上传|发送)(?=[^，,]+[，,])/u.exec(annotated[0])?.[0] ?? '提交'
    candidates.push({verb,sourceVerb:verb,object:annotated[1].trim(),channel:annotated[3].trim()})
  }
  const channels = [...text.matchAll(/(?:交到|交至|发到|发至|提交到|提交至|上传到|上传至|发送到|发送至)\s*([^，,；;。！？（）()\n]{1,60})/gu)].map(m => m[1].trim())
  if (new Set(channels).size > 1) return null
  const unique = [...new Map(candidates.map(c => [JSON.stringify(c), c])).values()]
  return unique.length === 1 && unique[0].object && unique[0].channel ? unique[0] : null
}
export function localEventLocation(text: string): {name: string; location: string} | null {
  const matches = [...text.matchAll(/在\s*([^，,；;。！？\n]{1,35}?)\s*(?:召开|举行|举办|参加|开展|开)([^，,；;。！？\n]{1,60})/gu)]
  if (matches.length !== 1) return null
  const [, location, name] = matches[0]
  return {name: name.trim(), location: location.trim()}
}
export function localSubmissionChannel(text: string): string | null {
  const matches = [...text.matchAll(/(?:交到|交至|发到|发至|提交到|提交至|上传到|上传至|发送到|发送至)\s*([^，,；;。！？（）()\n]{1,60})/gu)].map(m => m[1].trim())
  const unique = [...new Set(matches)]
  return unique.length === 1 ? unique[0] : null
}
export function localMaterialRequirements(text: string) {
  const formats = [...new Set((text.match(/\b(?:PDF|DOCX?|PPTX?|XLSX?)\b/giu) ?? []))]
  const naming = [...new Set((text.match(/学号\s*[+＋]\s*姓名|姓名\s*[+＋]\s*学号/gu) ?? []))]
  return {formats, naming}
}
/** A notice describes a class of people; it does not establish the current user's state. */
export function localActionNeedsDecision(text: string): boolean {
  return /(?:如果|如(?=已|需|有|未|不|符合|决定|申请|参加|被|属于)|若(?=已|需|有|未|不|符合|决定|申请|参加|被|属于)|(?:^|[，,；;。\n])凡|仅限|符合.{0,20}条件|入选后|录取后|报名成功后|决定放弃|自愿|有意|取消|禁止|不得|无需|无须|不再|请勿|不要|不应|不可|不能|不准|不允许|不必|不用|不提交|不上传|不发送|不交)/u.test(text)
}

/** An explicit attendance request is distinct from announcing an event. */
export function localAttendanceDirective(text: string): boolean {
  return /请(?:大家|各位同学|同学们|全体同学)?(?:务必|准时|按时)?(?:参加|出席)/u.test(text) && !localActionNeedsDecision(text)
}
