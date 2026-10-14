import {createServer} from 'node:http'
import {buildD8Preview,d8Handler} from './serve-candidate15-d8.mjs'

const port=process.argv[2]??'6636'
if(!/^[0-9]{4,5}$/.test(port)||['6631','6632','6633','6634','6635'].includes(port)||Number(port)>65535)throw Error('D9_ISOLATED_PORT_REQUIRED')
const origin='http://127.0.0.1:'+port
const manifest=await buildD8Preview(origin,{includeD9Fixture:true})
const server=createServer(d8Handler(manifest))
server.once('error',error=>{console.error(error.code==='EADDRINUSE'?'D9_PORT_BUSY_NO_PROCESS_KILLED':'D9_SERVER_FAILED');process.exitCode=1})
server.listen(Number(port),'127.0.0.1',()=>console.log(JSON.stringify({url:origin,database:manifest.database,records:manifest.records.length,modelCallsEnabled:false,humanTrial:false})))
