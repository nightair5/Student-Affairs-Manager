import {defineConfig, type Plugin} from 'vite'
import react from '@vitejs/plugin-react'

const offlineApi:Plugin={name:'codex-cloud-offline-api',configureServer(server){
  server.middlewares.use((request,response,next)=>{
    if(!request.url?.startsWith('/api/'))return next()
    response.statusCode=403;response.setHeader('Content-Type','application/json')
    response.end(JSON.stringify({configured:false,modelCallsEnabled:false,error:{code:'CODEX_CLOUD_DEVELOPMENT_OFFLINE'}}))
  })
}}
export default defineConfig({envDir:false,base:'/',plugins:[offlineApi,react()],server:{host:'127.0.0.1',port:4173,strictPort:true,proxy:{},fs:{strict:true,deny:['.env','.env.*','.dev.vars','.dev.vars.*','.data/**','**/.git/**']}}})
