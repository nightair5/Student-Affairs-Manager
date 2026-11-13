// Calendar parsing must not reinterpret quantities or recurrence rules as a
// one-off date. This is a typed parsing view; the original quote stays intact.
const range = /(?:第\s*)?\d{1,4}\s*[-—–~～至到]\s*\d{1,4}\s*(?:周(?![一二三四五六日天])|班|年级|页|份|人|分钟|小时|号房|室)/gu
const recurring = /(?:每(?:个|一)?(?:学期|学年|周|星期|礼拜)|逢(?:周|星期|礼拜)|每月\s*\d)/u
const calendarDate = /(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|今天|明天|后天|(?:(?:本|这|下|上)(?:个)?)?(?:周|星期|礼拜)[一二三四五六日天]/u

export function sourceTimeKind(raw) {
  const normalized = raw.normalize('NFKC')
  const calendarText = normalized.replace(range, ' ')
  if (recurring.test(normalized)) {
    // A recurring service rule can accompany a separately stated one-off
    // deadline. Keep only an unambiguous, independently delimited date clause;
    // do not interpret the recurrence's week range or choose one occurrence.
    const clauses=calendarText.split(/[。；;\n]/u).filter(clause=>calendarDate.test(clause)&&!recurring.test(clause))
    if(clauses.length===1)return {kind:'calendar',calendarText:clauses[0].trim()}
    return {kind:'recurrence', calendarText:null}
  }
  if (calendarText !== normalized) {
    const hasDate = calendarDate.test(calendarText)
    return {kind:hasDate?'calendar':'non_calendar_range', calendarText:hasDate?calendarText:null}
  }
  return {kind:'calendar', calendarText:raw}
}
