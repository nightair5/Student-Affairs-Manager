import {describe,it,expect} from 'vitest'
import {sourceWindowDisplayLabel} from './sourceWindowDisplay'
const raw='2027年3月8日09:00—11:00',declaration={version:'source-window-declarations-1.0.0',ownerTaskId:'T',sourceVersionId:'V',windows:[{state:'RESOLVED_DISCRETE',rawText:raw,pointIds:['S','E']}]}
const points=[{id:'S',taskId:'T',relatedTaskIds:['T']},{id:'E',taskId:'T',relatedTaskIds:['T']}],versions=[{id:'V',rawText:'纸质件请在'+raw+'递交。'}]
describe('stored source-window display',()=>{
 it('uses the real source quotation and owner without deriving a cutoff or a personal slot',()=>{
  expect(sourceWindowDisplayLabel('T',declaration,points,versions)).toBe(raw)
  expect(sourceWindowDisplayLabel('OTHER',declaration,points,versions)).toBeUndefined()
 })
 it('does not display a missing/foreign endpoint or a quote absent from the exact source version',()=>{
  expect(sourceWindowDisplayLabel('T',declaration,points.slice(0,1),versions)).toBeUndefined()
  expect(sourceWindowDisplayLabel('T',declaration,points.map(p=>({...p,taskId:'OTHER'})),versions)).toBeUndefined()
  expect(sourceWindowDisplayLabel('T',declaration,points,[{id:'V2',rawText:raw}])).toBeUndefined()
  expect(sourceWindowDisplayLabel('T',declaration,points,[{id:'V',rawText:'另一日期'}])).toBeUndefined()
 })
 it('keeps unresolved declarations as unresolved rather than presenting a fixed interval',()=>expect(sourceWindowDisplayLabel('T',{...declaration,windows:[{...declaration.windows[0],state:'UNRESOLVED'}]},points,versions)).toBeUndefined())
})
