export const RECOGNITION_ROUTER_VERSION = 'recognition-router-1.2.0'

export type RecognitionComplexityLevel = 'simple' | 'medium' | 'complex'
export type RecognitionStrategy = 'single_pass' | 'intensive_single_pass'

export interface RecognitionComplexityFeatures {
  textLength: number
  actionCueCount: number
  timeExpressionCount: number
  materialCueCount: number
  eventCueCount: number
  listItemCount: number
  conditionCueCount: number
  channelCueCount: number
  paragraphCount: number
  pdfPageCueCount: number
  hasTable: boolean
  hasCrossParagraphReference: boolean
  hasMultipleDeadlines: boolean
  hasInformationOnlyCue: boolean
  hasStrongCorrection: boolean
  hasDependentTiming: boolean
  hasAmbiguity: boolean
  hasOptionalOrReferenceBoundary: boolean
  hasConstraintBundle: boolean
  hasOcrNoise: boolean
  hasPromptInjection: boolean
}

export interface RecognitionRoute {
  routerVersion: typeof RECOGNITION_ROUTER_VERSION
  level: RecognitionComplexityLevel
  score: number
  reasons: string[]
  features: RecognitionComplexityFeatures
  candidateStrategy: RecognitionStrategy
  selectedStrategy: RecognitionStrategy
  intensiveModeEnabled: boolean
}

const TIME_EXPRESSION = /(?:(?:20\d{2}[年/.-])?\s*\d{1,2}\s*(?:月|[-/.])\s*[\dIOo一二三四五六七八九十]{1,3}\s*(?:日|号)?(?:\s*(?:上午|中午|下午|傍晚|晚上|晚|凌晨)?\s*[\dIOo一二三四五六七八九十]{1,2}(?::|：|点)[\dIOo一二三四五六七八九十]{0,2})?|(?:当天|同日|当日)?\s*(?:上午|中午|下午|傍晚|晚上|晚|凌晨)?\s*[\dIOo一二三四五六七八九十]{1,2}(?::|：|点)[\dIOo一二三四五六七八九十]{0,2}|[一二三四五六七八九十]{1,3}月[一二三四五六七八九十]{1,3}[日号]?|今天|明天|后天|本周|下周|第[一二三四五六七八九十\d]+周|月底|月末|近期|稍后|另行通知|待定|暂未确定|日期尚未确定)/giu
const ACTION = /(?:提交|上传|填写|完成|准备|核对|复核|确认|联系|参加|阅读|看完|下载|打印|盖章|签字|回复|领取|整理|汇总|归档|评分|撰写|制作|报名(?!表|信息|问卷|截止|受理|窗口)|签到|携带|带|出示|汇报|预约|认证|报到|缴纳|选择|登记|寄送|送达|交验|核验|提供|报送|递交|申领|补交|打包|确定|形成|交付(?!件|期限|内容)|交(?=选题表|初稿|定稿|报告|材料|方案|文件|文献综述|研究设计表))/gu
const MATERIAL_CUE = /(?:材料|文件|附件|附表|表格|表|报告|证明|声明|记录|截图|照片|音频|视频|PDF|Word|Excel|PPT|压缩包|源代码|方案|总结|问卷|名单|凭证|证件|原件|复印件|扫描件|文档)/giu
const EVENT_CUE = /(?:参加|出席|到场|集合|召开|举行|开幕|开课|答辩|面试|路演|培训|宣讲|会议|例会|活动|测试|考试|汇报|陈述|交流|评比|审核|验收|复核|维护|公示)/gu
const CONDITION_CUE = /(?:如|若|仅限|只限|入围|已录用|录用者|通过后|未通过|名单公布后|发布后|结束后|获入选|视情况|另行通知|否则|未入围|条件)/gu
const CHANNEL_CUE = /(?:微信|QQ群|微信群|群里|邮件|邮箱|系统|平台|小程序|网站|线上|线下|现场|问卷)/gu
const INFORMATION_ONLY = /(?:无需(?:学生)?(?:办理|操作|准备|提交|确认)|不用(?:办|处理|操作)|无须(?:办理|操作)|未要求(?:个人|读者)?(?:提交|确认|执行)|仅供知悉|只供查询|仅作说明|看看就行|知道一下就好|无需准备材料|没有期中考试|主要参考|公示期|名单进行公示)/u
const STRONG_CORRECTION = /(?:原(?:定|截止|收件日|报名截止).{0,30}(?:现|改|调整|延长)|更正通知|不是.{0,20}(?:改|调整)|由.{0,20}(?:调整|改为)|现(?:更正|改为|延长到))/u
const DEPENDENT_TIMING = /(?:发布|公布|结束|通过|录用|面试|活动|讲座).{0,8}(?:后|次日)|自.{0,20}之时起|前一日|后\d+小时|两天内/u
const AMBIGUITY = /(?:待定|暂定|另行通知|以后通知|视情况|如有变动|以最新通知为准|时间不详|地点不详|可能调整|预计|大约|尚未|暂未|不详|商定|再确认|具体日期|具体时段)/u
const OPTIONAL_OR_REFERENCE = /(?:可选|自愿|不作强制|仅供参考|只供查询|参考资料|不作为办理材料|无需提交|无须提交|不用交)/u
const CONSTRAINT_BUNDLE = /(?:不得|不可|不超过|命名为|文件名|缺一不可|统一装入|装入档案袋|原件|复印件|纸质|电子版|签字|盖章|两份|一张|一个MP4|竖版|真实联系方式)/u
const OCR_NOISE = /(?:\d\s+[月日]|[IOo][月日点]|\d[IOo]|[IOo]\d|[\p{Script=Han}]\s+[\p{Script=Han}]|�)/u
const PROMPT_INJECTION = /(?:SYSTEM\s*:|忽略(?:以上|系统规则)|DEEPSEEK_API_KEY|删除所有任务|自动发送邮件|标记已提交)/iu
const CORRECTION_OR_SUPPLEMENT = /(?:补充通知|补交|新增|材料不变|截止不变|延期|提前|取消)/u
const CROSS_PARAGRAPH = /(?:上述|前述|以下|其中|该材料|该事项|对应|分别|见前文|按前款)/u
const TABLE_ROW = /(?:^|\n)[^\n|\t]{1,80}(?:\||｜|\t)[^\n|\t]{1,80}(?:(?:\||｜|\t)[^\n]{1,80})/mu
const LIST_ITEM = /(?:^|\n)\s*(?:\d+[.、)]|[一二三四五六七八九十]+[、.]|[-•])\s*/gmu
const PDF_PAGE_CUE = /(?:第\s*\d+\s*页|共\s*\d+\s*页|PDF\s*第?\s*\d+\s*页)/giu

