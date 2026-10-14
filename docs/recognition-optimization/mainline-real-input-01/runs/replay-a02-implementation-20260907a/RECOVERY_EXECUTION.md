# Recovery execution isolation

本报告保存本轮实际使用的调用前配置。不是产品脚本，不读取实际 .env；旧默认执行失败证据不修改。

## 共用前置代码（先于动态导入框架）

```js
import fs from 'node:fs'; import fsp from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; import {resolve,basename} from 'node:path'; import assert from 'node:assert/strict';
const projectRoot=resolve(process.cwd()), tempRoot='C:/Users/Winner/AppData/Local/Temp/real-input-isolation-MbFfwp';let blockedEnvReads=0;
const isRootEnv=p=>typeof p!=='number'&&p!=null&&resolve(String(p)).startsWith(projectRoot)&&/^\.env(?:\.|$)/i.test(basename(String(p)));
const checkRead=p=>{if(isRootEnv(p)){blockedEnvReads++;throw Error('ROOT_ENV_READ_FORBIDDEN')}};
for(const key of ['readFileSync','openSync','createReadStream']){const original=fs[key];fs[key]=function(p,...args){checkRead(p);return original.call(this,p,...args)}}
for(const key of ['readFile','open']){const original=fs[key];fs[key]=function(p,...args){checkRead(p);return original.call(this,p,...args)};const asyncOriginal=fsp[key];fsp[key]=async function(p,...args){checkRead(p);return asyncOriginal.call(this,p,...args)}}
syncBuiltinESMExports();

```

## Vitest 调用

```js
const {startVitest}=await import('vitest/node');
const {default:react}=await import('@vitejs/plugin-react');
const ctx=await startVitest('test',[
 'src/experiments/realInput01/acceptance.test.tsx',
 'src/experiments/realInput01/runtime.test.ts',
 'src/experiments/realInput01/factCorrections.test.ts'
],{run:true,watch:false,config:false,reporters:['dot']},
 {configFile:false,envFile:false,envDir:tempRoot+'/env',cacheDir:tempRoot+'/vitest-after',plugins:[react()]});
assert(ctx);assert.equal(ctx.vite.config.envDir,false);assert.equal(blockedEnvReads,0);await ctx.close();
console.log(JSON.stringify({actualRootEnvReadAttempts:blockedEnvReads,environmentFilesDisabled:true}));
```

无密钥控制：临时 sentinel/.env 只含 VITE_RCO_ISOLATION_SENTINEL=nonsecret-local-fixture；用 Vite loadEnv 在该临时位置取得此值，再 resolveConfig({configFile:false,envFile:false,envDir:sentinel,cacheDir:临时目录},'serve') 验证 envDir=false 且 env 无该值。实际项目根环境文件读取尝试 0。FS 守卫是 Node 父进程监测，不宣称系统级完整 IO 审计。后续测试/构建继续显式 envFile:false，配置不读根 .env，缓存/输出按 attempt 分隔；不调用 npm 默认 test/build。
