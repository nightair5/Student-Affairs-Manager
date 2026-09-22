# C11 A—D4 工程与 Development 执行审计

日期：2026-09-21。起点：593ab7847a5791f8e3fbc6e4b82f94a6c4d0ebb5。

## 授权与 A0

用户已明确授权连续完成 A1—A5、本机独立入口、必要锁定依赖恢复、测试、提交并推送 C11 当前分支。禁止新模型请求、真实账本写入、旧用户库操作、Schema/依赖升级、合并和部署。

- 分支 codex/e2-candidate11-blind-eval，upstream 同名 origin 分支；开始工作区干净。
- Node v24.18.0 / npm 11.16.0；根仅存在 .env.example，不加载任何环境文件。
- 原 BRANCH_BASELINE.json 中 84 个保护文件逐字节 SHA256 全部匹配。
- 账本快照 644 行、314 个 reserve；本分支副本只读，不作为 writer。
- 当前只存在规划，无 candidate11 实现。candidate03/10 保持冻结。
- 原 6632、旧浏览器用户库和线上入口不操作。新入口必须精确校验 Origin/Host 并使用独立数据库。
- 按锁文件恢复依赖；安装脚本仅涉及 esbuild/workerd 二进制及 Tesseract 赞助提示，安装时禁用 lifecycle 后检查现有平台二进制可用性，避免无关脚本执行。锁文件不变。

## 阶段状态

A1—A5实施及验证已交付。B2模型评测、Candidate12 D2失败关闭、D3评分契约和D4 Candidate13零调用冻结已完成。仓库全量门槛仍为 HAS_HISTORICAL_FAILURE / NO_PROMOTION。Candidate13模型效果和真人收益 NOT_OBSERVABLE；合并/部署 NOT_RUN。

## 验证记录

本轮实测见下文及 ENGINEERING_RESULTS.json。历史 RCO-5-007 冻结锁文件差异不修改、不豁免。

## A4 独立产品入口

- 启动：在本工作区执行 `node scripts/serve-candidate11.mjs 6633`，打开 http://127.0.0.1:6633/。只有本机精确Origin/Host可访问；仅静态GET/HEAD白名单，所有服务端写入与模型路由拒绝。端口占用时停止，不杀旧进程。
- 新库：`rco-mainline-01-02-i1-real-input-candidate11-engineering-1`，IndexedDB版本1。沿用canonical v8，没有迁移旧库。独立事件与原答metadata用同object store中的C11键保存。
- 复用真实App、MainlineRuntime、SemanticRepository、semanticComposer、CanonicalWorkspaceRepository与原确认事务。没有新建玩具任务仓库。
- 提供8份既有匿名工程夹具和12份candidate03已见原答。历史candidate10不冒充candidate03接入；该A4入口当时没有candidate11模型结果。后续B2结果只保存在独立评测包，未接入此入口。界面明确标识人工工程夹具与历史回放。
- 原答在独立记录中原样保留；为新SourceVersion重新绑定scope ID，要求文本顺序完全一致且逆映射还原原wire。这个适配不是模型纠错，也不改变历史得分。
- 用户编辑、核对、拒绝、确认通过既有操作历史保存；确认前不创建正式任务；重复打开按操作身份返回已有草稿，不能覆盖确认结果。
- 事件记录source_ready、suggestion_ready、edit_saved、rejected、confirmation_requested、commit_succeeded、commit_failed、readback_verified。工作区成功事件与写入同事务，点击确认不是成功；确认返回后以独立repository再次读回。日志不含正文、密钥或联系方式。
- 事件origin显式区分AUTOMATION、ENGINEERING_REPLAY、REGISTERED_HUMAN_TRIAL和UNKNOWN；当前没有真人试用入口。无自动化标记不视为真人。
- 此入口是固定回放工程工具：不提供新模型识别或新OCR；首页沿用App录入按钮，打开后明确进入回放列表。卡片类别、预计耗时等旧UI兼容估计仍有提示，不作为模型事实或质量证据。

