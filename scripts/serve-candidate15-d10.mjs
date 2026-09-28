import {createServer} from 'node:http'
import {buildD8Preview,d8Handler} from './serve-candidate15-d8.mjs'

const port=process.argv[2]??'6639'
if(!/^[0-9]{4,5}$/.test(port)||Number(port)>65535||['6633','6634','6635','6637','6638'].includes(port))throw Error('D10_ISOLATED_PORT_REQUIRED')
const manifest=await buildD8Preview('http://127.0.0.1:'+port,{includeD9Fixture:true,d10Isolation:true})
const server=createServer(d8Handler(manifest))
server.once('error',error=>{console.error(error.code==='EADDRINUSE'?'D10_PORT_BUSY_NO_PROCESS_KILLED':'D10_SERVER_FAILED');process.exitCode=1})
server.listen(Number(port),'127.0.0.1',()=>console.log(JSON.stringify({url:manifest.origin,database:manifest.database,records:manifest.records.length,modelCallsEnabled:false,humanTrial:false})))
