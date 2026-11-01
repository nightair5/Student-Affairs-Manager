import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {DirectResultList} from './DirectResultList'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import type {DirectBatch} from '../domain/v2/directIntake'

describe('visible recognition origin',()=>{
 it('keeps fallback provenance visible even when some content is incomplete',()=>{
  const batch={version:'direct-mode-1.0',items:[],origin:'local',fallbackReason:'network',processing:'partial'} as unknown as DirectBatch
  const noop=async()=>{}
  const html=renderToStaticMarkup(<DirectResultList workspace={createGoldenWorkspaceV8()} batch={batch} onClose={()=>{}} onUndo={noop} onDelete={noop} onEdit={noop} onDetail={()=>{}}/>)
  expect(html).toContain('AI 暂时不可用，已用简单规则整理');expect(html).toContain('部分内容待补充')
  expect(html).not.toContain('AI 已整理')
 })
})