## A4 浏览器实测记录

2026-09-21，Codex Browser工具实际操作新6633入口，query为automation=1。原公开站点标签和旧库未操作。

1. 双任务夹具：来源和草稿先保存，初始0正式任务；编辑第一项名称并显式保存，核对材料required与准备状态，明确核对事实。
2. 开启“模拟下一次保存失败”，加入第一项时出现C11_INJECTED_ATOMIC_FAILURE并显示未确认。刷新后仍为0正式任务、2待确认，编辑及核对保留。
3. 显式重试第一项成功，任务中心只出现1项；刷新和重复打开同夹具，第一项显示已加入、第二项仍待确认，无重复创建。
4. 对第二项记录不需要，刷新后1任务/1草稿；独立读回事件为1成功提交、1失败、1拒绝、1读回通过。
5. 逐一打开其余7类夹具：原文无日期、日期另行通知、纯资讯、条件true/false/unknown及取消替代。unknown/false/旧作废要求阻止加入；没有自动勾选；纯资讯可明确核对而不创建空项目。
6. 历史OS04原答显示2条要求，“公开调查摘要”保留unknown条件并阻断；没有把回放等待写成模型时延。
7. 历史OS03的2条独立要求逐项核对后全部勾选，页面预览为2任务/0项目；点击“加入已选任务（2）”，刷新后独立读回3正式任务/10草稿/31事件，其中2次成功事务、1次失败、1次拒绝、2次读回通过。
8. 1024×900确认页及最终工具区域实际截图检查；修正工具被固定侧栏遮挡的问题。390×844工具区域换行与导航检查通过，随后恢复默认视口。浏览器控制台error/warn读取为空。

浏览器证据来自本轮工具记录，上述是人工撰写的实测摘要，不冒充自动截图文件。IAB的content.export不受支持，因此没有宣称导出截图/浏览器JSON到磁盘。页面提供独立读回与匿名JSON下载，可复查。原答、材料、时间、来源和历史的全图一致性由15项实际runtime/repository测试补充验证。

## A5 验证、失败分类与保护

- 安全等价执行器 `node scripts/candidate11-checks.mjs lint|test|build|security`。test逐段覆盖原npm test的契约、全量Vitest、server、worker、时间AST、multimodal库、RCO-5-007及Functions，再追加C11 Node测试；失败不跳过后续组。
- Vite使用configFile:false/envDir:false；Vitest使用既有envDir:false配置。环境只保留操作系统运行变量，不加载根.env。完整Vitest最终限制2个worker，没有减少测试；独立新temp生成8份工程载体，原载体路径仅被旧测试只读使用。
- 锁定依赖npm ci禁用lifecycle；恢复父工作区现有OCR语言文件用于旧测试静态资源校验，没有下载/升级依赖。未调用Wrangler或生产部署配置。
- 最终Vitest1422通过、1跳过（原ocrLiveComponent需显式活体OCR环境）；server8、worker25、time-parity1、multimodal-lib23、Functions5通过；C11评分44、历史1、网关9、静态入口5通过；旧预算/网关124通过。C11构造7、身份6、真实runtime15已包括在Vitest总数中。
- 类型、构建、契约、安全扫描通过；lint0错误、5条非阻塞warning（4条既有、1条C11生产入口无热更新组件提示）。
- 新增功能失败：0。历史失败：RCO-5-007为3通过/1失败，FREEZE_HASH_MISMATCH:package-lock.json；父工作区只读重跑同样失败。没有改旧hash或锁文件。
- 环境/暂态失败：首次Windows行尾导致契约/历史原答校验失败；逐文件证明与HEAD及父工作区仅行尾差异后恢复原字节，无Git内容变化。旧carrier/OCR资源恢复后通过。一次全量并发下旧OCR timeout测试未观察到terminate，保留本轮失败记录；同代码限定2 worker后全量通过，不改变断言。
- 未执行：真实OCR效果、任何candidate11模型/连通调用、真人收益、合并、部署、线上验收；没有调用npm audit或cloudflare:check，因为本次非发布且后者读取旧部署配置。
- 原84份保护文件hash匹配，ledger 644行/314 reserves且SHA不变；父分支及工作区未修改。全套存在历史失败，工程交付不构成合并或上线许可。

