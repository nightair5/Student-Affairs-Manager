import {describe,it,expect} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {calculateLowEditV2,createD13Measurement,D13_DATABASE,type D13Trace} from './measurement'
const row=(kind:D13Trace['kind'],atMs:number,extra:Partial<D13Trace>={}):D13Trace=>({id:crypto.randomUUID(),draftId:'d',kind,atMs,...extra})
const terminal=[row('commit',20_000,{commitId:'c',fields:[],includedEditIds:[],structural:false,disposition:'no_task'}),row('wait_end',20_100),row('readback',20_100,{commitId:'c'}),row('end',20_100,{commitId:'c',disposition:'no_task'})]
describe('low-edit-v2 measurement evidence',()=>{
  it('at least ten seconds of reading is zero editing, and waiting is separate',()=>{
    const result=calculateLowEditV2([row('begin',0),row('read',0),row('wait',15_000),...terminal],true)
    expect(result).toMatchObject({missing:[],readMs:15_000,activeEditMs:0,waitMs:5100,lowModificationCorrectDisposition:true})
  })
  it('never accepts missing commit/readback, unfinished edit or waiting as successful disposition',()=>{
    for(const middle of [[],[row('edit',10,{editId:'e',fieldKey:'title'})],[row('wait',10)]]){
      const result=calculateLowEditV2([row('begin',0),...middle,row('end',100,{disposition:'confirmed'})],true)
      expect(result.correctDisposition).toBeNull();expect(result.zeroSubstantiveModification).toBeNull();expect(result.lowModificationCorrectDisposition).toBeNull();expect(result.missing.length).toBeGreaterThan(0)
    }
  })
  it('separates actual edit, idle, hidden, failure and manually retried save; thresholds are exploratory',()=>{
    const result=calculateLowEditV2([row('begin',0),row('edit',100,{editId:'e',fieldKey:'event.location'}),row('blur',6100),row('hidden',6200),row('visible',8200),row('wait',8300),row('wait_end',9300),row('failure',9300,{error:'save failure'}),row('read',9300),row('wait',9400),row('commit',19400,{commitId:'c',fields:['events.e.location'],includedEditIds:['e'],structural:false,disposition:'confirmed'}),row('wait_end',19400),row('readback',19400,{commitId:'c'}),row('end',19400,{commitId:'c',disposition:'confirmed'})],true)
    expect(result).toMatchObject({missing:[],activeEditMs:5000,idleMs:1000,hiddenMs:2000,waitMs:11000,fieldCount:1,lowModificationCorrectDisposition:true,zeroSubstantiveModification:false})
  })
  it('captures interaction timestamps before persistence queue delays',async()=>{
    let time=0,release:()=>void=()=>undefined
    const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D13_DATABASE}),base=transport.transaction.bind(transport)
    let first=true
    transport.transaction=async(key,fn)=>{if(first){first=false;await new Promise<void>(resolve=>{release=resolve})}return base(key,fn)}
    const m=createD13Measurement(transport,()=>time),a=m.append('d','begin')
    await Promise.resolve();time=100;const b=m.changed('d','title');time=900;release();await Promise.all([a,b])
    expect((await m.events('d')).map(e=>e.atMs)).toEqual([0,100])
  })
})
