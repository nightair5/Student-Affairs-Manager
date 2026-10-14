# MAINLINE-04 实施白名单（范围交付，不是实施授权）

## 1. 唯一下一包：MAINLINE-04-I1

目标：在0模型调用下，让已见人工的完整条件/状态/修订/事件/时间材料语义在新结构内100%保真，产出逐项可核对建议与明确旧V2承接缺口；仅无损等价旧输入可走冻结V2的内存确认。
不宣称新条件/修订/事件已被实际App支持，不修改任何已有产品或测试文件。

拟新增的全部实现路径如下，授权提示词逐项沿用；不允许其他“顺手新增”文件：

| 路径 | 允许职责 | 不允许 |
|---|---|---|
| src/experiments/mainline04/semanticContract.ts | mainline04-task-semantics-1及review-package-1的TypeScript/严格JSON契约；逐项字段、来源/引用、三值、关系与覆盖状态验证 | 改旧Schema；全局注册；模型或Expected输入；用默认值补事实 |
| src/experiments/mainline04/semanticContract.test.ts | 缺失、类型、篡改、稀疏数组、跨来源、重复/循环/悬空引用及合法三值/关系测试 | 修改旧断言或新建语义数据集 |
| src/experiments/mainline04/semanticComposer.ts | 从已声明语义与本机scope构造逐字依据、内部ID、核对视图、有限状态表及局部问题；保留原候选和完整关系 | 关键词语义分类器；模糊引文自动匹配；model selected；自动正式确认 |
| src/experiments/mainline04/semanticComposer.test.ts | 条件三值、完成/取消/信息、旧新修订、共享/独立关系、有效兄弟及顺序变形 | 固定案例编号/Expected/固定句子进入决策规则 |
| src/experiments/mainline04/legacyHandoff.ts | 比较新包与旧RecognitionResult/V2能力，生成逐项差异账本；仅已有完整等价2.0对象原样返回；未支持的新语义显式不放行 | 强转B8为完整2.0；删事件/材料/时间；unknown变false；生成新正式库格式 |
| src/experiments/mainline04/legacyHandoff.test.ts | 原样对象/字段指纹，未知/条件/修订/事件阻断且无损保留，独立普通兄弟可原V2单独确认 | 以全部拒绝当成功；把阻断归零从分母删除 |
| src/experiments/mainline04/semanticAcceptance.test.ts | 只读旧8通知/工程响应和3条B8；测试内存人工字段映射；新结构逐事实往返；旧42字段经真实capture/confirmationV2/MemoryWorkspaceRecordStore读回；安全与局部受影响集合 | IndexedDB或用户库；旧一次性runner；新模型输出；改旧夹具/评分 |
| scripts/check-mainline-04-i1.mjs | 新包定向/保护/授权白名单检查；独立审查后组织适用分层工程门，日志只入本轮获准报告路径 | 改R3 checker/旧freeze；依赖安装升级；网络模型；付费/部署/浏览器启动 |

允许另新增本包 docs/recognition-optimization/mainline-04-i1/ 报告（计划引用、基线/逐事实账本、定向attempt、审查、工程/保护结果、审计、组件清单及NEXT_PROMPT），CURRENT_CONTEXT约80行、日志追加。
这些是后续I1的建议写入范围；当前SCOPE仅能写本目录六文档和两动态文件。
不新增package/lock/tsconfig配置、依赖、网络入口或生产导出；旧测试自动发现新.test.ts即可。

新semanticContract须组合复用scopeReferenceContract.ts既有语义类型/枚举和引用，不重建同义命题图；新semanticComposer只读复用scopeIndexV11定位与现有时间AST。只增每项条件/依据三值、覆盖状态、完整实体属性及承接能力，不运行旧关键词语义分类器或改冻结文件。对应测试必须区分复用部分与新补齐字段的保真。