## B1 最小准备与现存阻碍

只准备6来源×4变体Development包，不执行24次请求。先给出完整结构化参照、字段覆盖、拆合边界、别名和歧义裁决；单作者/模型标签必须如实标记，独立人工验证仍缺位。冻结来源、参照、候选/示例/Schema/评分器/适配器和逐请求hash；固定参数、平衡调用顺序、预先写失败处理和候选选择规则。

确认唯一权威账本位置及跨进程锁方案，给出最新官方计价依据和最坏预算提案；不读Secret、不创建grant/预留/收据、不发送请求。原314次许可已耗尽，新授权尚未取得。历史RCO-5-007失败保持单独发布阻碍；不通过改旧Expected/锁文件取得绿色。

### B1 零调用准备结果

- 交付目录`candidate11/b1-preparation/`，manifest SHA-256 `af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e`。保存6份来源、6份完整工程参照、实际模型Schema、24个prepared packet、逐文件/逐请求hash、设计、审查、计价和预算卡。
- 来源均为作者已见Development；参照为模型辅助单作者，独立人工复核PENDING。完整字段覆盖不冒充独立人工真值；历史Expected与旧结果未改。
- V00/V10/V01/V11只切换M/E；同来源四臂的输入、模型、temperature 0、reasoning none、8192输出上限、Schema、referenceTime、timezone和适配器一致。24个身份唯一，最大请求体19,908字节。
- B1定向测试5/5通过；重复生成字节一致，身份/请求/上下文漂移拒绝，重复派发与无授权派发均返回拒绝，84份保护文件和旧账本保持不变。
- 联合评分/网关测试58/58通过；隔离全量Vitest 1422/1422通过、1跳过，server、worker、Functions及其余candidate11组通过。最终验证记录见`b1-preparation/VALIDATION.md`；历史RCO-5-007失败仍单独保留。
- 唯一权威账本只读位置为`C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl`；candidate11副本与其逐字节一致：644行、314 reserves、SHA `dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597`。writer未打开。
- 2026-09-21按DeepSeek官方V4.1 Flash峰值、缓存未命中价核验；严格最坏预算为¥51.904512。实际账单仍NOT_OBSERVABLE；无新grant、reserve、receipt或请求。
- 当前状态`B1_PREPARED_FOR_REVIEW / MODEL_CALLS=0 / AWAITING_NEW_MODEL_CALL_AUTHORIZATION`。历史RCO-5-007仍为`FREEZE_HASH_MISMATCH:package-lock.json`，不改旧锁或发布门槛。

### A1 评分与历史诊断

- 44项评分反例/正常对照通过。独立 scorerVersion、最大基数一对一、字段判定、歧义裁决、空集合null及解析失败分母已实现。
- 24份历史原答的请求、响应、账本哈希链和逐项usage结算一致，现有客户端解析和语义组合全部接受。
- 已定义检查：A 9/12、B 11/12；全部24个参照仍为partial，因此完整案例准确率null、NO_PROMOTION_REFERENCE_INCOMPLETE。不是人工盲审或真实转化率。
- lint、类型、无.env构建通过；完整Vitest首次存在3个旧测试的检出/载体问题，RCO-5-007冻结图也受检出行尾影响，A5继续核验，不修改旧断言。
- 契约检查首次受Windows混合换行影响。核实四个文件与HEAD和父工作区只差行尾后，在本工作树恢复父原字节，未改变Git内容；识别契约与时间AST检查随后通过。无Schema升级。
- 全部标准测试分段执行，不因早期失败跳过后续Node/Functions。原始日志位于.data/candidate11/checks/，最终汇总另存可提交报告。

### A2—A3 候选构造与执行保护

