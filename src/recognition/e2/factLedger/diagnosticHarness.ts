import type { RecognitionResult } from '../../types'
import { parseRecognitionResult } from '../../schema'
import { parseFactLedgerJson } from './parser'
import { factExtractionSystemPrompt, factExtractionUserPrompt, factPlannerSystemPrompt, factPlannerUserPrompt } from './prompts'
import type { FactLedger } from './types'

export interface DiagnosticTokenUsage {
  input: number
  output: number
}

export interface DiagnosticModelResponse {
  content: string
  latencyMs: number
  tokenUsage: DiagnosticTokenUsage | null
}

export interface DiagnosticModelClient {
  model: 'deepseek-v4-flash'
  complete(input: {
    operation: 'extractFacts' | 'plan'
    systemPrompt: string
    userPrompt: string
    temperature: 0
  }): Promise<DiagnosticModelResponse>
}

export interface FactLedgerDiagnosticInput {
  sourceType: string
  sourceTitle: string
  sourceText: string
  referenceTime: string
  timezone: string
}

export interface FactLedgerDiagnosticResult {
  ledger: FactLedger
  recognition: RecognitionResult
  latencyMs: number
  tokenUsage: DiagnosticTokenUsage | null
  operations: Array<{
    operation: 'extractFacts' | 'plan'
    latencyMs: number
    tokenUsage: DiagnosticTokenUsage | null
  }>
}

function aggregateUsage(responses: DiagnosticModelResponse[]): DiagnosticTokenUsage | null {
  if (responses.some((response) => response.tokenUsage === null)) return null
  return responses.reduce<DiagnosticTokenUsage>((total, response) => ({
    input: total.input + (response.tokenUsage?.input ?? 0),
    output: total.output + (response.tokenUsage?.output ?? 0),
  }), { input: 0, output: 0 })
}

export async function runFactLedgerDiagnostic(
  input: FactLedgerDiagnosticInput,
  client: DiagnosticModelClient,
): Promise<FactLedgerDiagnosticResult> {
  const extraction = await client.complete({
    operation: 'extractFacts',
    systemPrompt: factExtractionSystemPrompt,
    userPrompt: factExtractionUserPrompt(input),
    temperature: 0,
  })
  const ledger = parseFactLedgerJson(extraction.content, {
    sourceText: input.sourceText,
    referenceTime: input.referenceTime,
    timezone: input.timezone,
  })
  const planning = await client.complete({
    operation: 'plan',
    systemPrompt: factPlannerSystemPrompt,
    userPrompt: factPlannerUserPrompt(ledger),
    temperature: 0,
  })
  const parsedPlanning = JSON.parse(planning.content) as unknown
  const recognition = parseRecognitionResult(parsedPlanning)
  const responses = [extraction, planning]
  return {
    ledger,
    recognition,
    latencyMs: responses.reduce((total, response) => total + response.latencyMs, 0),
    tokenUsage: aggregateUsage(responses),
    operations: [
      { operation: 'extractFacts', latencyMs: extraction.latencyMs, tokenUsage: extraction.tokenUsage },
      { operation: 'plan', latencyMs: planning.latencyMs, tokenUsage: planning.tokenUsage },
    ],
  }
}
