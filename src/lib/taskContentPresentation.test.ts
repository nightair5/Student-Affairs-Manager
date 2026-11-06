import {describe,it,expect} from 'vitest'
import {taskPublicDescription} from './taskContentPresentation'

describe('source layout in public task content',()=>{
 it('preserves repeated year and unit fragments belonging to different dates',()=>{
  const description='办理时段：202\n6\n年\n10\n月\n28\n日—\n202\n6\n年\n11\n月\n30\n日'
  expect(taskPublicDescription({description,history:[]})).toBe(description)
 })
 it('deduplicates complete labelled facts without deleting unlabelled continuations',()=>{
  const description='要求：登记表须签名\n要求：登记表须签名\n补充：清单\n1\n份\n另一材料\n1\n份'
  expect(taskPublicDescription({description,history:[]})).toBe('要求：登记表须签名\n补充：清单\n1\n份\n另一材料\n1\n份')
 })
 it('preserves equal prefixes with different continuation content',()=>{
  const description='要求：围绕\n第一课题展开\n要求：围绕\n第二课题展开'
  expect(taskPublicDescription({description,history:[]})).toBe(description)
 })
 it('deduplicates a whole repeated requirement rather than its first line',()=>{
  const description='要求：围绕\n研究主题\n展开创作\n要求：围绕\n研究主题\n展开创作'
  expect(taskPublicDescription({description,history:[]})).toBe('要求：围绕\n研究主题\n展开创作')
 })
 it('leaves user edited content untouched',()=>{
  const description='我写的要求\n我写的要求'
  expect(taskPublicDescription({description,history:[{id:'edit-1',field:'备注',before:'',after:description,changedAt:'2026-11-01T10:00:00+08:00',actor:'user'}]})).toBe(description)
 })
})
