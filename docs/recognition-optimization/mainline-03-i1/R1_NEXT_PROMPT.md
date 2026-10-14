# 下一轮最小授权提示词（尚未授权）

```text
授权执行 RCO-5-MAINLINE-03-I1-R2：仅补齐阻挡完整工程检查的Node开发类型依赖，继续已修复来源凭据接线的工程和实际Edge验收；不重做PLAN、不改识别语义、不新建数据、不调用模型。

唯一仓库C:\Users\Winner\student-affairs-multimodal-exp，分支codex/e2-multimodal-recognition-exp。先核对Git/远端、mainline-03-i1/R1_BASELINE.json、R1_REJECTED_SNAPSHOT.json、R1_FINAL_CHECKS.json、R1_AUDIT.md、两份R1独立审查、CURRENT_CONTEXT及最新日志。10实现必须匹配最新R1拒收快照，保护变化/重叠用户修改立即停。基线为已推送R1审计提交，不回切c30cdb7/R2旧提交，不套FAILED补丁。

本轮新增允许修改package.json、package-lock.json：仅增加匹配本机Node主版本的@types/node开发依赖并精确锁定，经核验确有必要的传递类型依赖可一起锁定；先查现有版本、许可证与依赖影响，不批量升级无关包。允许安装该开发依赖到本机node_modules，npm缓存只能使用新建临时目录，不清空/改写旧评测cache，不运行依赖生命周期脚本。若既有无关依赖发生漂移，停止，不用重写锁文件掩盖变化。

原10实现只读复用并在成功后一起提交；如需要额外改测试/产品源码、tsconfig、脚本、Schema或语义，先申请，不用ts-ignore/any/动态导入/排除测试隐藏类型错误。仅新增本轮R2报告，更新约80行CURRENT_CONTEXT，日志追加；旧R1审计/快照/历史结果保持。

1. 先复现已登记的三测试共6个TS2307，明确是Node模块类型缺失，不重新运行旧一次性runner或重做来源修补。
2. 补齐最小开发类型依赖，验证类型、原153项定向和42/42内存字段口径；不能删改原断言、靠全拒绝过门。记录新增全局类型影响，不把类型通过等同产品准确。
3. 新无上下文独立审查无阻断后，完成一次适用完整lint/type/test/build/契约/安全/依赖/保护工程门；失败保留各attempt，不重复算通过数。
4. 完整门通过才执行原BROWSER_PROTOCOL：真实App新Edge标签/新空隔离v8库，旧工程通知录入→来源→适配→逐键编辑/保存→部分与批量确认→故障/过期/重复→刷新→实际JSON下载及canonical全对象读回；无日期0时间0提醒，实际jobs函数检查。不得用fill替代逐字编辑、DOM提示或内部exportJson代替真实文件。
5. 保护变化、新错误默认选、Expected污染、测试弱化、稳定默认影响、真实库访问、无关依赖漂移、需扩大范围或同根因两轮无效立即停。成功才单独提交推送原10实现、两依赖文件及R2报告并核对远端；失败仅上传审计，保留源码现场。

外部识别模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板访问0。只允许本轮必要公开包元数据/依赖审计网络，不调用AI或读取任何密钥。不改Expected/freeze/dataset/checkpoint/cache、历史结果/旧runner、Schema/repository/capture/confirmationV2/domainCommit/validator/时间AST/冻结组件；不接稳定入口、不部署/RCO-6、不创建数据/盲测/B10、不采真实材料/真人。模型准确率明确写“本轮未测量”。

交付本轮审计、分层检查与真实浏览器数字、保护与Git状态、未解决问题及唯一下一建议。完成后停止，不自动进入新语义契约或付费实验。
```

这份提示词只申请当前工程依赖缺口，不重开模型或数据优化，也不是安装任何依赖的既有许可。
