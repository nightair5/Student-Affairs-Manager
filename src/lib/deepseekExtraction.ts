import type { IntakeInput, IntakeResult } from './intake'
import { createIntakeResult } from './intake'
import type { ParsedSuggestion } from '../types'
import type { Project, Task } from '../types'
import { parseRecognitionResult } from '../recognition/schema'
import { recognitionToLegacySuggestions } from '../recognition/pipeline'
import type { RecognitionResult } from '../recognition/types'
import { RECOGNITION_PROMPT_VERSION } from '../recognition/prompt'
import { MULTIMODAL_MODEL_NAME, MULTIMODAL_PROMPT_VERSION } from './multimodal'
import { bindOrdinaryProviderSupport, type OrdinaryProviderSidecar } from '../recognition/ordinaryProviderSupport'
import {ObservedRecognitionError,unobservedDiagnostic,responseDiagnostic,registerRecognitionDiagnostic,type RecognitionRequestDiagnostic} from '../recognition/requestDiagnostic'

export type SmartExtractionMethod = 'deepseek-v4-flash' | 'deepseek-v4-flash-vision-exp' | 'local-rules'

export interface SmartIntakeResult extends IntakeResult {
  method: SmartExtractionMethod
  fallbackReason?: string
}

export interface RecognitionContextSelection {
  projectIds: string[]
  taskIds: string[]
}

export interface RecognitionWorkspaceContext {
  projects: Project[]
  tasks: Task[]
  /** Only IDs explicitly selected in the submit UI may leave the device. */
  cloudSelection?: RecognitionContextSelection
}

export interface DeepSeekExtractionService {
  status(): Promise<{ configured: boolean; model?: string; multimodalModel?: string }>
  extract(input: IntakeInput): Promise<ParsedSuggestion[]>
  recognize?(input: RecognitionServiceInput, context?: RecognitionWorkspaceContext, options?: RecognitionRequestOptions): Promise<RecognitionResult>
  /** Capture-bound local audit. This accessor never calls the provider. */
  semanticSidecar?(sourceId: string, sourceVersionId: string): unknown
}

export interface RecognitionRequestOptions {
  /** One explicit retry gets a new ID; repeated delivery of that attempt joins it. */
  attemptId?: string
  /** A transient status failure is not proof that the extraction endpoint is unconfigured. */
  allowStatusUnknown?: boolean
}

export interface RecognitionServiceInput extends IntakeInput {
  sourceId?: string
  sourceVersionId?: string
}

interface ProxyRecognitionObservation {
  result: RecognitionResult
  originalProxyResponse: string
  diagnostic:RecognitionRequestDiagnostic
}

function serverMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback
  const message = (value as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export class ProxyDeepSeekExtractionService implements DeepSeekExtractionService {
  private readonly cache = new Map<string, ProxyRecognitionObservation>()
  private readonly inFlight = new Map<string, Promise<ProxyRecognitionObservation>>()
  private readonly sidecars = new Map<string, OrdinaryProviderSidecar>()
  private configuredState: boolean | null = null
  private statusAttempted = false
  private statusInFlight: Promise<{ configured: boolean; model?: string; multimodalModel?: string }> | null = null

  constructor(private readonly endpoint = '/api/deepseek', private readonly statusTimeoutMs = 5_000) {}

  status(): Promise<{ configured: boolean; model?: string; multimodalModel?: string }> {
    // Join concurrent checks, but never cache a failed check for the page lifetime.
    if (this.statusInFlight) return this.statusInFlight
    const pending = this.requestStatus().finally(() => {
      if (this.statusInFlight === pending) this.statusInFlight = null
    })
    this.statusInFlight = pending
    return pending
  }

  private async requestStatus(): Promise<{ configured: boolean; model?: string; multimodalModel?: string }> {
    this.statusAttempted = true
    try {
      const response = await fetch(`${this.endpoint}/status`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(this.statusTimeoutMs) })
      if (!response.ok) { this.configuredState = null; return { configured: false } }
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null) { this.configuredState = null; return { configured: false } }
      const record = data as { configured?: unknown; model?: unknown; multimodalModel?: unknown }
      this.configuredState = typeof record.configured === 'boolean' ? record.configured : null
      return {
        configured: record.configured === true,
        model: typeof record.model === 'string' ? record.model : undefined,
        multimodalModel: typeof record.multimodalModel === 'string' ? record.multimodalModel : undefined,
      }
    } catch {
      this.configuredState = null
      return { configured: false }
    }
  }

  async extract(input: IntakeInput): Promise<ParsedSuggestion[]> {
    const result = await this.recognize(input)
    const suggestions = recognitionToLegacySuggestions(result)
    if (!suggestions.length && result.sourceSummary.requiresAction) throw new Error('DeepSeek 没有返回可执行任务')
    return suggestions
  }

  semanticSidecar(sourceId: string, sourceVersionId: string): OrdinaryProviderSidecar | undefined {
    const value = this.sidecars.get(sourceId)
    return value?.ordinaryProviderSupport.sourceVersionId === sourceVersionId ? structuredClone(value) : undefined
  }

  async recognize(input: RecognitionServiceInput, context: RecognitionWorkspaceContext = { projects: [], tasks: [] }, options: RecognitionRequestOptions = {}): Promise<RecognitionResult> {
    if (this.statusAttempted && (this.configuredState === false || (this.configuredState === null && !options.allowStatusUnknown))) throw new ObservedRecognitionError(this.configuredState === false ? 'DeepSeek 尚未配置，来源内容未发送。' : 'AI 服务暂时不可用，来源内容未发送。',unobservedDiagnostic(this.configuredState===false?'NOT_CONFIGURED':'STATUS_UNAVAILABLE'))
    if (Boolean(input.sourceId) !== Boolean(input.sourceVersionId)) throw new Error('ORDINARY_PROVIDER_CAPTURE_REQUIRED')
    // A failed response must not expose an earlier source version's audit.
    if (input.sourceId) this.sidecars.delete(input.sourceId)
    const selectedProjects = context.cloudSelection
      ? context.projects.filter((project) => context.cloudSelection!.projectIds.includes(project.id)).slice(0, 20)
      : []
    const selectedTasks = context.cloudSelection
      ? context.tasks.filter((task) => context.cloudSelection!.taskIds.includes(task.id)).slice(0, 40)
      : []
    const selectedContext = selectedProjects.length || selectedTasks.length ? {
      contextSelection: { projectIds: selectedProjects.map((item) => item.id), taskIds: selectedTasks.map((item) => item.id) },
      projectCandidates: selectedProjects.map((project) => ({
        projectId: project.id.slice(0, 100), title: project.title.slice(0, 160), category: project.category,
        keywords: [], activeMilestones: [], recentSourceTitles: [], dateRange: [],
      })),
      existingTasks: selectedTasks.map((task) => ({
        id: task.id.slice(0, 100), projectId: task.projectId?.slice(0, 100) ?? null,
        title: task.title.slice(0, 160), deadline: task.deadline,
      })),
    } : {}
    const body = {
        sourceType: input.sourceType,
        sourceTitle: (input.sourceTitle ?? input.fileName ?? '').slice(0, 160),
        content: input.content.slice(0, 24_000),
        referenceTime: (input.now ?? new Date()).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
        ...selectedContext,
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
    // Bind cache identity to the complete request. A short noncryptographic
    // hash alone must never substitute another notice's response.
    const key = JSON.stringify([promptVersion,modelName,serialized,options.attemptId ?? null])
    const capture = (observation: ProxyRecognitionObservation,reused=false) => {
      const diagnostic={...observation.diagnostic,responseReuse:reused,...(options.attemptId?{attemptId:options.attemptId}: {})}
      const markSourceCoverage=(result:RecognitionResult)=>{
        if(input.content.length>body.content.length){
          result.quality.needsHumanReview=true
          result.quality.reviewReasons=[...new Set([...result.quality.reviewReasons,'通知后半部分未发送，部分内容尚未完整整理。'])]
        }
        return result
      }
      if (!input.sourceId || !input.sourceVersionId) return registerRecognitionDiagnostic(markSourceCoverage(structuredClone(observation.result)),diagnostic)
      const bound = bindOrdinaryProviderSupport(observation.result, {
        sourceId: input.sourceId, sourceVersionId: input.sourceVersionId, sourceText: input.content,
        processedSourceText: body.content, referenceTime: body.referenceTime, timezone: body.timezone,
      }, observation.originalProxyResponse)
      this.sidecars.set(input.sourceId, bound.sidecar)
      if (this.sidecars.size > 20) this.sidecars.delete(this.sidecars.keys().next().value ?? input.sourceId)
      return registerRecognitionDiagnostic(markSourceCoverage(bound.result),diagnostic)
    }
    const cached = this.cache.get(key)
    if (cached) return capture(cached,true)
    const running = this.inFlight.get(key)
    if (running) return running.then(value=>capture(value,true))
    const request = this.requestRecognition(serialized, Boolean(input.multimodal)).then((result) => {
      this.cache.set(key, result)
      if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value ?? key)
      return result
    }).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request.then(value=>capture(value))
  }

  private async requestRecognition(body: string, multimodal: boolean): Promise<ProxyRecognitionObservation> {
    const controller = new AbortController()
    const timeout = globalThis.setTimeout(() => controller.abort(), 50_000)
    const started=Date.now()
    let diagnostic:RecognitionRequestDiagnostic={...unobservedDiagnostic('TIMEOUT_OR_NETWORK'),state:'uncertain'}
    try {
      const response = await fetch(`${this.endpoint}/${multimodal ? 'extract-multimodal' : 'extract'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: controller.signal,
      })
      // This is the proxy boundary, not the supplier's raw model response.
      // Keep the original body independently of source binding and first UI.
      const originalProxyResponse = await response.text()
      let data: unknown = null
      try { data = JSON.parse(originalProxyResponse) } catch { /* Preserve existing invalid-response behavior. */ }
      diagnostic=responseDiagnostic(data,response.status,Date.now()-started)
      if (!response.ok) throw new ObservedRecognitionError(serverMessage(data, 'DeepSeek 智能整理暂时不可用'),{...diagnostic,reason:'HTTP_ERROR'})
      if (typeof data !== 'object' || data === null) throw new ObservedRecognitionError('DeepSeek 返回了无法识别的结果',{...diagnostic,reason:'INVALID_JSON'})
      try {return {result:parseRecognitionResult((data as {result?:unknown}).result),originalProxyResponse,diagnostic}}
      catch(error){throw new ObservedRecognitionError('AI 回答格式未通过校验（RecognitionResult 2.0），原始来源已保存，可重试。',{...diagnostic,reason:'SCHEMA_ERROR'},{cause:error})}
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ObservedRecognitionError('DeepSeek 识别超时，原始来源已保存，可稍后重试',{...diagnostic,elapsedMs:Date.now()-started}, { cause: error })
      }
      if(error instanceof ObservedRecognitionError)throw error
      throw new ObservedRecognitionError('AI 服务暂时不可用，原始来源已保存，可重试。',{...diagnostic,elapsedMs:Date.now()-started},{cause:error})
    } finally {
      globalThis.clearTimeout(timeout)
    }
  }
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
