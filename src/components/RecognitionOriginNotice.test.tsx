import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {DirectResultList,RecentDirectAdditions} from './DirectResultList'
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
 it('moves a completed batch notice into history while keeping unfinished fallback visible',()=>{
  const workspace=createGoldenWorkspaceV8(),event=workspace.events[0]
  const batch={id:'b',sourceId:workspace.sources[0].id,status:'active',items:[{id:event.id,kind:'event'}],origin:'local',fallbackReason:'network',processing:'partial'} as unknown as DirectBatch
  const render=()=>renderToStaticMarkup(<RecentDirectAdditions workspace={workspace} batches={[batch]} onRetry={async()=>{}} onUndo={async()=>{}} onOpen={()=>{}}/>)
  expect(render().split('<details')[0]).toContain('部分内容待补充')
  event.legacyData={...event.legacyData,personalCompletionV1:true}
  const completed=render()
  expect(completed.split('<details')[0]).not.toContain('部分内容待补充')
  expect(completed).toContain('最近的添加记录')
  expect(completed).toContain('重新整理')
 })
})
