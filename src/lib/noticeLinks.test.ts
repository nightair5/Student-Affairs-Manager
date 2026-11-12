import {describe,expect,it,vi} from 'vitest'
import {noticeLinkMessage,planNoticeLinks,readNoticeLinks} from './noticeLinks'
import {LinkExtractionError} from './linkExtraction'

const page=(text:string)=>({finalUrl:'https://school.example/notice',title:'公开通知',text,fetchedAt:'2026-11-04T01:00:00Z',partial:false})
describe('one-click notice link reading',()=>{
 it('reads an explicit notice page but does not submit forms or join meetings',async()=>{
  const input='通知原文 https://school.example/notice；报名问卷 https://forms.example/form/1；会议链接 https://meeting.example/meeting/1'
  const plan=planNoticeLinks(input),reader=vi.fn(async()=>page('11月8日17:00前提交申请表。'))
  const result=await readNoticeLinks(input,plan,true,reader)
  expect(plan.links.map(link=>link.role)).toEqual(['notice','action','meeting'])
  expect(reader).toHaveBeenCalledTimes(2)
  expect(result.content).toContain('11月8日17:00前提交申请表')
  expect(result.links.map(link=>link.status)).toEqual(['read','read','skipped'])
  expect(result.segments[1]).toMatchObject({kind:'web',url:'https://school.example/notice'})
  expect(result.content.slice(result.segments[1].start,result.segments[1].end)).toContain('提交申请表')
 })
 it('preserves pasted text on failure and never turns a bare inaccessible URL into a result',async()=>{
  const reader=vi.fn(async()=>{throw Error('offline')})
  const mixed='请提交课程作业。详情 https://school.example/unavailable'
  expect(await readNoticeLinks(mixed,planNoticeLinks(mixed),true,reader)).toMatchObject({content:mixed,partial:true,failed:false,unreadCount:1})
  const only='https://school.example/unavailable'
  expect(await readNoticeLinks(only,planNoticeLinks(only),true,reader)).toMatchObject({content:only,partial:true,failed:true})
 })
 it('limits explicit links and reports the skipped pages',async()=>{
  const input=[1,2,3,4].map(n=>`通知原文 https://school.example/${n}`).join('\n'),reader=vi.fn(async()=>page('提交材料。'))
  const out=await readNoticeLinks(input,planNoticeLinks(input),true,reader)
  expect(reader).toHaveBeenCalledTimes(3);expect(out.unreadCount).toBe(1);expect(out.partial).toBe(true)
  expect(noticeLinkMessage(out)).toContain('第 4 个链接未读取')
  expect(noticeLinkMessage(out)).toContain('单独粘贴未读取的链接')
 })
 it('never sends pasted credentials to the service and removes sensitive page links',async()=>{
  expect(()=>planNoticeLinks('正文 https://school.example/a?token=private')).toThrow('访问凭据')
  expect(()=>planNoticeLinks('https://user:password@school.example/')).toThrow('访问凭据')
  expect(()=>planNoticeLinks('正文 https://school.example/a?X-Amz-Signature=private')).toThrow('访问凭据')
  expect(()=>planNoticeLinks('正文 https://school.example/a#%74oken=private')).toThrow('访问凭据')
  const input='https://school.example/notice'
  const out=await readNoticeLinks(input,planNoticeLinks(input),true,async()=>page('提交链接 https://school.example/form?token=private'))
  expect(out.content).not.toContain('token=private');expect(out.partial).toBe(true)
  const signed=await readNoticeLinks(input,planNoticeLinks(input),true,async()=>page('附件 https://school.example/file?afc=private'))
  expect(signed.content).not.toContain('afc=private');expect(signed.partial).toBe(true)
 })
 it('reports unsupported or deliberately disabled links without performing network requests',async()=>{
  const reader=vi.fn(async()=>page('正文'))
  const input='请提交作业。详情 http://school.example/notice'
  const out=await readNoticeLinks(input,planNoticeLinks(input),true,reader)
  expect(out.partial).toBe(true);expect(out.unreadCount).toBe(1);expect(reader).not.toHaveBeenCalled()
  const url='https://school.example/notice'
  expect((await readNoticeLinks(url,planNoticeLinks(url),false,reader)).failed).toBe(true)
 })
 it('marks over-budget text as partial instead of claiming a complete result',async()=>{
  const input='https://school.example/notice'
  const out=await readNoticeLinks(input,planNoticeLinks(input),true,async()=>page('通知内容'.repeat(7000)))
  expect(out.partial).toBe(true)
  expect(noticeLinkMessage(out)).toContain('部分内容未进入整理')
 })
 it('explains different failed links separately without exposing their URLs',async()=>{
  const input='请参加活动。详情 https://school.example/notice\n问卷 https://forms.example/form/1'
  const out=await readNoticeLinks(input,planNoticeLinks(input),true,async url=>{
   throw new LinkExtractionError('fixture',url.includes('/form/')?'WEB_TEXT_EMPTY':'WEB_RESPONSE_TOO_LARGE')
  })
  const message=noticeLinkMessage(out)
  expect(out.content).toBe(input);expect(out.partial).toBe(true)
  expect(message).toContain('第 1 个链接：网页内容超过读取上限')
  expect(message).toContain('第 2 个链接：网页没有返回可读取正文')
  expect(message).not.toContain('school.example');expect(message).not.toContain('forms.example')
 })
})