- candidate11 公共底座为 candidate03 加完成标准最小修正；四变体 V00/V10/V01/V11 仅切换元指令与教学例，模型及其他参数固定，可见版本一致。保留旧八例并新增两例完成动作/明确结果目标对照。candidate03/10 请求重建逐字一致。
- prepared / binding / result / analysis 贯通候选、提示词、例子、Schema、输入、请求、模型配置和评分器身份；从原上下文重新构造校验，不能靠重算外层 hash 接受错误元数据。
- 所有阶段产物均为 ENGINEERING_NO_AUTHORIZATION / NOT_RUN；没有 C11 付费运行授权或生产接入。有效 prepared 仍被 dispatch 拒绝。
- 7 项候选构造 + 6 项身份测试通过；新网关失败保护 9 项通过。原预算/网关全量 124 项通过，全部使用独立临时目录和 Mock；没有真实模型请求、Secret 读取或真实账本写入。
- lint / typecheck / build / security 通过。完整测试的旧历史换行问题已逐项恢复原字节；旧 RCO-5-007 锁文件冻结差异保留。A5 最终全量结果继续单独记录。

## B2 24次冻结Development消融

- 用户明确授权B1 Manifest内24个身份、`deepseek-flash`固定参数、新专用grant、权威账本追加和¥51.904512最坏费用上限。代码先提交推送，本地/远端/待执行HEAD一致后才派发。
- 使用新持久绝对锁目录、原子mkdir和排他owner；每单元锁内按冻结顺序reserve，解锁后只发送一次，raw落盘后再锁内settle。最终1 grant、24 reserve、24 settle；0 retry、0 repair、0 verifier、0 halt、0 uncertain。
- 24次均HTTP 200且usage可审计。本地峰值价费用上界¥0.523928；provider实际扣费`NOT_OBSERVABLE`。账本最终693行、SHA `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`、tail `13b520d270d26335072f99920e47a4443e8bc586365eb20cda61c4122d7ab3bd`。
- 发送期派发器把不存在的`packet.context`交给适配器，24个结果文件因此记录本地适配失败。原始raw未损坏；冻结raw、冻结适配器和冻结`packet.prepared.context`只读重放24/24通过。保留原始错误分析，另存`ADAPTER_REPLAY.json`与正式后处理分析；没有修改模型JSON或新增调用。
- 正式评分：V00/V10/V01/V11完整来源均1/6；F1依次75.86%、75.86%、78.57%、71.43%。四臂Schema/引用均6/6有效、教学例越界0，但均因D06非法合并两个已作废旧端点而Severe=1。
- V00有2 FN、5 Forbidden并发生关键修订端点回归，按预注册规则决定`REJECT_CANDIDATE11`。M、E、M×E以完整来源数描述性差分均为0；不得据此选择增强臂或进入Holdout模型调用。
- 全套结果、逐请求账本绑定、错误分类和验证记录位于`candidate11/b2-development-20260921a/`。数据仍是已见Development、单作者模型辅助参照，不是独立人工真值或真实转化率。
- 历史RCO-5-007继续为`FREEZE_HASH_MISMATCH:package-lock.json`；未改旧锁、Expected、冻结hash或发布门槛。默认候选、旧库、Preview和Production均未修改。

当前停止状态：`B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW`。下一阶段只能准备独立人工参照与全新Holdout；在参照独立性、盲化、冻结和新授权完成前不得发送Holdout请求。

## C1 Candidate12 与独立人工准备

- Candidate12 只使用B2 Development错误类别形成四条任务守恒规则，不使用未来Holdout来源或Expected；无教学例、不改Schema/适配器/评分器/默认候选。11项构造与边界测试通过。
- 候选在提交`c03368054ff8c357f055658c2d2d39b45bbcb761`先行冻结并推送；candidate bundle SHA为`880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a`。冻结核验绑定B1/B2、84份保护文件和693行权威账本。
- 后续包只创建人工协议、12个空槽、参照/签名/裁决模板、提交Schema、63条已见语料排除库、验证器、预注册与预算草案。验证器定向测试4/4通过，能拒绝空模板、模型辅助、个人信息、已见重合和覆盖不足。
- 没有真实独立标注者参与：实际来源0、完整人工参照0、请求身份0。未创建grant或预算预留，未读取Secret、未调用模型、未写账本。