function matchCount(content: string, pattern: RegExp): number {
  return content.match(pattern)?.length ?? 0
}

export function extractRecognitionComplexityFeatures(content: string): RecognitionComplexityFeatures {
  const paragraphCount = content.split(/\n\s*\n/u).map((paragraph) => paragraph.trim()).filter(Boolean).length
  const timeExpressionCount = matchCount(content, TIME_EXPRESSION)
  return {
    textLength: content.trim().length,
    actionCueCount: matchCount(content, ACTION),
    timeExpressionCount,
    materialCueCount: matchCount(content, MATERIAL_CUE),
    eventCueCount: matchCount(content, EVENT_CUE),
    listItemCount: matchCount(content, LIST_ITEM),
    conditionCueCount: matchCount(content, CONDITION_CUE),
    channelCueCount: matchCount(content, CHANNEL_CUE),
    paragraphCount,
    pdfPageCueCount: matchCount(content, PDF_PAGE_CUE),
    hasTable: TABLE_ROW.test(content),
    hasCrossParagraphReference: paragraphCount >= 2 && CROSS_PARAGRAPH.test(content),
    hasMultipleDeadlines: timeExpressionCount >= 2,
    hasInformationOnlyCue: INFORMATION_ONLY.test(content),
    hasStrongCorrection: STRONG_CORRECTION.test(content),
    hasDependentTiming: DEPENDENT_TIMING.test(content),
    hasAmbiguity: AMBIGUITY.test(content),
    hasOptionalOrReferenceBoundary: OPTIONAL_OR_REFERENCE.test(content),
    hasConstraintBundle: CONSTRAINT_BUNDLE.test(content),
    hasOcrNoise: OCR_NOISE.test(content),
    hasPromptInjection: PROMPT_INJECTION.test(content),
  }
}

