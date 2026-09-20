/** Independently authored teaching examples, never evaluation answers or user data.
 * Method reference: DSPy LabeledFewShot; no upstream implementation is copied.
 * Evidence matching proves where a statement came from, not semantic correctness.
 */
export const CONTRASTIVE_EXAMPLE_VERSION = 'contrastive-evidence-examples-1' as const
export const CONTRASTIVE_EVIDENCE_EXAMPLES = [
  { id: 'teach-property', contrast: 'property-versus-action',
    text: '请将海报交到展务台。海报须用硬纸筒封装。',
    evidence: ['请将海报交到展务台', '海报须用硬纸筒封装'],
    judgement: '交海报是任务；硬纸筒是该任务的包装材料与规格。第二句没有独立购买或准备义务，不额外生成购买硬纸筒任务。材料准备情况未说明。' },
  { id: 'teach-explicit-action', contrast: 'property-versus-action',
    text: '请先购买硬纸筒，再将海报交到展务台。',
    evidence: ['请先购买硬纸筒', '再将海报交到展务台'],
    judgement: '购买硬纸筒与交海报都是明示动作，均须保留；先、再为顺序依据。不能因为硬纸筒也是材料就删除购买任务，也不能断言已购买。' },
  { id: 'teach-independent', contrast: 'association-versus-dependency',
    text: '请制作录音清单。另请把昨日录音备份到共享盘。',
    evidence: ['请制作录音清单', '另请把昨日录音备份到共享盘'],
    judgement: '两项任务都保留。同属录音工作、句子前后出现或有共同执行人，不足以建立前置依赖。昨日修饰录音，不是备份截止时间。' },
  { id: 'teach-prerequisite', contrast: 'association-versus-dependency',
    text: '请先完成录音清单核对，核对完成后才能将录音备份到共享盘。',
    evidence: ['请先完成录音清单核对', '核对完成后才能将录音备份到共享盘'],
    judgement: '两项任务保留，核对完成是备份的明示前置；要求核对不证明已经完成。完成后是前置条件，不是具体日期，不补常识日期。' },
  { id: 'teach-condition-unknown', contrast: 'requirement-versus-observed-state',
    text: '仅在保密培训完成后领取存储卡。培训是否完成尚待教务核实。',
    evidence: ['仅在保密培训完成后领取存储卡', '培训是否完成尚待教务核实'],
    judgement: '领取存储卡受条件限制；条件真假是unknown，不是true或false。条件未核实不等于取消领取要求；培训是否完成也不是日期。' },
  { id: 'teach-condition-true', contrast: 'requirement-versus-observed-state',
    text: '仅在保密培训完成后领取存储卡。教务确认培训已经完成。',
    evidence: ['仅在保密培训完成后领取存储卡', '教务确认培训已经完成'],
    judgement: '领取条件有明确已完成事实，可判true；不因此推断存储卡已经领取。培训已经完成是状态，不另造培训截止日期或培训待办。' },
  { id: 'teach-no-date', contrast: 'state-versus-date',
    text: '请保存测量日志。保存时保留文件名；无需今天提交，提交日期另行通知。',
    evidence: ['请保存测量日志', '保存时保留文件名', '无需今天提交', '提交日期另行通知'],
    judgement: '保存要求和文件名约束保留；保存时不是具体日期，今天位于否定要求中，不能成为有效截止。另行通知保留为尚不能确定的提交时间信息，不自行确定日期。' },
  { id: 'teach-explicit-date', contrast: 'state-versus-date',
    text: '请在10月8日下午三点前提交测量日志。提交时保留文件名。',
    evidence: ['请在10月8日下午三点前提交测量日志', '10月8日下午三点前', '提交时保留文件名'],
    judgement: '提交任务有明确截止表达10月8日下午三点前，交给既有时间解析；提交时仅修饰文件名约束，不能增加第二个时间实体。年份须按本次参考时刻处理，不复制示例年份。' },
] as const

export function validateContrastiveExamples() {
  const ids = new Set<string>()
  for (const example of CONTRASTIVE_EVIDENCE_EXAMPLES) {
    if (ids.has(example.id) || !example.evidence.length || example.evidence.some(quote =>
      !quote || !example.text.includes(quote))) throw Error('CONTRASTIVE_TEACHING_EVIDENCE_INVALID')
    ids.add(example.id)
  }
  return true
}
