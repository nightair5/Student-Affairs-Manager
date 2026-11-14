// A new state writer for future authorized batches; old frozen executors and
// their locks, temporary files and journals remain untouched.
import {randomUUID} from 'node:crypto'
import {openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs'
import {setTimeout as delay} from 'node:timers/promises'

export function atomicStateWriter(path,{replace=renameSync,wait=delay}={}){
 return async value=>{
  const temp=path+'.'+randomUUID()+'.new',fd=openSync(temp,'wx',0o600)
  try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}
  for(let attempt=0;;attempt++){
   try{replace(temp,path);return}
   catch(error){
    if(!['EPERM','EACCES','EBUSY'].includes(error?.code)||attempt>=3)throw error
    // Retrying a local atomic rename cannot repeat the transport request.
    await wait(20*(2**attempt))
   }
  }
 }
}
