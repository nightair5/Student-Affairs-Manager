import { describe, expect, it } from 'vitest'
import {
  RECOGNITION_MODEL_NAME,
  RECOGNITION_PROMPT_VERSION,
  RECOGNITION_SCHEMA_VERSION,
  recognitionPromptModules,
  recognitionSystemPrompt,
} from './prompt'

describe('Recognition 2.5 RC2 modular prompt contract', () => {
  it('keeps schema and model fixed while advancing only the prompt version', () => {
    expect(RECOGNITION_SCHEMA_VERSION).toBe('2.0')
    expect(RECOGNITION_MODEL_NAME).toBe('deepseek-v4-flash')
    expect(RECOGNITION_PROMPT_VERSION).toBe('recognition-2.5.0-rc.2')
  })

  it('composes nine unique, auditable prompt modules', () => {
    expect(recognitionPromptModules).toHaveLength(9)
    expect(new Set(recognitionPromptModules.map((module) => module.id)).size).toBe(9)
    expect(recognitionPromptModules.map((module) => module.id)).toContain('planning-contract')
    expect(recognitionSystemPrompt).toContain('DATA ONLY')
    expect(recognitionSystemPrompt).toContain('每个有业务含义的时间表达都必须成为顶层 timePoints')
    expect(recognitionSystemPrompt).toContain('材料不是任务')
    expect(recognitionSystemPrompt).toContain('先在内部完成事实清单，再做结构规划')
    expect(recognitionSystemPrompt).toContain('被动表达的义务/动作及对象')
    expect(recognitionSystemPrompt).toMatch(/Subtask.*最多一层/u)
    expect(recognitionSystemPrompt).toContain('不得使用 1970-01-01')
    expect(recognitionSystemPrompt).toContain('所有引用必须指向结果中真实存在且类型正确的 ID')
    expect(recognitionSystemPrompt).toContain('逐字存在的片段')
    expect(recognitionSystemPrompt).toContain('禁止用顶层 tasks 替代 standaloneTasks')
    expect(recognitionSystemPrompt).toContain('Ambiguity={id,field,message,options,evidenceIds}')
    expect(recognitionSystemPrompt).toContain('明确义务覆盖表')
    expect(recognitionSystemPrompt).toContain('不能用更宽泛的动作替换原谓词')
    expect(recognitionSystemPrompt).toContain('用完成标准区分 Task 与 Event')
    expect(recognitionSystemPrompt).toContain('公示期、开放窗口、维护时段或结果发布时间本身不是 Event')
    expect(recognitionSystemPrompt).toContain('禁止“阶段 1”“阶段 2”占位')
    expect(recognitionSystemPrompt).toContain('一次提交动作可以关联多个 Material')
    expect(recognitionSystemPrompt).toContain('先找出约束整个分句的谓词')
    expect(recognitionSystemPrompt).toContain('旧时间与新时间')
  })

  it('requires honest ambiguity instead of false time precision', () => {
    expect(recognitionSystemPrompt).toMatch(/relative\/vague.*normalizedValue=null.*needsConfirmation=true/u)
    expect(recognitionSystemPrompt).toContain('不得制造伪精确时间')
    expect(recognitionSystemPrompt).toContain('不能把下午三点写成 03:00')
  })
})
