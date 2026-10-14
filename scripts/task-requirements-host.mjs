import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createRoleScopedHost} from './current-role-host.mjs'
import {verifyRequirements,BATCH,COUNT} from './task-requirements-diagnostic.mjs'
import {safeCode} from './d26-execution-host.mjs'
export const PACKAGE_ROOT=resolve('.data/autonomous-three-hour-20261009'),EXECUTION_ROOT=resolve(PACKAGE_ROOT,'execution-requirements')
export const requirementsHost=()=>createRoleScopedHost({batch:BATCH,count:COUNT,packageRoot:PACKAGE_ROOT,executionRoot:EXECUTION_ROOT,packageRead:verifyRequirements})
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 const [mode,...rest]=process.argv.slice(2),method={'--verify':'verify','--resume-read-only':'resumeReadOnly','--prepare-authorized':'prepareAuthorized','--dispatch-next':'dispatchNext'}[mode]
 if(!method||rest.length)throw Error('REQUIREMENTS_MODE')
 console.log(JSON.stringify(await requirementsHost()[method](),null,2))
}catch(e){console.error(JSON.stringify({status:'STOPPED',code:safeCode(e),retry:false}));process.exitCode=2}}