export function routeRecognitionSource(content: string, enableIntensiveSinglePass = false): RecognitionRoute {
  const features = extractRecognitionComplexityFeatures(content)
  const reasons: string[] = []
  let level: RecognitionComplexityLevel

  if (features.hasInformationOnlyCue && !features.hasPromptInjection && !features.hasOptionalOrReferenceBoundary && features.conditionCueCount === 0) {
    level = 'simple'
    reasons.push('明确的信息知悉或无需操作语义')
  } else {
    const complexSignals = [
      features.hasStrongCorrection,
      features.hasTable && features.timeExpressionCount >= 3,
      features.hasDependentTiming && (features.hasAmbiguity || features.eventCueCount >= 1),
      features.timeExpressionCount >= 3 && (features.actionCueCount >= 2 || features.eventCueCount >= 1),
      features.timeExpressionCount >= 2 && features.conditionCueCount >= 1 && features.eventCueCount >= 1,
      features.eventCueCount >= 2 && features.actionCueCount >= 2 && features.conditionCueCount >= 1,
      features.actionCueCount >= 3 && features.timeExpressionCount >= 2,
      features.listItemCount >= 3 && (features.actionCueCount >= 2 || features.timeExpressionCount >= 2),
    ]
    if (complexSignals.some(Boolean)) {
      level = 'complex'
      if (features.hasStrongCorrection) reasons.push('存在旧值与新值的明确更正关系')
      if (features.hasDependentTiming) reasons.push('存在依赖其他事件的相对时间')
      if (features.hasTable) reasons.push('包含表格结构')
      if (features.timeExpressionCount >= 3) reasons.push(`包含 ${features.timeExpressionCount} 个时间表达`)
      if (features.actionCueCount >= 2) reasons.push(`包含 ${features.actionCueCount} 个动作线索`)
      if (features.eventCueCount >= 2) reasons.push(`包含 ${features.eventCueCount} 个事件线索`)
    } else {
      const mediumSignals = [
        features.hasPromptInjection,
        features.hasOcrNoise,
        features.hasAmbiguity,
        features.conditionCueCount >= 1,
        features.actionCueCount >= 2,
        features.eventCueCount >= 1 && features.actionCueCount >= 2,
        features.hasOptionalOrReferenceBoundary && features.materialCueCount >= 1,
        features.hasConstraintBundle,
        CORRECTION_OR_SUPPLEMENT.test(content),
        features.hasCrossParagraphReference,
        features.channelCueCount >= 2,
        features.pdfPageCueCount >= 2,
      ]
      level = mediumSignals.some(Boolean) ? 'medium' : 'simple'
      if (features.hasPromptInjection) reasons.push('包含需要隔离的提示注入文本')
      if (features.hasOcrNoise) reasons.push('包含 OCR 噪声')
      if (features.hasAmbiguity) reasons.push('包含不确定或待确认语义')
      if (features.conditionCueCount >= 1) reasons.push(`包含 ${features.conditionCueCount} 个条件线索`)
      if (features.actionCueCount >= 2) reasons.push(`包含 ${features.actionCueCount} 个动作线索`)
      if (features.hasOptionalOrReferenceBoundary) reasons.push('包含可选或仅供参考边界')
      if (features.hasConstraintBundle) reasons.push('包含材料格式、数量或包装约束')
    }
  }

  if (reasons.length === 0) reasons.push('单一动作或信息事件，无跨事实依赖')
  const score = level === 'complex' ? 2 : level === 'medium' ? 1 : 0
  const candidateStrategy: RecognitionStrategy = level === 'complex' ? 'intensive_single_pass' : 'single_pass'
  const intensiveModeEnabled = candidateStrategy === 'intensive_single_pass' && enableIntensiveSinglePass
  return {
    routerVersion: RECOGNITION_ROUTER_VERSION,
    level,
    score,
    reasons,
    features,
    candidateStrategy,
    selectedStrategy: intensiveModeEnabled ? 'intensive_single_pass' : 'single_pass',
    intensiveModeEnabled,
  }
}
