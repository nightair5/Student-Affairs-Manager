# 唯一下一实施授权提示词（尚未授权）

本包终点是新语义格式的完整保真与逐项核对能力、旧V2的精确承接边界；不是新语义已接真实App。达到出口后不要再重做同一格式或建新数据，申请真实组件接入。

> 授权执行 RCO-5-MAINLINE-04-I1：按已提交mainline-04-scope/SCOPE.md、IMPLEMENTATION_WHITELIST.md、VALIDATION_DESIGN.md，仅实现引用式任务语义契约、无损组合及旧V2承接边界验证。0次模型调用，不新建数据集。
>
> 唯一仓库C:\Users\Winner\student-affairs-multimodal-exp；分支codex/e2-multimodal-recognition-exp。以MAINLINE-04-SCOPE最终提交/远端为起点，核对CHECKS、CURRENT_CONTEXT与最新日志、R3-CLOSE原13实现及保护。重叠用户修改或保护变化立即停止，不回切、不重装、不套旧补丁、不从RCO-0重审。
>
> 已有源码/测试/配置/依赖/Schema/仓储/确认器/冻结组件全部只读。只新增以下8文件：
> src/experiments/mainline04/semanticContract.ts、semanticContract.test.ts、semanticComposer.ts、semanticComposer.test.ts、legacyHandoff.ts、legacyHandoff.test.ts、semanticAcceptance.test.ts；
> scripts/check-mainline-04-i1.mjs。
> 另可新增docs/recognition-optimization/mainline-04-i1/本轮报告、约80行CURRENT_CONTEXT和追加日志。不扩大实际文件或语义职责，需要则停止申请。
> 允许在一个全新临时目录保存本轮日志、构建、逐字核验的历史验证快照及新npm审计缓存，路径写报告；旧缓存/快照只读，不安装依赖、不运行生命周期脚本、不加载.env。新checker使用本轮白名单复用R3的分层方法，不把新文件塞进旧阶段白名单，不直接运行其旧整轮入口。
>
> 新版本mainline04-task-semantics-1/mainline04-review-package-1独立于旧RecognitionResult 2.0与Workspace v8。先失败复现再实现：保留完整命题、条件true/false/unknown、当前/完成/取消状态、旧新修订、事件及时间材料归属。空引用区分未说明/未提取/未解决；unknown不得转false。模型不得输出selected、原文位置、自由证据或稳定实体ID；本机恢复来源位置、构造内部引用、复用时间AST并做有限状态决策，不加关键词语义补丁。
> 必须只读复用scopeReferenceContract已有语义类型/枚举/引用与scopeIndexV11定位，不从零重做命题图。新增仅每项条件与依据三值、覆盖状态、完整时间材料属性/归属和承接能力；旧boolean不承载unknown，轻量引用不冒充完整实体，旧语义分类器不重跑。
>
> 只用原8类人工通知、已登记关系变形和B8-01/07/09只读输出。新语义标签和字段映射只在测试内存中明确标人工工程，不能称独立真值或新模型预测；Expected/旧score不得进入决策链。
>
> 新包所有人工字段和关系100%保真，条件真/有效新要求必须有正向核对建议；条件假/未知/完成/取消/禁止/信息不误选。未复核旧模型语义保持未核对。局部问题只影响真实关联项，有效普通兄弟保留。
>
> 旧V2仅接原本完整等价的2.0对象，用原capture/confirmationV2/MemoryWorkspaceRecordStore确认并全对象读回，旧42口径42/42。无法承接的条件/修订/事件完整留在新核对包与逐项差异账本，不删字段或绕过validator，不把JSON塞legacyData当正式支持。新语义的真实App/正式确认保存明确NOT_RUN。
>
> 对所有输入报告事实保真、漏项/误项、三值状态、Evidence、Complete Case、Major、Forbidden、错误默认选择、未知/未选/未支持及旧V2确认保存保真；不靠全部未知/全部拒绝过门，不重评或改写历史FAIL、40/42、17测试与旧R2环境3/1。
>
> 同根因最多两轮局部修补；定向/变形通过后请一名无上下文独立审查者，再做适用分层工程门、保护/差异检查。新错误默认选择、测试弱化、Expected污染、保护变化、稳定影响、需要扩大范围或两轮无效立即停止，交付失败证据。成功才明确清单提交推送核对远端。
>
> 模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/真实库/真实材料/真人/浏览器操作/部署/RCO-6均0；不改冻结/Expected/dataset/checkpoint/cache/旧runner/result，不创建盲测/B10。必要依赖审计仅查询公开包安全元数据，不安装升级。
>
> 最终报告本轮新结构可表达与旧V2可确认分别数字、主要剩余断点、保护/Git和下一真实组件接入所需精确权限。模型识别准确率写“本轮未测量”。完成后停止，不自动实施接入、新格式重做或付费实验。