当前停止状态：`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。只有两位不同真实人员完成12份密封双审参照并通过校验后，才允许另包生成24个`dispatchAuthorized=false`请求身份。

## C2 Codex 临时 Development 包

- 用户要求由Codex自行制作一份材料后，新增12份完全合成通知及12份结构化参照，状态固定为`PROVISIONAL_MODEL_AUTHORED_DEVELOPMENT_ONLY`。
- 包内明确记录`modelAssistanceUsed=true`、独立人工标注者0、独立人工复核者0和`eligibleForIndependentHoldout=false`；独立人工验证器必须拒绝它。
- 12份正文覆盖既定场景并加入已见排除库，排除库由63条增至75条。它们只可用于Development结构检查，未来真人来源不得逐字或高相似复用。
- 未生成正式24身份，未调用模型API，未读取Secret，未创建grant/reserve/settle，未写权威账本，未修改Candidate12、默认候选、Schema、scorer或adapter。

当前停止状态仍为`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

## D1 临时 Development 24 个配对身份

- 将C2的12份合成来源与provisional Expected物理拆分；来源文件不含参照，24个请求仅从来源构造。数据角色固定为`SEEN_SYNTHETIC_DEVELOPMENT / PROVISIONAL_MODEL_AUTHORED`，`eligibleForIndependentHoldout=false`，主张上限为`ENGINEERING_SCREENING_ONLY`。
- A臂为candidate03，B臂为冻结Candidate12；仅在D1隔离包装器中把A臂模型路由固定为`deepseek-flash`。两臂的temperature、reasoning、输出上限、Schema、输入、referenceTime、timezone和adapter一致，candidate03/Candidate12源文件均未修改。
- 24个身份按PD01 A→B、PD02 B→A交替冻结；A/B各12，全部`dispatchAuthorized=false`、`NOT_RUN`。请求身份绑定来源、候选、Prompt、Schema、scorer、adapter和candidate bundle哈希。
- Expected污染测试会实际改动一份provisional参照并重建请求，24个request SHA保持不变；来源、Prompt或模型参数变化则改变请求SHA。身份、请求和上下文漂移均被拒绝。
- 独立执行入口不包含模型客户端、Secret reader、预算writer、raw writer、retry、repair或verifier；当前任何派发都在外部操作前固定失败为`D1_MODEL_CALL_NOT_AUTHORIZED`。
- 定向Node测试11/11通过；84份保护文件一致，权威账本仍为693行、572913字节和SHA `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`，writer未打开。模型调用、Secret读取、grant/reserve/settle/receipt/raw和账本写入均为0。
- lint为0 error/5个既有warning，build与security scan通过。裸`npm run test`为1432通过/1失败/1跳过，唯一失败仍是未设置`REAL_INPUT_CARRIERS_MANIFEST`；隔离入口补齐临时匿名carrier后Vitest 1433通过/1跳过，其余Node/Functions组通过，只有历史RCO-5-007保持`FREEZE_HASH_MISMATCH:package-lock.json`。

当前停止状态：`D1_PROVISIONAL_DEVELOPMENT_IDENTITIES_READY_FOR_AUTHORIZATION`。这只表示临时Development的24个零调用身份可审查；它不解除正式人工Holdout的`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`，也不证明Candidate12优于candidate03。

## D2 Candidate12 临时 Development 配对执行

