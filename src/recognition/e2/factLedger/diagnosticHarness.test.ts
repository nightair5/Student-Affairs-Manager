import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from '../../pipeline'
import type { DiagnosticModelClient } from './diagnosticHarness'
import { runFactLedgerDiagnostic } from './diagnosticHarness'
import { FACT_LEDGER_SCHEMA_VERSION, type FactLedgerModelPayload } from './types'

const sourceText = '9月10日前提交报名表。'
const input = {
  sourceType: 'text', sourceTitle: '报名通知', sourceText,
  referenceTime: '2026-08-08T08:00:00+08:00', timezone: 'Asia/Shanghai',
}

function ledgerPayload(): FactLedgerModelPayload {
  return {
    schemaVersion: FACT_LEDGER_SCHEMA_VERSION,
    obligations: [{
      id: 'ob-1', actor: null, modality: 'required', actionPredicate: '提交', object: '报名表', materialIds: ['mat-1'],
      timeExpressionIds: ['time-1'], eventIds: [], conditionIds: [], constraintIds: [], evidenceIds: ['ev-1'],
    }],
    materials: [{ id: 'mat-1', name: '报名表', role: 'deliverable', obligationIds: ['ob-1'], constraintIds: [], evidenceIds: ['ev-1'] }],
    timeExpressions: [{
      id: 'time-1', rawText: '9月10日前', role: 'submission_deadline', precision: 'date_only', normalizedValue: '2026-09-10',
      endNormalizedValue: null, timezone: 'Asia/Shanghai', needsConfirmation: false, relatedObligationIds: ['ob-1'], relatedEventIds: [],
      supersedesTimeExpressionId: null, evidenceIds: ['ev-1'],
    }],
    events: [], conditions: [], constraints: [], ambiguities: [],
    evidence: [{ id: 'ev-1', quote: sourceText, start: 0, end: sourceText.length }],
  }
}

describe('runFactLedgerDiagnostic', () => {
  it('runs extraction, validation, then planning without exposing sourceText to Planner', async () => {
    const local = buildLocalRecognition({
      sourceType: 'text', sourceTitle: input.sourceTitle, content: sourceText,
      referenceTime: new Date(input.referenceTime), timezone: input.timezone, projects: [], tasks: [],
    })
    const calls: Array<{ operation: string; userPrompt: string }> = []
    const client: DiagnosticModelClient = {
      model: 'deepseek-v4-flash',
      async complete(request) {
        calls.push({ operation: request.operation, userPrompt: request.userPrompt })
        return {
          content: request.operation === 'extractFacts' ? JSON.stringify(ledgerPayload()) : JSON.stringify({ ...local, promptVersion: 'fact-ledger-planner-1.0.0', modelName: 'deepseek-v4-flash' }),
          latencyMs: request.operation === 'extractFacts' ? 10 : 20,
          tokenUsage: { input: 100, output: 50 },
        }
      },
    }
    const result = await runFactLedgerDiagnostic(input, client)
    expect(calls.map((call) => call.operation)).toEqual(['extractFacts', 'plan'])
    const plannerPayload = JSON.parse(calls[1].userPrompt) as { factLedger: Record<string, unknown> }
    expect(plannerPayload.factLedger).not.toHaveProperty('sourceText')
    expect(result.latencyMs).toBe(30)
    expect(result.tokenUsage).toEqual({ input: 200, output: 100 })
    expect(result.recognition.modelName).toBe('deepseek-v4-flash')
  })

  it('stops before Planner when FactLedger validation fails', async () => {
    const calls: string[] = []
    const invalid = ledgerPayload()
    invalid.timeExpressions[0] = { ...invalid.timeExpressions[0], precision: 'relative', normalizedValue: '2026-09-10', needsConfirmation: false }
    const client: DiagnosticModelClient = {
      model: 'deepseek-v4-flash',
      async complete(request) {
        calls.push(request.operation)
        return { content: JSON.stringify(invalid), latencyMs: 1, tokenUsage: null }
      },
    }
    await expect(runFactLedgerDiagnostic(input, client)).rejects.toThrow('FACT_LEDGER_VALIDATION_FAILED')
    expect(calls).toEqual(['extractFacts'])
  })
})