新checker不得直接以R3旧阶段白名单运行完整R3编排（新文件必然超出旧授权）。在新checker内使用本包新保护清单，复用已核验的历史文件来源/逐字校验方式和工程命令；历史快照测试与当前功能测试分层出表。只允许一个新临时目录存放本轮构建、日志、历史验证快照及全新npm审计缓存，路径/清单写入本轮报告；它们是工程产物而非新数据集。旧缓存/快照只读，不执行npm安装或生命周期脚本，不加载.env/密钥。不能复现逐字历史快照时停止申请。

## 2. 数据版本、隔离开关、兼容与回滚

- 新实验语义版本显式固定1；旧RecognitionResult 2.0、Workspace v8、MAINLINE-03 receipt-1原样。
- “开关”仅为显式运行新测试/checker；没有VITE变量、URL开关、App入口、全局注册或环境默认开启。生产模块不得import新模块。
- I1仅MemoryWorkspaceRecordStore新空库；原8类人工响应与B8三个已见输出只读。候选JSON与Expected/score使用不同数据通道；评分字段禁止进构造器。
- 旧2.0无损路径是原对象、原引用、原验证器、原确认器；不得把新语义字段藏入旧对象、Source/Draft/Task.legacyData而让旧校验器只检查JSON合法。
- 新核对包保存在测试内存与新实验报告中，不导入正式或用户工作区；新语义的正式持久化验收明确NOT_RUN。
- 无任何数据迁移；没有格式自动升级/降级；不能用旧格式round-trip成功替代新语义存储成功。
- 回滚只是停止运行/导入新实验模块，保留实验文件与日志；不删原证据、不清库、不reset。若需撤销已提交实验代码，另行授权可回退提交，不强推。
- 同一根因最多两轮局部修补；出现保护变化、测试弱化、Expected污染、新错误默认选择或需扩大范围立即停止交付失败证据。

## 3. 已识别的公共/冻结范围：明确不在I1白名单

这些路径是未来真实App接入必须单独逐项批准的候选范围，不自动批准修改：

| 实际路径 | 需要批准的职责/原因 |
|---|---|
| src/recognition/types.ts | 若采用正式RecognitionResult新版本/联合类型，定义每项语义及关系；旧2.0不可被静默重解释 |
| src/recognition/schema.ts | 对新结果执行严格shape/reference/semantic结构校验；旧校验器不能仅放宽字段 |
| src/domain/v2/types.ts | 若新结果进入ExtractionDraft或成为canonical事实，确定显式数据版本和引用；不能用legacyData代替正式设计审批 |
| src/domain/v2/validators/workspaceValidator.ts | 新语义的全图、范围、状态与版本完整性检查；只读复用不是这项已完成 |
| src/domain/v2/capture.ts | 原文→执行→原始响应→新草稿按同源版本保存，支持单项问题不伪造有效旧result |
| src/domain/v2/confirmationV2.ts | 现有冻结组件；须新版本/显式新分支处理每项行动性、关系、用户意图；不得偷偷解除事件/时间阻断 |
| src/domain/v2/domainCommit.ts | 现有冻结组件；新语义快照及关系与正式任务单事务落地、幂等与不覆盖，不能只存显示投影 |
| src/experiments/mainline02/runtime.ts | 真实隔离runtime显式注入新识别/确认版本，保持旧人工与MAINLINE-03入口默认行为 |
| src/experiments/mainline02/reviewAdapter.ts | 从完整新语义构造可核对视图，不从显示值生成真实编辑或关系 |
| src/App.tsx | 仅隔离runtime新版本接线、实际操作/版本/ID传递；稳定默认仍禁止变动 |
| src/components/DraftReviewPanel.tsx | 条件/状态/修订依据的真实可视核对与明确保存，部分确认及未保存编辑保护 |
| src/domain/v2/repository.ts、src/domain/v2/migration.ts | 仅在既有原子事务与schema无法承接时才可能需要；本轮不认定必须改。若需改，先批准迁移前备份、失败保护及版本矩阵 |

任何后续新增公共文件、Schema JSON物化文件、迁移文件、冻结候选/时间AST及其测试都需再列精确路径并获授权；本表不是“整个目录都可改”。
I1不为通过现有测试而修改confirmationV2/domainCommit，也不通过新wrapper绕过其检查后直接写库。
