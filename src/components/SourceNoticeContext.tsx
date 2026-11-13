import type {SourceNoticeContext as Context} from '../lib/sourceNoticeContext'
import {TextWithLinks} from './TextWithLinks'

/** Source excerpts stay explicitly labelled and never change saved facts. */
export function SourceNoticeContext({context}:{context:Context|null|undefined}){
  if(!context||!context.sections.length&&!context.omitted)return null
  const groups=[
    {kind:'time',label:'原通知时间'},
    {kind:'overview',label:'通知中的活动介绍（原文）'},
    {kind:'context',label:'通知中的条件与岗位说明（原文）'},
    {kind:'process',label:'通知中的组织方流程（原文）'},
    {kind:'roles',label:'通知中的岗位与分工（原文）'},
    {kind:'notice',label:'通知中的参加说明（原文）'},
  ] as const
  return <div className="source-notice-context">{groups.map(group=>{
    const items=context.sections.filter(item=>item.kind===group.kind)
    return items.length?<section className="detail-primary-section" key={group.kind} aria-label={group.label}><h3>{group.label}</h3>{items.map((item,index)=><p key={`${group.kind}-${index}`}><TextWithLinks text={item.text}/></p>)}</section>:null
  })}{context.omitted&&<p>还有其他通知内容，请在“编辑与更多”中查看完整原文。</p>}</div>
}
