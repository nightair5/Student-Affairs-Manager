import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {createRoleScopedHost} from './current-role-host.mjs'
import {verifyFactRole,BATCH,COUNT,PACKAGE_ROOT,EXECUTION_ROOT} from './fact-role-diagnostic.mjs'
import {safeCode} from './d26-execution-host.mjs'
export const factRoleHost=()=>createRoleScopedHost({batch:BATCH,count:COUNT,packageRoot:PACKAGE_ROOT,executionRoot:EXECUTION_ROOT,packageRead:verifyFactRole})
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 const [mode,...rest]=process.argv.slice(2),method={'--verify':'verify','--resume-read-only':'resumeReadOnly','--prepare-authorized':'prepareAuthorized','--dispatch-next':'dispatchNext'}[mode]
 if(!method||rest.length)throw Error('FACT_ROLE_HOST_MODE')
 console.log(JSON.stringify(await factRoleHost()[method](),null,2))
}catch(e){console.error(JSON.stringify({status:'STOPPED',code:safeCode(e),retry:false}));process.exitCode=2}}
