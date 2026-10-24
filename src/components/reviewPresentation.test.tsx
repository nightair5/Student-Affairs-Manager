import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {reviewEventTime} from './reviewEventSummary'
import {intakeFailureMessage} from '../lib/intakeError'
import {buildLocalRecognition,recognitionToLegacySuggestions} from '../recognition/pipeline'
import {createExtractionDraft} from '../lib/workspace'
import {DraftReviewPanel} from './DraftReviewPanel'
const noop=()=>undefined
const notice='11月2日下午2点在A101召开论文答辩说明会，请准时参加。'
const result=()=>buildLocalRecognition({content:notice,sourceType:'text',sourceTitle:'匿名通知',referenceTime:new Date('2026-10-24T09:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
describe('results-first review keeps facts and uncertainty',()=>{
 it('puts the actual cards before collapsed diagnostics without deleting evidence or conflicts',()=>{
  const r=result();r.quality.needsHumanReview=true;r.quality.reviewReasons=['工程检查原因'];r.conflicts=[{id:'conflict',type:'deadline',message:'两处时间不一致，请核对',entityTempIds:[],evidenceIds:[],requiresDecision:true}]
  const d=createExtractionDraft('source',recognitionToLegacySuggestions(r),'2026-10-24T01:00:00Z',r)
  const html=renderToStaticMarkup(<DraftReviewPanel draft={d} source={null} projects={[]} projectWillCreate={false} onClose={noop} onUpdate={noop} onConfirm={noop} onReject={noop} onConfirmAll={noop} onProjectChoice={noop} onKeepExplicit={noop} onMoveTask={noop} onToggleRecognitionEntity={noop} onToggleTaskSelected={noop} onSplitTask={noop} onMergeTask={noop} />)
  expect(html.indexOf('识别出的任务和事件')).toBeLessThan(html.indexOf('class="review-context"'))
  expect(html).toContain('两处时间不一致，请核对');expect(html).toContain('原始通知与定位依据')
  expect(html).not.toContain('class="review-context" open')
 })
 it('shows exact clock ranges without repeating the source quote',()=>{
  const p=result().timePoints[0],start={...p,normalizedValue:'2026-11-02T14:00',needsConfirmation:false},end={...p,normalizedValue:'2026-11-02T15:30',needsConfirmation:false}
  const label=reviewEventTime(start,end);expect(label).toContain('14:00–15:30');expect(label).not.toContain('T14:00');expect(label).not.toContain('原文：')
 })
 it('keeps a date-only event date-only, and never fills a missing end',()=>{
  const p={...result().timePoints[0],normalizedValue:'2026-11-02',precision:'date_only' as const,needsConfirmation:false}
  expect(reviewEventTime(p)).not.toMatch(/00:00|23:59/);expect(reviewEventTime(p)).toContain('结束时间未说明')
 })
 it('does not suppress tentative times or fabricate a start',()=>{
  const p={...result().timePoints[0],rawText:'暂定11月2日下午',needsConfirmation:true}
  expect(reviewEventTime(p)).toContain('待核对');expect(reviewEventTime(undefined,p)).toMatch(/^结束：/)
 })
 it('explains failed persistence without promising a saved source or telling users to erase it',()=>{
  const text=intakeFailureMessage('QuotaExceededError');expect(text).toContain('没能完成浏览器内的保存');expect(text).toContain('不要清空已有数据');expect(text).not.toContain('QuotaExceededError');expect(text).not.toContain('没有开始识别')
  expect(intakeFailureMessage('Failed to fetch')).toContain('网络');expect(intakeFailureMessage('other')).toContain('输入仍在')
 })
})
