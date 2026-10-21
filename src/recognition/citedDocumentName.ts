import type { RecognitionResult } from './types'

export const CITED_DOCUMENT_NAME_VERSION = 'cited-document-name-1.0.0'
export interface CitedDocumentName {
  taskId: string
  materialId: string
  declaredObject: string
  literalObject: string
  qualifier: string
  evidenceIds: string[]
  start: number
  end: number
  rule: 'SAME_DELIVERY_EXPLICIT_DOCUMENT_TITLE'
}
const compact = (s: string) => s.replace(/\s/gu, '')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/** A declared document can combine its literal form with its explicitly named
 * topic: submit "electronic manuscript", whose title format includes "paper
 * topic". Require both roles in the SAME cited instruction and a single
 * reciprocal owner. This is not suffix matching or a synonym dictionary.
 * Preserve the declared fields; the literal alias only verifies their support. */
export function citedDocumentNames(result: RecognitionResult, source: string): CitedDocumentName[] {
  const tasks = [...result.standaloneTasks, ...result.milestones.flatMap(m => [...m.tasks, ...m.workPackages.flatMap(w => w.tasks)])]
  const proofs: CitedDocumentName[] = []
  for (const task of tasks) {
    if (!/^(?:提交|上传|发送)$/u.test(task.actionVerb)) continue
    const material = result.materials.filter(m => m.name === task.actionObject && task.materialTempIds.includes(m.tempId)
      && m.relatedTaskTempIds.length === 1 && m.relatedTaskTempIds[0] === task.tempId)
    if (material.length !== 1) continue
    const ids = [...new Set([...task.evidenceIds, ...material[0].evidenceIds])]
    const refs = ids.map(id => result.evidence.find(e => e.id === id))
    if (refs.some(e => !e?.quote || !source.includes(e.quote) || source.indexOf(e.quote) !== source.lastIndexOf(e.quote))
      || new Set(refs.map(e => e?.sourceId)).size !== 1) continue
    // The instruction and naming clause must both already be cited by the
    // action AND material. A summary or an unrelated heading cannot rescue it.
    const own = refs.filter(e => e?.quote && task.evidenceIds.includes(e.id) && material[0].evidenceIds.includes(e.id))
    for (const e of own) {
      const text = compact(e!.quote!)
      const expression = new RegExp(escape(task.actionVerb) + '([^，,。；;]{2,50})[，,]((?:稿件|文件|文稿|材料)?(?:标题|命名)(?:格式|要求)(?:统一)?(?:标注为|为|是)[^，,。；;]+)', 'gu')
      for (const match of text.matchAll(expression)) {
        const literal = match[1], declared = compact(task.actionObject)
        if (!declared.endsWith(literal) || declared === literal) continue
        const qualifier = declared.slice(0, -literal.length)
        if (qualifier.length < 2 || qualifier.length > 24 || !match[2].includes(qualifier + '题目')) continue
        const before = text.slice(0, match.index).split(/[。；;]/u).at(-1) ?? ''
        if (/请勿|不要|不得|禁止|取消|作废|不再|无需|不必|如果|假如|例如|若/u.test(before + match[0])) continue
        if (tasks.filter(t => compact(t.actionObject).endsWith(literal)).length !== 1
          || result.materials.filter(m => compact(m.name).endsWith(literal)).length !== 1) continue
        proofs.push({ taskId: task.tempId, materialId: material[0].tempId, declaredObject: task.actionObject,
          literalObject: literal, qualifier, evidenceIds: [e!.id], start: source.indexOf(e!.quote!),
          end: source.indexOf(e!.quote!) + e!.quote!.length, rule: 'SAME_DELIVERY_EXPLICIT_DOCUMENT_TITLE' })
      }
    }
  }
  // Multiple matching interpretations stay unresolved.
  return proofs.filter(p => proofs.filter(q => q.taskId === p.taskId).length === 1)
}
