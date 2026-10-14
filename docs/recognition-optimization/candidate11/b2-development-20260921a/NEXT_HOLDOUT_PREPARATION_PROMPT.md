# 下一阶段执行提示词：独立人工参照与 Holdout 准备

继续“学生事务管家”的识别优化独立支线，执行 C1：Candidate12 Development 修正、独立人工参照协议与全新 Holdout 零模型调用准备包。

工作区：
`C:\Users\Winner\.codex\worktrees\student-affairs-candidate11\比赛`

分支：
`codex/e2-candidate11-blind-eval`

开始状态：

- B2 已完成 24 次冻结 Development 调用并得出 `REJECT_CANDIDATE11`。
- B2 结果目录为 `docs/recognition-optimization/candidate11/b2-development-20260921a/`。
- 四臂完整来源均为 1/6，均有 D06 Severe=1；V01 较高的描述性 F1 不构成候选晋级。
- 本阶段不得沿用 B2 grant，不得发送模型请求，不得写入权威调用账本。

先阅读并遵守：

1. `AGENTS.md` 与 `PRD.md` 中识别、确认、隐私、预算、发布和 E2 边界。
2. `docs/recognition-optimization/CURRENT_CONTEXT.md`。
3. `docs/recognition-optimization/candidate11/ENGINEERING_AUDIT.md`。
4. B1 准备包全部文件。
5. B2 的 `README.md`、`REPORT.md`、`ERROR_CLASSIFICATION.md`、`ANALYSIS.json`、`ADAPTER_REPLAY.json`、`EXECUTION_LEDGER.json` 和 `VALIDATION.md`。
6. `refine-logs/EXPERIMENT_PLAN.md`、`EXPERIMENT_TRACKER.md` 和 `MANIFEST.md`。

## 一、启动核验与不可变边界

1. 检查当前分支、HEAD、upstream、`git ls-remote` 和工作区状态；来源不明改动必须先停止并报告。
2. 核验 B1 Manifest SHA、24 份 B2 raw、24 份结果、响应 SHA、B2 分析、84 份保护文件及权威账本当前尾部。
3. 权威账本应为 693 行，SHA-256 `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`，tail `13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd`。只读检查；不创建 grant、reserve、settle、halt 或 uncertain。
4. 不修改 B1/B2 来源、Expected、Prompt、raw、评分结果、旧锁文件、旧哈希断言、candidate03、candidate10 或默认候选。
5. 不读取 Secret，不启动付费适配器，不做连通性探测，不调用任何云端模型。

## 二、只使用 Development 失败形成 Candidate12

1. Candidate11 已被拒绝，任何 V00/V10/V01/V11 都不得改名后直接进入 Holdout。
2. 仅依据 B2 Development 错误分类形成新的版本化 Candidate12，不读取或利用未来 Holdout 内容。
3. 修正范围限定为四类可解释约束：
   - 否定、取消、禁止和背景说明不得生成新的当前任务；
   - 材料、格式、地点和联系方式不得单独冒充任务；
   - 多个修订端点必须按动作与对象分别保留，不得把不同旧义务合成一个端点；
   - 完成标准、条件真假/未知、actionable 和依赖必须保持原文关系。
4. 不升级 RecognitionResult 或 Workspace Schema，不新增依赖，不改变模型、temperature、reasoning 或输出上限。
5. 更新 `promptVersion`、candidate 版本、哈希和工程说明；新增匿名工程反例覆盖 D02—D06 的错误族，但不得复制 B1 Expected 文字作为教学答案。
6. 只运行本地确定性构造、Schema、适配器、评分器和回放测试。不得借此报告模型质量提升。
7. Candidate12 工程实现、测试和说明全部完成后先冻结并提交；记录冻结提交 SHA、组件 SHA 和允许进入未来 Holdout 的唯一身份。Candidate12 冻结必须发生在执行者看到任何新 Holdout Expected 之前。

## 三、建立真正独立的人工参照流程

1. 创建独立人工标注协议、空白模板、匿名化检查器、冲突裁决表和签名清单；Codex、ChatGPT、DeepSeek 或其他模型均不能冒充独立人工标注者。
2. 至少需要两个人工角色：标注者 A 和复核者 B。两者不得接触 Candidate12 输出、B1/B2 模型回答、教学例答案或评分结果。
3. 每份参照记录来源提供者、标注者、复核者、时间、是否看过候选、分歧和最终裁决。个人姓名可用稳定匿名 ID，但角色与独立性必须可审计。
4. 人工参照必须明确：最小义务、合法拆合、动作/对象别名、材料、时间、条件、完成标准、依赖、取消/替代端点、歧义与不可判定项。
5. 完整参照和部分参照分开；部分参照不得进入完整来源通过率。未解决分歧保留在分母并阻断冻结。
6. 如果没有真实独立人工参与，只交付协议、模板和校验工具，并将状态写为 `WAITING_FOR_INDEPENDENT_HUMAN_LABELS`；不得自行补写 Expected 或称 Holdout 已建立。

