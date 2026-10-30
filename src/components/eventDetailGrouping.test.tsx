import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {eventDescriptionSections} from '../lib/eventPresentation'
import {CompactEventDetailPanel} from './CompactEventDetailPanel'
import type {Event} from '../types'

describe('event details keep distinct information without repeated blocks',()=>{
 it('groups different notes and removes only exact repeated notes',()=>{
  const description='活动内容：介绍新闻实践。\n活动内容：交流资料准备。\n参加须知：提前入场。\n参加须知：自愿参加。\n参加须知：提前入场。'
  const sections=eventDescriptionSections(description)
  expect(sections.filter(s=>s.label==='活动内容')).toEqual([{label:'活动内容',content:'介绍新闻实践。\n交流资料准备。'}])
  expect(sections.filter(s=>s.label==='参加须知')).toEqual([{label:'参加须知',content:'提前入场。\n自愿参加。'}])
 })
 it('does not repeat the title as an activity description',()=>{
  const event:Event={id:'event',title:'新闻实践讲座',description:'新闻实践讲座\n活动内容：介绍新闻实践。\n参加须知：提前入场。',startAt:null,endAt:null,evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:''}
  const html=renderToStaticMarkup(<CompactEventDetailPanel event={event} evidenceQuotes={[]} sourceTitles={[]} onClose={()=>undefined}/>)
  expect(html.match(/新闻实践讲座/gu)).toHaveLength(1)
  expect(html).toContain('介绍新闻实践。')
  expect(html).toContain('提前入场。')
  expect(event.description).toContain('新闻实践讲座')
 })
})
