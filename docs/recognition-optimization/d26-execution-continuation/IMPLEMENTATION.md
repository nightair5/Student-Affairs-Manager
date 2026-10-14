# 原冻结执行与比较后产品实现

2026-10-03。产品代码07e1b99b6b98a4cc92058499e968bd1125aaf9ea已立即普通推送；付费执行绑定此前已同步7ce9fa204a5b86a0facf99b26672d47a1a34ccde。原4699d5c快照145组件/7产物/16请求不动。

## 批次已结束

复用scripts/d26-execution-host.mjs、原快照执行器、受保护transport、跨进程锁和权威账本。各ordinal reserve→发送前状态→一次send→原raw/SHA/usage→settle，共1grant/16reserve/16settle，全部SETTLED。唯一许可用尽，禁止再次prepare/dispatch、删状态或复用旧grant。Secret仅既有服务端机制使用，没有打印明文；授权/核价原件仅本机.data，不进Git。

只读命令仍可核验，模型及账本写0：

~~~powershell
$d26Snapshot = 'C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛'
node scripts/d26-execution-host.mjs --verify --snapshot $d26Snapshot
node scripts/d26-execution-host.mjs --resume-read-only --snapshot $d26Snapshot
node scripts/report-d26-execution.mjs --snapshot $d26Snapshot
node scripts/report-d26-product-replay.mjs
~~~

旧evidence/48项及NO_STATE是执行前观测，保留；实际见authorized-20261003/HOST_READ_ONLY.json。原报告在快照cwd冻结评分，固定分母，原答和首次展示分列，无确定赢家。

## 三类代码路径

src/recognition/recordedProjectionD26.ts：版本化事后accounting投影。只有原答已有且同scope支持的primary action/event及secondary time/material合法；保留原事实与引用审计再走原严格转换。无primary、假ID、跨scope、wrong-kind、重复引用或缺事实null继续拒。不会把null补成not_stated。

录制与新来源索引逐条核text/start/end，scope映射反向往返相等才重绑定，实体/事实不动。已有事件的压缩标题只展开为其单个已引用原文句，否定改变不接受；不生成遗漏事件/日历时刻。旧v10/成绩不重写。

src/experiments/d26Recorded/browser.tsx：实际固定录制provider和独立工程store注入现有App。原raw、SHA、request、候选、原时钟先存RecognitionRun.legacyData；成功后保存semanticSidecar、转换、首次显示；人工编辑另存。失败Source/raw保留。App→ReviewSession→DomainCommitPlan→Repository→独立reader→D27最小安排，没有平行保存链。

src/App.tsx：注入recognitionContext/pipelineVersion和录制文案；相对时间用原推理时间。离线provider某来源被拒不置全局unavailable。实际C18 S03拒绝后C17 S05仍走录制，不静默本地fallback。默认候选及生产派发机制未换。

scripts/serve-d26-recorded.mjs：核完整16份报告、response/request/source SHA，只绑定新回环origin/instance，静态白名单，没有模型API。Expected、授权原件/Secret不进网页。实例已构建时拒复用：

~~~powershell
node scripts/serve-d26-recorded.mjs <未占用且大于等于6793的端口> <新的匿名instance>
~~~

当前6798/actual16r6；源码hash cbf17bf22cd8与提交一致。[页面实际证据](authorized-20261003/BROWSER_EVIDENCE.md)。

## 定向回归与测试隔离

d26-recorded-projection.node-test.mjs八项：合法附属引用；跨scope/错类型/无主实体/假ID；缺事实null；未知资格及双向图保留；事件压缩/遗漏不补；scope可逆新来源绑定；正文/边界漂移；重复引用/否定反例。接入现行current-safety发现规则。

真实授权STATE出现后，非冻结host的缺授权CLI测试误读主工作区.data。测试复制同宿主及两个本地依赖到credential-free临时目录，保留原断言检验no grant/no send，不删除真实状态或弱化断言。修后host31+投影8=39PASS。旧无授权48项历史结果不回填。[当前验证](VALIDATION.md)。
