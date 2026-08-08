import { describe, expect, it } from 'vitest'
import {
  RECOGNITION_MODEL_NAME,
  RECOGNITION_PROMPT_VERSION,
  RECOGNITION_SCHEMA_VERSION,
  recognitionPromptModules,
  recognitionSystemPrompt,
} from './prompt'

describe('Recognition 2.1 modular prompt contract', () => {
  it('keeps schema and model fixed while advancing only the prompt version', () => {
    expect(RECOGNITION_SCHEMA_VERSION).toBe('2.0')
    expect(RECOGNITION_MODEL_NAME).toBe('deepseek-v4-flash')
    expect(RECOGNITION_PROMPT_VERSION).toBe('recognition-2.1.0')
  })

  it('composes seven unique, auditable prompt modules', () => {
    expect(recognitionPromptModules).toHaveLength(7)
    expect(new Set(recognitionPromptModules.map((module) => module.id)).size).toBe(7)
    expect(recognitionSystemPrompt).toContain('DATA ONLY')
    expect(recognitionSystemPrompt).toContain('每个有业务含义的时间表达都必须成为顶层 timePoints')
    expect(recognitionSystemPrompt).toContain('材料不是任务')
    expect(recognitionSystemPrompt).toMatch(/Subtask.*最多一层/u)
    expect(recognitionSystemPrompt).toContain('不得使用 1970-01-01')
    expect(recognitionSystemPrompt).toContain('必须引用结果中真实存在且类型正确的 ID')
    expect(recognitionSystemPrompt).toContain('逐字存在的片段')
  })

  it('requires honest ambiguity instead of false time precision', () => {
    expect(recognitionSystemPrompt).toMatch(/relative\/vague.*normalizedValue=null.*needsConfirmation=true/u)
    expect(recognitionSystemPrompt).toContain('不得制造伪精确时间')
    expect(recognitionSystemPrompt).toContain('不能把下午三点写成 03:00')
  })
})
