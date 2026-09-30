import {createServer} from 'node:http'
import {buildD21Preview} from './serve-d21-review-session.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'

const manifest=await buildD21Preview(process.argv[2]??'6711',process.argv[3]??'p22','D22')
const server=createServer(d8Handler(manifest))
server.once('error',error=>{console.error(error.code==='EADDRINUSE'?'D22_PORT_BUSY_NO_PROCESS_KILLED':error.message);process.exitCode=1})
server.listen(Number(new URL(manifest.origin).port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,database:manifest.database,build:manifest.sourceSha256,modelCalls:false,humanTrial:false})))
