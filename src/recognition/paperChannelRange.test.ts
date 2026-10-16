import {describe,expect,it} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion,groundMaterialChannels} from './materialChannelGrounding'
import {parseRecognitionResult} from './schema'

function paper(source='纸质版：签字承诺函，2027年3月19日09:30—11:30交到明溪学生服务窗口。') {
  const r=ordinaryWorkflowFixture(source),task=r.standaloneTasks[0],material=r.materials[0]
  task.title='交签字承诺函';task.actionVerb='交';task.actionObject='签字承诺函'
  task.description=source;task.evidenceIds=['P'];task.completionCriteria=['签字承诺函交到明溪学生服务窗口']
  material.name='签字承诺函';material.submissionChannel='明溪学生服务窗口';material.evidenceIds=['P']
  r.evidence=[{id:'P',sourceId:'pending-source',quote:source,field:'materials'}]
  r.events=[];r.timePoints=[];task.timePointTempIds=[]
  return {source,r}
}

describe('cited paper delivery window retains its existing destination',()=>{
  it.each(['—','–','-'])('accepts a complete clock range with %s without filling any fact',separator=>{
    const {source,r}=paper(`纸质版：签字承诺函，2027年3月19日09:30${separator}11:30交到明溪学生服务窗口。`)
    const original=structuredClone(r),first=assembleCurrentFirstSuggestion(parseRecognitionResult(r),{
      sourceText:source,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
    expect(first.result.materials[0].submissionChannel).toBe('明溪学生服务窗口')
    expect(first.result.conflicts.filter(c=>c.id.startsWith('material-channel:'))).toEqual([])
    expect(first.result.standaloneTasks[0].selected).not.toBe(false)
    expect(first.result.timePoints).toEqual([]) // no invented endpoint or deadline
    expect(r).toEqual(original)
  })
  it.each([
    '纸质版：签字承诺函，2027年3月19日09:30—11:30请勿交到明溪学生服务窗口。',
    '纸质版：签字承诺函，2027年3月19日09:30—11:30如果交到明溪学生服务窗口，请等通知。',
    '纸质版：签字承诺函，另有请假单，2027年3月19日09:30—11:30交到明溪学生服务窗口。',
    '纸质版：签字承诺函，2027年3月19日09:30—待定交到明溪学生服务窗口。',
    '纸质版：签字承诺函，2027年3月19日09:30—11:30交到另一服务窗口。',
  ])('does not bless missing, conditional or other-object delivery: %s',source=>{
    const {r}=paper(source)
    expect(groundMaterialChannels(r,source).result.materials[0].submissionChannel).toBeNull()
  })
  it('keeps missing destinations and broken ownership blocked',()=>{
    const {source,r}=paper();r.materials[0].submissionChannel=null
    expect(groundMaterialChannels(r,source).result.materials[0].submissionChannel).toBeNull()
    r.materials[0].submissionChannel='明溪学生服务窗口';r.standaloneTasks[0].materialTempIds=[]
    expect(groundMaterialChannels(r,source).result.materials[0].submissionChannel).toBeNull()
  })
})
