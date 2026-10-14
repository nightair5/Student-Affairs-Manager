# MAINLINE-03-I1 唯一最小实施白名单（待授权）

本文件只设计下一轮；当前MAINLINE-03-SCOPE不实施任何代码。
唯一repo/branch及起始保护见BASELINE.json。下一轮基线应以本次SCOPE最终文档提交为准，不回切235e365或R2。
名称：零调用的来源绑定与可表达性接入验证。唯一变量：服务形状完整响应进入冻结V2前的本机来源绑定与来源类型标注。
不增加识别规则、语义推理、模型职责或商业支持范围。

## 1. 精确文件：2已有 + 6新增源码/测试 + 2新增脚本

| 路径 | 允许职责 | 不允许 |
| --- | --- | --- |
| src/experiments/mainline02/runtime.ts（已有） | 增加可选、显式隔离handoff配置；每次capture固定只读输入凭据，先beginCapture保存来源及命名空间凭据，再用实际CaptureHandle绑定；提供只读实验来源提示 | 改原无配置人工路径、store名称/事务/WeakSet隔离；改review/edit/confirm策略；调用真实识别 |
| src/App.tsx（已有） | 仅runtime分支的识别来源提示读取runtime新增可选只读文案，默认仍显示原人工提示 | 改默认业务分支、确认意图、存储、日期、导航、模型调用或新增语义UI |
| src/experiments/mainline03/recognitionHandoff.ts（新增） | 纯适配：输入形状/来源hash/契约类型检查、确定性唯一逐字定位、只绑定本次来源ID/位置、差异账本与拒绝原因 | 改语义/动作/对象/时间/材料/selected；从Expected或词语规则补事实；猜重复证据位置 |
| src/experiments/mainline03/recognitionHandoff.test.ts（新增） | 上述正反、来源错绑/重复/畸形/关系保真测试；只内存变形旧响应 | 改旧夹具、Expected、冻结材料 |
| src/experiments/mainline03/seenReplay.ts（新增） | 只读输入投影及凭据构造，严分人工工程/服务形状工程/已见模型候选；绑定原始文件hash与case键 | 导入旧score/Expected到运行图、使用历史评分作放行条件、调用旧runner |
| src/experiments/mainline03/seenReplay.test.ts（新增） | 输入hash/版本/模型来源、无Expected与无网络依赖检查；原始凭据不变 | 重写历史结果或新盲测 |
| src/experiments/mainline03/browser.tsx（新增） | mount真实App，创建全新空隔离v8库，注入上述回放；复用既有store/runtime/通知jobs；显示回放边界与读回信息 | 第二套确认页；预置正式任务；fallback旧库；访问旧用户标签/库/密钥 |
| src/experiments/mainline03/mainlineAcceptance.test.tsx（新增） | 真实App→来源→适配→V2→确认→canonical，失败/刷新/字段/导出测试 | 只测玩具组件、以全拒绝/DOM成功文本代替持久化 |
| scripts/serve-mainline-03-i1.mjs（新增） | 按旧隔离server方式内存构建、回环随机端口、严格静态allowlist/CSP；从绑定文件只投影获准匿名input/raw字段到内存构建资产 | 模型代理、文件任意读取路由、读取.env、真实服务/数据、修改旧cache |
| scripts/check-mainline-03-i1.mjs（新增） | 白名单/保护/依赖图/定向与适用工程门编排；输出到新报告或新临时目录 | 改package/tsconfig/validator、旧runner、评分与冻结检查脚本 |

额外文档允许：docs/recognition-optimization/mainline-03-i1/下本轮BASELINE、报告/复核/检查/实际浏览器证据；CURRENT_CONTEXT约80行、OPTIMIZATION_LOG仅追加。
以上10个源码/脚本路径为穷尽列表；即使“小改”也不能自行扩大。

## 2. 隔离开关和来源凭据

- 唯一开启途径为新本机启动器创建的真实App + 已验证MainlineRuntime。不改main.tsx，不增加普通入口URL/环境开关。
- 新库继续满足既有rco-mainline-01-02-i1-名称规则，加入新的随机run ID；在新报告记录stage=mainline-03-i1及origin/库名绑定。旧I1两origin/库不访问、不删除。
- 不配置handoff时，MAINLINE-02旧人工路径/提示/行为完全不变。
- 新handoff为每次录入选定固定receipt，明确 kind=engineering / engineering-service-shaped / seen-model-candidate；同一正文有歧义匹配时拒绝，不根据期望答案选版本。
- 可通过既有CaptureRequest.sourceLegacyData在**新Source的legacyData.mainline03Handoff**保存本次原始回放响应、input/raw hash、原模型/契约/提示版本、历史run/case、seen标记与来源文件hash。不修改Schema类型/仓储，也不把receipt当可执行指令。
- 这是新隔离接线元数据，不是新的语义契约；完整对象只限已匿名的获准记录，不含secret/Expected/分数/文件本体。大小上限256 KiB/receipt；超限失败，不截断。
- 人工provider仍manual；已见回放provider使用现有legacy-unknown，modelName明确“已见回放/原模型名称”；原provider/model在receipt保留，不能冒充此次deepseek联网或把回放耗时当模型延迟。
- 新Run/SourceVersion/Draft仍由旧capture生成；receipt先持久化，适配失败保留来源/原始响应并由既有失败状态记录。禁止手写canonical数组或直接绕过capture。
- 编辑历史与首次适配结果仍由冻结V2保存；最初原始回放响应在receipt独立保留。声明firstResponse时明确原始服务响应与适配结果两层，不能混称原始预测。
- 不访问任何真实服务、status、OCR、URL、localStorage或通知；network instrumentation + CSP禁止外部请求，复用既有未支持操作阻断范围。