## 四、全新 Holdout 的来源与盲化要求

1. 目标为 12 份此前未进入 B1/B2、历史 Golden、教学例、工程夹具或 Prompt 的匿名来源。
2. 来源应覆盖：单任务、多任务、条件为 true/false/unknown、材料共享、精确和模糊时间、完成标准、依赖、禁止项，以及至少两份多端点取消/替代通知。
3. 每份来源记录出处类型、匿名化方法、首次进入仓库时间、与既有数据的文本/语义重合检查及 `seenStatus=UNSEEN_FOR_CANDIDATE12` 的证据。
4. 先冻结 Candidate12，再由独立人工提交密封来源和 Expected。候选实现者不得参与 Expected 修改。
5. 对来源正文、Expected、Schema、scorer、adapter 和候选分别计算 SHA-256；建立追加式 corrections log。冻结后合法订正只能记日志并使原运行身份失效，不得静默覆盖。
6. 检查与 B1/B2、历史 Expected、Prompt 教学例及工程反例的逐字和高相似重合；超过预设阈值的来源移出 Holdout，不得为了凑数量降阈值。

## 五、零调用 Holdout 准备包

1. 仅在 Candidate12 已冻结且 12 份独立人工参照全部通过后，生成 candidate03 与 Candidate12 的 12×2 配对请求身份，共 24 个 `unitId`。
2. 同一来源两臂必须固定相同输入、referenceTime、timezone、模型、temperature、reasoning、Schema 和输出上限；只允许候选组件不同。
3. 预注册平衡顺序、一次发送、无重试、无 repair、无 verifier、transport/semantic failure 区分、停止条件和候选选择规则。
4. 每个请求保存 request/input/source/reference/candidate/schema/scorer/adapter 的版本与 SHA；重复生成必须逐字节一致。
5. 新建预算授权卡草案，列出 24 次调用与最坏预算公式；官方价格只作当前快照。真正执行前仍须在 24 小时内重新核验，并获得新的明确授权。
6. 本阶段所有请求必须保持 `dispatchAuthorized=false`、`NOT_RUN`。网关需证明无授权、身份漂移、重复执行、过期计价、账本漂移和 Secret 缺失都在任何 reserve 与网络请求前被阻断。
7. 不创建 grant，不预留费用，不写权威账本，不生成模型收据。

## 六、预注册评分与晋级门槛

1. 沿用冻结的一对一结构匹配；不得因看到模型输出新增别名或修改 Expected。
2. 每臂报告 Schema/引用有效率、任务 TP/FP/FN、micro precision/recall/F1、完整来源数、Major、Severe、Forbidden、字段错误、失败类型和逐来源配对差异。
3. Holdout 有效运行要求 24 个单元均有确定结局；部分运行不得选候选。
4. Candidate12 晋级至少要求：12/12 Schema/引用有效、Severe=0、Forbidden=0、教学例泄漏=0，相对 candidate03 不增加任务 FN，不增加任何关键字段 Major，且完整来源至少净增 2。
5. 若门槛未满足，结论预注册为 `REJECT_CANDIDATE12`；不得按较高 F1 临时降低门槛。
6. 结果仍是模型离线识别质量，不是用户接受并保存的转化率。真人转化需另行授权和独立产品实验。

## 七、验证、文档与 Git

1. 运行新增定向测试、`npm run lint`、`npm run test`、`npm run build`、`npm run security:scan` 和 Candidate 隔离检查器。
2. 裸 `npm run test` 若仍因既有 `REAL_INPUT_CARRIERS_MANIFEST` 缺失失败，原样记录，再运行隔离检查器；保留历史 `RCO-5-007 FREEZE_HASH_MISMATCH:package-lock.json`，不得改锁文件或降低断言。
3. 更新当前交接、工程审计、实验计划、跟踪表和索引；清楚区分已完成人工工作、模板、待人工工作和未来待授权模型调用。
4. 按独立交付边界创建 Conventional Commits，并立即推送当前分支；核对本地 HEAD、upstream 和 `git ls-remote` 一致。
5. 不合并、不部署、不修改默认候选、不进入 Production，不开展真人试用。

## 八、停止状态与最终报告

若缺少独立人工材料，停止在：
`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`

若独立人工参照、Candidate12 冻结和 24 个零调用身份均完成，停止在：
`C1_HOLDOUT_PACKAGE_READY_FOR_NEW_AUTHORIZATION`

最终报告必须给出：Candidate12 修正范围与冻结 SHA、人工独立性证据、12 份来源覆盖与重合检查、参照完整性、24 个请求身份、预算卡草案、测试结果、保护文件/账本核验、提交 SHA、远端核验和所有剩余阻碍。不得发送任何 Holdout 请求；下一次付费执行必须由新的明确授权触发。
