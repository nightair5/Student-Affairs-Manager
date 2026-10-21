import {describe,expect,it} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {bindOrdinaryProviderSupport} from './ordinaryProviderSupport'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {citedDocumentNames} from './citedDocumentName'
import {sourceReviewProblem} from '../domain/v2/sourceReviewD26'

const source='请登录\n青溪学院官网（\nhttps://example.edu.cn/），通过“投稿”板块提交电子文稿，稿件标题格式统一标注为“匿名编号+论文题目”。'
const channel='青溪学院官网（https://example.edu.cn/）“投稿”板块'
function fixture(text=source){
  const result=ordinaryWorkflowFixture()
  result.standaloneTasks[0]={...result.standaloneTasks[0],title:'提交论文电子文稿',actionVerb:'提交',actionObject:'论文电子文稿',description:'提交论文电子文稿',evidenceIds:['e-delivery']}
  result.materials[0]={...result.materials[0],name:'论文电子文稿',submissionChannel:channel,evidenceIds:['e-delivery']}
  result.evidence=[{id:'e-delivery',sourceId:'source-one',quote:text,field:'description'}]
  return result
}
function first(text=source,result=fixture(text)){
  const input={sourceId:'source-one',sourceVersionId:'version-one',sourceText:text,referenceTime:'2026-10-21T00:00:00Z',timezone:'Asia/Shanghai'}
  const bound=bindOrdinaryProviderSupport(result,input,JSON.stringify(result))
  return assembleProductFirstSuggestion(bound.result,input)
}
describe('same-instruction document title establishes a closed compound name',()=>{
  it('accepts two already cited adjacent pieces of one instruction, retaining both proof IDs',()=>{
    const result=fixture(), [a,b]=source.split('，稿件标题')
    result.evidence=[{id:'e-action',sourceId:'source-one',quote:a,field:'description'},{id:'e-name',sourceId:'source-one',quote:'稿件标题'+b,field:'description'}]
    result.standaloneTasks[0].evidenceIds=['e-action','e-name'];result.materials[0].evidenceIds=['e-action','e-name']
    expect(citedDocumentNames(result,source)[0].evidenceIds).toEqual(['e-action','e-name'])
    expect(first(source,result).result.standaloneTasks[0].selected).toBe(true)
    for(const separator of ['。','；','，提交另一份申请，'])expect(citedDocumentNames(result,a+separator+'稿件标题'+b)).toEqual([])
  })
  it('preserves an existing object, channel, evidence and selection without inventing a material',()=>{
    const original=fixture(),copy=structuredClone(original),out=first(source,original)
    expect(out.result.standaloneTasks[0]).toMatchObject({title:'提交论文电子文稿',actionObject:'论文电子文稿',selected:true})
    expect(out.result.materials[0].submissionChannel).toBe(channel)
    expect(out.result.evidence).toEqual(original.evidence)
    expect(out.audit.citedDocumentNames?.[0]).toMatchObject({declaredObject:'论文电子文稿',literalObject:'电子文稿',rule:'SAME_DELIVERY_EXPLICIT_DOCUMENT_TITLE'})
    expect(out.materialChannelAudit.decisions[0].documentNameProof).toBeDefined()
    expect(sourceReviewProblem(out.result,'task-upload')).toBeUndefined()
    expect(original).toEqual(copy)
  })
  it('follows changed genre, object and destination rather than notice identity',()=>{
    const text=source.replaceAll('论文','调研报告').replaceAll('电子文稿','电子文件').replaceAll('青溪','北塘')
    const result=fixture(text);result.standaloneTasks[0].actionObject='调研报告电子文件';result.materials[0].name='调研报告电子文件';result.materials[0].submissionChannel=channel.replace('青溪','北塘')
    const out=first(text,result)
    expect(out.result.standaloneTasks[0].title).toBe('提交调研报告电子文件')
    expect(out.result.materials[0].submissionChannel).toBe(channel.replace('青溪','北塘'))
  })
  it('accepts the same material stated by its full literal short form, never an arbitrary suffix',()=>{
    const result=fixture();result.materials[0].name='电子文稿'
    const out=first(source,result)
    expect(out.result.standaloneTasks[0]).toMatchObject({title:'提交论文电子文稿',selected:true})
    expect(out.result.materials[0]).toMatchObject({name:'电子文稿',submissionChannel:channel,relatedTaskTempIds:['task-upload']})
    result.materials[0].name='文稿'
    expect(citedDocumentNames(result,source)).toEqual([])
  })
  it.each([
    ['different genre',source.replace('论文题目','报告题目')],
    ['different material',source.replace('提交电子文稿','提交纸质文稿')],
    ['another sentence',source.replace('，稿件标题','。稿件标题')],
    ['another action',source.replace('，稿件标题','，提交申请书，稿件标题')],
    ['negated',source.replace('提交电子文稿','不要提交电子文稿')],
    ['cancelled',source.replace('提交电子文稿','取消提交电子文稿')],
    ['conditional',source.replace('请登录','如果登录')],
    ['missing naming instruction',source.replace('稿件标题格式统一标注为','背景介绍')],
  ])('does not borrow support for %s',(_label,text)=>{
    expect(citedDocumentNames(fixture(text),text)).toEqual([])
    expect(first(text).result.standaloneTasks[0].selected).toBe(false)
  })
  it.each(['foreign source','missing quote','wrong owner','two owners','two documents','duplicated passage'])('rejects %s',kind=>{
    const result=fixture();let text=source
    if(kind==='foreign source'){result.evidence.push({id:'foreign',sourceId:'source-two',quote:'外部资料',field:'description'});result.standaloneTasks[0].evidenceIds.push('foreign');text+='外部资料'}
    if(kind==='missing quote')result.evidence[0].quote='原文没有的内容'
    if(kind==='wrong owner')result.materials[0].relatedTaskTempIds=['unrelated']
    if(kind==='two owners')result.materials[0].relatedTaskTempIds.push('other')
    if(kind==='two documents')result.materials.push({...result.materials[0],tempId:'other',name:'报告电子文稿'})
    if(kind==='duplicated passage')text+='\n'+source
    expect(citedDocumentNames(result,text)).toEqual([])
  })
  it('retains an explicit model conflict and never substitutes a different destination',()=>{
    const result=fixture();result.materials[0].submissionChannel='另一个服务台'
    result.conflicts.push({id:'model-conflict',type:'other',message:'原答已有冲突',entityTempIds:['task-upload'],evidenceIds:['e-delivery'],requiresDecision:true})
    const out=first(source,result)
    expect(out.result.materials[0].submissionChannel).toBeNull()
    expect(out.result.conflicts.some(c=>c.id==='model-conflict')).toBe(true)
    expect(sourceReviewProblem(out.result,'task-upload')).toBeTruthy()
  })
})
