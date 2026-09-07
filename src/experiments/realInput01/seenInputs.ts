// Engineering/runner-only: never import this module into the live browser or gateway bundle.
import { engineeringReply, cases, notices, NOW } from '../mainline05/engineeringReplay'
import { projectSemantic, MODEL_NAME } from './modelWire'
import type { CaptureHandle } from '../../domain/v2/capture'
export { cases, notices, NOW }
export async function seenWire(name: typeof cases[number], handle: Pick<CaptureHandle, 'sourceId' | 'sourceVersionId'>) {
  const original = await engineeringReply(name, handle)
  const wire = projectSemantic(original.rawResponse)
  return { label: '已见人工工程响应的wire形状回放，非模型预测' as const, original, wire,
    rawHttpText: JSON.stringify({ model: MODEL_NAME, status: 'completed', output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(wire) }] }], usage: { input_tokens: 0, output_tokens: 0 } }) }
}