## 3. 适配的精确边界

输入A：旧人工完整响应，可作为正向；允许在新测试内仅把依据改成当前Worker输出形状（pending-source、无位置），其他字段原样，明确工程变形。
另可只读调用冻结Worker的纯normalize函数做形状对照；其差异单列，不把规范化后的变动归给新适配或重写42字段答案。禁止调用Worker handler/network。

输入B：如既有记录是**完整服务规范化输出**，须先核验确切路径/hash/版本/输入来源；本次未绑定这类真实正样本，下一包不得临时扩大文件选样，需补充授权。
输入C：本次绑定B8-01/07/09的model-anchor-selection，属于已见候选而非服务2.0，只留证诊断，不运行010回放runner，不硬转完整结果。
010结果的结构审计与已见B9诊断摘要只引用本SCOPE报告，不进入下一轮放行决策。

完整2.0适配只允许：
1. 原始输入、版本、receipt hash检查；使用现行parse/validate函数，不增加宽松Schema。
2. evidence的pending-source绑定当前CaptureHandle.sourceId；已绑定且相符的来源保持；其他来源/历史sourceId一律拒绝，不能“纠正”错绑。
3. 逐字证据在当前原文中恰好一次时，本机生成textStart/textEnd；已存在位置须先验证且不得静默修正。quote与quotedText冲突、空串、零匹配、多匹配均不得猜。
4. 除上述来源/位置字段，深度结构全等；临时实体ID、双向引用、时间raw/值/时区、材料全部原样。任何额外删改报HANDOFF_FIELD_LOSS并停止。
5. candidate未知/条件/修订等无等价目标契约时返回CONTRACT_UNREPRESENTABLE，不把null变false，不塞description冒充结构化关系。
6. 只有通过现行完整Schema/reference/semantic校验、仅来源/span位置或可表达关联仍待核对的响应，才可保留完整draft.result并让冻结V2阻断受影响项。引用悬空等任一现行完整校验失败，以及根来源/版本/hash错误，均使整个capture失败：仅保留Source receipt、失败Run/Draft，draft.result不能伪造为有效。不得删除坏实体凑校验；这种无法局部承接列为冻结契约限制，不计产品通过。若冻结V2会错误放行或需要扩大校验范围，停止申请，不改V2。
7. 不改selected/inferenceLevel或新增判断规则。原始模型JSON不等于服务规范化输出，不得直接进入正向路径。这里只证明已给定语义的工程承接，不能证明现有默认选择的语言泛化安全。

## 4. 只读依赖与单独审批范围

只读复用：src/experiments/mainline01/fixtures.ts、isolatedStore.ts；MAINLINE-02的reviewAdapter/taskDateView及旧入口/测试；
src/domain/v2/{capture.ts,confirmationV2.ts,domainCommit.ts,repository.ts,types.ts,legacyView.ts,validators/}；
src/recognition/{types.ts,schema.ts}、时间AST、cloudflare/recognition.mjs；
所有既有数据/Expected/freeze/checkpoint/cache/runner/result及R1交付源码。

绑定的已见原始文件：
- docs/recognition-optimization/RCO-5-008-B8_DEVELOPMENT_DATASET.json：只投影01/07/09的id/sourceText，Expected仅可离线保护hash，不进入前端或适配。
- docs/recognition-optimization/rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/raw-results.json：只取相同三例身份、模型、原始输出和parsed；禁止请求头/密钥。
- 旧mainline01 fixtures提供原8场景，含原condition-unknown抛错语义；无新匿名数据集。
- 原评分/42字段口径只在确认读回后的测试断言使用，不导入适配、runtime或浏览器依赖图。

任何新条件/修订契约、scope候选到完整事实的composer、三值行动性/事件确认UI都需要**另一轮明确授权**。
confirmationV2、repository、Schema、migration、validator、domainCommit及冻结010修改不在本最小包内；无法承接就登记缺口，不能改公共契约救验收。
