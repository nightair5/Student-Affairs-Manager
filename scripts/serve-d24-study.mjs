import {createServer} from 'node:http'
import {buildD23Preview} from './serve-d23-study.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'
// Engineering-only launcher. Human authority cannot be inferred from this package.
if(process.argv.length>4)throw Error('D24_HUMAN_AUTHORITY_NOT_PROVIDED')
const manifest=await buildD23Preview(process.argv[2]??'6741',process.argv[3]??'d24final01',null,'d24-planned-coverage-1')
const server=createServer(d8Handler(manifest))
server.once('error',e=>{console.error(e.code==='EADDRINUSE'?'D24_PORT_BUSY_NO_PROCESS_KILLED':e.message);process.exitCode=1})
server.listen(Number(new URL(manifest.origin).port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,databases:manifest.databases,build:manifest.sourceSha256,role:manifest.role,modelCalls:0,humanAuthorized:false,reportVersion:manifest.reportVersion})))