- 用户在收到“24次、¥51.904512最坏上限、唯一权威账本writer”的具体下一步后明确要求执行。执行器、预算锁和6项定向测试先在提交`b44c47335a579c94d7749a632acc4997c64bb390`提交推送，本地/upstream/远端一致后才创建grant。
- grant `dda1a7f0-b703-435c-bff9-37e328ed26b6`绑定D1 Manifest、24个unitId、逐请求SHA、候选bundle、Schema、scorer、adapter、代码HEAD、693行账本前缀和12小时官方价格证据。专用绝对锁支持raw已持久化后的零重发续结算；无raw的pending固定转uncertain并停批。
- 24/24请求按冻结A/B顺序一次发送，全部HTTP 200且settled。新增1 grant、24 reserve、24 settle；0 retry、0 repair、0 verifier、0 halt、0 uncertain。输入109,392 tokens，输出27,158 tokens；本地可审计费用上界¥0.436048，provider实际扣费`NOT_OBSERVABLE`。
- 权威账本从693行/572913字节增至742行/631869字节；最终SHA `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`，tail `6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922`。
- 首次正式评分发现冻结接口不兼容：10份含任务来源的`scorerReference`都缺少绑定评分器要求的`actions[]/objects[]/fields`，并使用自然语言checks，触发`C11_REFERENCE_IDENTITY_INVALID`。没有修改Expected、scorer、旧hash或门槛；正式决定按失败关闭为`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。
- 事后任务结构诊断明确标注`notPreregistered=true`：candidate03 TP/FP/FN 13/2/5，P/R/F1 86.67%/72.22%/78.79%；Candidate12 16/1/2，94.12%/88.89%/91.43%。两臂诊断完整来源均6/12；Candidate12仍有Forbidden=1，完整来源未净增2。该诊断不构成晋级或真实转化证据。
- 发送前D2定向测试6/6、D1+D2联合17/17通过；发送后复跑联合测试为1/17通过、16项因693行前缀已合法追加至742行而按设计拒绝，未改旧锁或旧哈希来迁就测试。发送后只读`analyze-candidate12-d2-postrun.mjs --verify`、lint、build和security均通过。裸全量测试仍有既有`REAL_INPUT_CARRIERS_MANIFEST`未设置失败；同一A02测试单独1/1通过。历史RCO-5-007继续为`FREEZE_HASH_MISMATCH:package-lock.json`。
- 默认候选、Schema、旧库、Preview、Production、D1身份和正式人工Holdout均未修改或运行。

当前停止状态：`D2_EXECUTION_COMPLETE_SCORING_PACKAGE_INVALID / REJECT_CANDIDATE12_ENGINEERING_SCREEN`。下一阶段只能先进行D3零调用评分契约修复和新数据前预注册；正式人工Holdout仍为`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。


## D3 未来评分参照与评分器契约修复

