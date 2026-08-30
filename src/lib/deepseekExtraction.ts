import type { IntakeInput, IntakeResult } from './intake'
import { createIntakeResult } from './intake'
import type { ParsedSuggestion } from '../types'
import type { Project, Task } from '../types'
import { parseRecognitionResult } from '../recognition/schema'
import { recognitionToLegacySuggestions } from '../recognition/pipeline'
import type { RecognitionResult } from '../recognition/types'
import { RECOGNITION_PROMPT_VERSION } from '../recognition/prompt'
import { MULTIMODAL_MODEL_NAME, MULTIMODAL_PROMPT_VERSION } from './multimodal'

export type SmartExtractionMethod = 'deepseek-v4-flash' | 'deepseek-v4-flash-vision-exp' | 'local-rules'

export interface SmartIntakeResult extends IntakeResult {
  method: SmartExtractionMethod
  fallbackReason?: string
}

export interface DeepSeekExtractionService {
  status(): Promise<{ configured: boolean; model?: string; multimodalModel?: string }>
  extract(input: IntakeInput): Promise<ParsedSuggestion[]>
  recognize?(input: IntakeInput, context?: { projects: Project[]; tasks: Task[] }): Promise<RecognitionResult>
}

function serverMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback
  const message = (value as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export class ProxyDeepSeekExtractionService implements DeepSeekExtractionService {
  private readonly cache = new Map<string, RecognitionResult>()
  private readonly inFlight = new Map<string, Promise<RecognitionResult>>()

  constructor(private readonly endpoint = '/api/deepseek') {}

  async status(): Promise<{ configured: boolean; model?: string; multimodalModel?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/status`, { headers: { Accept: 'application/json' } })
      if (!response.ok) return { configured: false }
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null) return { configured: false }
      const record = data as { configured?: unknown; model?: unknown; multimodalModel?: unknown }
      return {
        configured: record.configured === true,
        model: typeof record.model === 'string' ? record.model : undefined,
        multimodalModel: typeof record.multimodalModel === 'string' ? record.multimodalModel : undefined,
      }
    } catch {
      return { configured: false }
    }
  }

  async extract(input: IntakeInput): Promise<ParsedSuggestion[]> {
    const result = await this.recognize(input)
    const suggestions = recognitionToLegacySuggestions(result)
    if (!suggestions.length && result.sourceSummary.requiresAction) throw new Error('DeepSeek 没有返回可执行任务')
    return suggestions
  }

  async recognize(input: IntakeInput, context: { projects: Project[]; tasks: Task[] } = { projects: [], tasks: [] }): Promise<RecognitionResult> {
    const body = {
        sourceType: input.sourceType,
        sourceTitle: (input.sourceTitle ?? input.fileName ?? '').slice(0, 160),
        content: input.content.slice(0, 24_000),
        referenceTime: (input.now ?? new Date()).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
        projectCandidates: context.projects.slice(0, 20).map((project) => ({
          projectId: project.id.slice(0, 100),
          title: project.title.slice(0, 160),
          category: project.category,
          keywords: (project.keywords ?? []).slice(0, 20).map((keyword) => keyword.slice(0, 80)),
          activeMilestones: project.milestones.filter((milestone) => milestone.status !== '已完成').map((milestone) => milestone.title.slice(0, 100)).slice(0, 6),
          recentSourceTitles: project.sourceIds.slice(-3).map((title) => title.slice(0, 160)),
          dateRange: project.milestones.length
            ? [project.milestones[0].dueAt, project.milestones[project.milestones.length - 1].dueAt]
            : [],
        })),
        existingTasks: context.tasks.filter((task) => task.status !== '已完成').slice(0, 40).map((task) => ({
          id: task.id.slice(0, 100),
          projectId: task.projectId?.slice(0, 100) ?? null,
          title: task.title.slice(0, 160),
          deadline: task.deadline,
        })),
        ...(input.multimodal
          ? {
              consent: input.multimodal.consent,
              inputMode: input.multimodal.mode,
              ocrTextIncluded: input.multimodal.ocrTextIncluded,
              images: input.multimodal.images,
            }
          : {}),
      }
    const serialized = JSON.stringify(body)
    const modelName = input.multimodal ? MULTIMODAL_MODEL_NAME : 'deepseek-v4-flash'
    const promptVersion = input.multimodal ? MULTIMODAL_PROMPT_VERSION : RECOGNITION_PROMPT_VERSION
    const key = `${promptVersion}:${modelName}:${requestHash(serialized)}`
    const cached = this.cache.get(key)
    if (cached) return structuredClone(cached)
    const running = this.inFlight.get(key)
    if (running) return running.then((result) => structuredClone(result))
    const request = this.requestRecognition(serialized, Boolean(input.multimodal)).then((result) => {
      this.cache.set(key, result)
      if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value ?? key)
      return result
    }).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request.then((result) => structuredClone(result))
  }

  private async requestRecognition(body: string, multimodal: boolean): Promise<RecognitionResult> {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), 50_000)
    try {
      const response = await fetch(`${this.endpoint}/${multimodal ? 'extract-multimodal' : 'extract'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: controller.signal,
      })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(serverMessage(data, 'DeepSeek 智能整理暂时不可用'))
      if (typeof data !== 'object' || data === null) throw new Error('DeepSeek 返回了无法识别的结果')
      return parseRecognitionResult((data as { result?: unknown }).result)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('DeepSeek 识别超时，原始来源已保存，可稍后重试', { cause: error })
      }
      throw error
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }
}

function requestHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export async function createSmartIntakeResult(
  input: IntakeInput,
  service: DeepSeekExtractionService,
): Promise<SmartIntakeResult> {
  const localResult = createIntakeResult(input)
  if (input.sourceType === 'link' && !input.content.trim()) {
    return { ...localResult, method: 'local-rules', fallbackReason: '网页正文尚未读取，仅保存链接。' }
  }
  try {
    const suggestions = await service.extract(input)
    const method = input.multimodal ? MULTIMODAL_MODEL_NAME : 'deepseek-v4-flash'
    return {
      source: { ...localResult.source, extractionMethod: method },
      suggestions,
      method,
    }
  } catch (error) {
    return {
      ...localResult,
      method: 'local-rules',
      fallbackReason: error instanceof Error ? error.message : 'DeepSeek 智能整理暂时不可用',
    }
  }
}
