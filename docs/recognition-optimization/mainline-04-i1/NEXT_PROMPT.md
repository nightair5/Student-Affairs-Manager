# 下一轮授权提示词（尚未授权）

> 授权执行 RCO-5-MAINLINE-04-I1-R1：只修复I1独立审查登记的修订证据影响范围和旧V2实体比较连坐，不重做契约、不新建数据、不调模型。
>
> 唯一仓库C:\\Users\\Winner\\student-affairs-multimodal-exp，分支codex/e2-multimodal-recognition-exp。以本轮已推送失败审计提交为起点，先核对Git/远端、mainline-04-i1/BASELINE.json、REJECTED_SNAPSHOT.json、CHECKS.json、REVIEW.md/REVIEW.json、REPRODUCTION.md、CURRENT_CONTEXT和最新日志。8实现逐字SHA必须匹配失败现场；重叠修改或保护变化立即停，不回切/重装/套补丁。
>
> 本轮允许修改semanticComposer.ts、legacyHandoff.ts、对应两测试及semanticAcceptance.test.ts，只在原mainline04目录内修复已登记反例。semanticContract.ts及其测试、check-mainline-04-i1.mjs只读复用；如果完整工程发现需要改这些或其他文件，先申请。其余已有源码/依赖/冻结只读。只新增本轮R1报告、约80行CURRENT_CONTEXT及追加日志。
>
> 先把REPRODUCTION中的两个反例加入新回归，不修改原夹具/Expected，不弱化旧49项。修订关系的依据缺失、坏scope或unknown应影响该关系真正连接的旧/新要求；不能只阻断旧项，却让新项默认勾选；不能把无法核验强改成false。完整有效修订的新要求仍须正向核对，不全部拒绝。
>
> 旧V2承接按任务在新旧两侧的完整相关实体并集比较，保留时间→材料→任务/事件与修订关系。某项材料差异不能连坐完全独立的兄弟；共享实体的真实受影响任务必须同时被挡住。不能通过删关系、取首项、删除差异或全放行来过门。原旧2.0对象必须原样保留，悬空引用导致整个旧capture校验失败的边界不改。
>
> 补齐缺失/坏/有效修订依据、取消无替代、共享/独立材料与时间、任务数组重排的正反测试。原8类工程响应和B8三条已见输出只读，新包全字段/关系保真、错误默认选择0、有效新要求和独立兄弟为非零正例；旧V2真实内存确认42/42。新语义实际App/正式保存NOT_RUN，模型准确率本轮未测量。
>
> 一轮一个根因，每根因最多两轮局部修补。定向通过后新无上下文独立审查，再核对尚未验收的新checker并申请必要的精确编排调整；无阻断才运行适用分层工程/保护。新错误默认选择、保护变化、Expected污染、测试弱化、范围扩大或两轮无效立即停止。成功才明确清单提交推送业务实现并核对远端；失败只提交审计保留源码。
>
> 0外部识别/模型网络/费用/密钥/剪贴板；不新建数据集/盲测、不改旧Expected/freeze/dataset/checkpoint/cache和历史结果、不接真实库/稳定入口、不部署/RCO-6。完成后停止，不自动接App或调用模型。