- 新建`candidate12-reference-contract-3.0.0`、`candidate12-reference-compiler-3.0.0`、`candidate12-scorer-input-3.0.0`和`candidate12-scoring-3.0.0`。validator、compiler和scorer分层；compiler只读取参照，候选输出不能补全Expected或改变reference SHA。
- 参照强制使用`actions[]`、`objects[]`和成对别名，并结构化表达状态、有效性、actionable、条件、材料、时间、完成标准、依赖、修订/取消/替代、合法/禁止合并、禁止推断和歧义规则。无任务固定为空数组；材料、地点、格式、联系方式和背景不能冒充任务。
- 24类匿名接口夹具各有一份合法及拒绝案例，共48份；64项定向测试全部通过。invalid reference与prediction schema failure分离，不以0分掩盖接口错误。
- 历史只读报告确认D1的12份参照均不能直接进入v3：10份含任务参照缺少任务身份数组或字段规则，12份含自然语言checks。禁止自动转换；D2正式决定仍为`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。
- Candidate13仅形成`PLANNED_NOT_IMPLEMENTED_NOT_EVALUATED`变更计划。它必须在任何全新评测Expected对实现者可见前冻结；D2来源、输出和D3夹具不得证明其提升。
- 冻结校验：84份保护文件通过；D2 Manifest 60份文件、24 raw、24 result通过；D1/D2聚合SHA保持`4afa5b08…0855a5b`/`2074b893…b6d53`；权威账本只读保持742行、631869字节、SHA `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`和既有tail。
- 本阶段模型调用、Secret读取、grant、reserve、settle、账本写入、正式Holdout、真人、Schema/依赖/默认候选变更、合并和部署均为0。
- D3测试64/64、lint 0 error/5 warning、build和security通过。裸`npm run test`保留3个既有环境/暂态失败；匿名carrier隔离入口Vitest 1433/1433通过、1跳过，其余工程组通过，唯一非零项仍是历史`RCO-5-007`的`FREEZE_HASH_MISMATCH:package-lock.json`。

当前停止状态：`D3_SCORER_CONTRACT_READY_FOR_FRESH_DATA`。下一步可先零调用实现并冻结Candidate13，或组织全新数据与真实独立人工标签；任何模型调用、预算账本写入、Holdout、Preview或Production仍需新阶段和授权。

## D4 Candidate13零调用冻结

- Candidate13版本为`real-input-source-semantics-13`，Prompt版本为`recognition-prompt-candidate13-1.0.0`。它继承Candidate12基底，只追加六类已见D2错误族控制：言语行为与当前性双门、条件与actionable分离、多端点逐项记账、跨对象合并禁止、附属字段保真、召回防规避。
- 新增28类匿名工程夹具，全部标记`SEEN_ERROR_FAMILY_SYNTHETIC_ENGINEERING_REGRESSION_ONLY`，不具备全新Development或独立Holdout资格。工程回归验证规则、身份、隔离和构造，不伪造模型识别分数。
- Prompt、Schema、adapter、D3 reference/compiler/scorer、fixture与Candidate bundle都进入可重算SHA绑定。任一组件漂移均失败关闭；无授权派发固定返回`D4_MODEL_CALL_NOT_AUTHORIZED`。
- D4 Node 46/46、Candidate13 Vitest 9/9、D3 64/64通过。隔离全量Vitest 1442/1442通过、1跳过；server 8/8、Worker 25/25、Functions 5/5与C11各Node组通过。裸`npm run test`依旧因缺少`REAL_INPUT_CARRIERS_MANIFEST`导致candidate02 launcher的1项失败；隔离执行已通过该项。
- 保留历史`RCO-5-007` 3/4通过及`FREEZE_HASH_MISMATCH:package-lock.json`。D1/D2/D3冻结聚合SHA、84份保护文件与742行权威账本均一致。
- D4模型调用、连通性探测、Secret读取、grant/reserve/settle、账本写入、全新Expected读取、正式请求身份、真人试用、合并和部署均为0。
- 当前停止点为`D4_CANDIDATE13_FROZEN_READY_FOR_FRESH_DATA`。下一阶段必须使用冻结提交之后创建的全新匿名Development，或两位真实人员密封双审的Holdout；先经D3 validator/compiler，后续模型调用须另行核价、预算、grant和明确授权。

## D5评分、指标与全新Development审计

- 初始`b1bebff`之后发现时间点`actionable`无法由现有输出Schema表达；v4.0在零调用、零raw/result时作废。现行v4.1评分合同以`ee6ee45caa4e1bd258237ccb4c6bc9792d0c9e34`重新冻结并推送，D5-R1数据在该提交之后重建。
- v4纠正四个已复现漏判：材料格式/必需性错误、无据材料、无据依赖、无据审批完成标准；同时将多个最大匹配固定为待裁决。
- D5创建12份冻结合成Development和12份完整参照；全部如实标记模型辅助单作者，独立人工参照0，不冒充Holdout。
- 24个请求身份的Expected与请求物理分开；两臂非Prompt字段一致，请求哈希唯一，派发开关全部关闭。
- 本地重合检查的最高bigram Jaccard为0.15873，12份均低于0.8阈值；这是本地筛查，不是概念独立性证明。
- 四项指标中，工程计算和本地最小事件sidecar已实现；Candidate13首次整份正确率仍`NOT_RUN`，真人正确处置、低修改处置和主动修改时间仍`NOT_OBSERVABLE`。
- 模型调用、Secret、grant/reserve/settle、账本写入、真人试用、默认候选修改、合并和部署均为0。权威账本保持742行及SHA `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`。
