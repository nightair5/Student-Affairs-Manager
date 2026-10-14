import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore,CURRENT_WORKSPACE_RECORD_KEY} from './repository'
import {isMaterialSatisfied} from '../../lib/domainEntities'
describe('future material status preservation in release compatibility',()=>{
 it('loads, saves, refreshes and round-trips an unknown status without claiming readiness',async()=>{
  const ws=createGoldenWorkspaceV8();ws.materials[0].status='unverified'
  const store=new MemoryWorkspaceRecordStore({[CURRENT_WORKSPACE_RECORD_KEY]:ws}),repo=new CanonicalWorkspaceRepository(store)
  const loaded=await repo.load();expect(loaded?.materials[0].status).toBe('unverified')
  expect(isMaterialSatisfied(false,'unverified')).toBe(false)
  expect(importWorkspaceV8(exportWorkspaceV8(loaded!)).materials[0].status).toBe('unverified')
  await repo.save(loaded!);expect((await new CanonicalWorkspaceRepository(store).load())?.materials[0].status).toBe('unverified')
 })
 it('rejects malformed/nonstring tokens rather than treating any JSON as a status',()=>{
  const ws=createGoldenWorkspaceV8();ws.materials[0].status='<script>'
  expect(()=>exportWorkspaceV8(ws)).toThrow()
 })
})
