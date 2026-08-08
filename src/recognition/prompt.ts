import { composeRecognitionSystemPrompt, recognitionPromptModules } from './promptModules'

export const RECOGNITION_PROMPT_VERSION = 'recognition-2.1.0'
export const RECOGNITION_SCHEMA_VERSION = '2.0' as const
export const RECOGNITION_MODEL_NAME = 'deepseek-v4-flash'

export { recognitionPromptModules }

export const recognitionSystemPrompt = composeRecognitionSystemPrompt({
  promptVersion: RECOGNITION_PROMPT_VERSION,
  schemaVersion: RECOGNITION_SCHEMA_VERSION,
  modelName: RECOGNITION_MODEL_NAME,
})

export const recognitionPromptMetadata = Object.freeze({
  promptVersion: RECOGNITION_PROMPT_VERSION,
  schemaVersion: RECOGNITION_SCHEMA_VERSION,
  modelName: RECOGNITION_MODEL_NAME,
  createdAt: '2026-08-08T14:30:00.000Z',
})
