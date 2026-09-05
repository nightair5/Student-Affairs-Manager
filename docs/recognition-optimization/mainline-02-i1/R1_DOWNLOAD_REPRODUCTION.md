# R1 下载文件只读复核命令

只对本次匿名测试文件运行。比较发生在文件取得之后，不修改原夹具/Expected或产品代码。命令中的摘要来自真实面板按钮读回同一测试库的JSON，不是模型答案。

在唯一工作仓库中执行以下Node JavaScript（无磁盘构建产物、无模型网络）：

```javascript
const fs=require('fs'),c=require('crypto');(async()=>{
const file='C:/Users/Winner/Downloads/mainline-02-i1-workspace (4).json';
const raw=fs.readFileSync(file),w=JSON.parse(raw),hash=c.createHash('sha256').update(JSON.stringify(w)).digest('hex');
const b=await require('esbuild').build({entryPoints:['src/domain/v2/validators/workspaceValidator.ts'],bundle:true,write:false,platform:'node',format:'cjs'});
const module={exports:{}};Function('require','module','exports',b.outputFiles[0].text)(require,module,module.exports);
const valid=module.exports.validateWorkspaceV8(w);
const d=w.extractionDrafts.find(d=>d.result?.standaloneTasks.length===2),r=d.result;
const run=w.recognitionRuns.find(x=>x.id===d.recognitionRunId),sv=w.sourceVersions.find(v=>v.id===run.sourceVersionId); const checks=[];r.standaloneTasks.forEach((t,i)=>{const task=w.tasks.find(x=>x.legacyData?.recognitionTempId===t.tempId&&x.legacyData.sourceId===sv.sourceId),time=w.timePoints.find(x=>x.legacyData?.recognitionTempId===r.timePoints[i].tempId),m=w.materials.find(x=>x.legacyData?.recognitionTempId===r.materials[i].tempId);const check=(a,b)=>checks.push(JSON.stringify(a)===JSON.stringify(b));
check(t.actionVerb,task.legacyData.actionVerb);check(t.actionObject,task.legacyData.actionObject);check(t.title,task.title);check(t.description,task.description);check(t.completionCriteria,task.legacyData.completionCriteria);
for(const f of ['rawText','normalizedValue','timezone','isAllDay','precision'])check(r.timePoints[i][f],time[f]);
check([task.id],time.relatedTaskIds);check([m.id],time.relatedMaterialIds);
for(const f of ['name','formatRequirements','namingRequirements','quantity','submissionChannel'])check(r.materials[i][f],m[f]);
check([task.id],m.relatedTaskIds);check(time.id,m.deadlineTimePointId);
const ev=w.evidenceRefs.find(e=>e.sourceVersionId===sv.id);
check(sv.id,ev.sourceVersionId);check(r.evidence[0].quotedText,ev.quotedText);
});
const undated=w.tasks.find(t=>t.title==='保存活动手册'),dated=w.tasks.find(t=>t.title==='保存活动手册（跨标签核对）');
const result={file,bytes:raw.length,fileSha256:c.createHash('sha256').update(raw).digest('hex'),canonicalSha256:hash,matchesActualUiReadback:hash==='d1c8d59398590576eb7677b08ab5ee48a2b41166a15755c40b3f7ff424ddf514',validation:valid,counts:{sources:w.sources.length,drafts:w.extractionDrafts.length,tasks:w.tasks.length,times:w.timePoints.length,reminders:w.reminderRecords.length,editHistory:w.historyRecords.filter(h=>h.action==='confirmation_v2_edit').length},fieldFidelity:{total:checks.length,matched:checks.filter(Boolean).length},undated:{taskId:undated.id,times:w.timePoints.filter(t=>t.taskId===undated.id||t.relatedTaskIds.includes(undated.id)).length,reminders:w.reminderRecords.filter(t=>t.taskId===undated.id).length},dateOnly:w.timePoints.filter(t=>t.taskId===dated.id).map(t=>({rawText:t.rawText,normalizedValue:t.normalizedValue,timezone:t.timezone,precision:t.precision,isAllDay:t.isAllDay,extractionMethod:t.legacyData.extractionMethod}))};
console.log(JSON.stringify(result));})().catch(e=>{console.error(e.message);process.exitCode=1;});
```

实际首次两次诊断命令失败为PowerShell换行转义及误用Draft.sourceId；最终沿Draft.recognitionRunId→Run.sourceVersionId→SourceVersion.sourceId查归属。未修改冻结计分口径，成功数字仅见R1_DOWNLOAD_CHECK.json。
