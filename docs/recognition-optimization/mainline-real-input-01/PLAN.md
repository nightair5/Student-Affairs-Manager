# MAINLINE-REAL-INPUT-01：真实输入到正确任务，单一完整包

状态：范围设计，尚未授权实施/调用。核验起点 `0eedbf7fc1523d6be476c704ed02b273bdb513bf`；业务来源 `1ae10d8afef8c27fbf2f27ca44072a5ffa98612f`。唯一仓库与分支沿当前授权。2026-09-06编制。

## 1. 一次交付什么

在本机隔离实验入口，用户可以提供文字/TXT/Markdown/明确支持的图片与PDF，看到读取范围、逐页结果和漏读提示，校对并明确保存；确认实际发送文字后获得真实模型建议，核对或修正关键事实，部分/批量确认，刷新后在任务中心/首页/日历/详情找回，并导出与独立仓储一致的JSON。

北极星是“用户正确确认一整份通知”，不是接口成功或产出文档。本包连续完成接线、工程格式验证、受预算约束的模型试验、范围内纠错、独立审查、工程、真实Edge和Git交付。代码可交付与模型质量不足分开报告；未完成必要真实环节不得称整包完成。

本次仅新增本目录5份获准文档、短CURRENT_CONTEXT及追加日志。下述41源码/测试/脚本路径均为待批准白名单，不因本文件自动获准。

## 2. 已有链路与准确缺口

| 位置 | 已有证据 | 本包必须补的交接 |
|---|---|---|
| `src/lib/fileExtraction.ts` | 本机编码识别、PDF逐页parser/OCR、图片OCR、pages/spans/chunks/hash；20MiB、80页文本、6页OCR原限制 | ready仍可带partial；有文本的页不自动OCR；明确新支持上限、页内混合风险、取消、资源本机化 |
| `IntakePanel.tsx` processFile/handleParse | 已有文件选择、OCR进度、文字校对；reviewMetadata只摘部分摘要 | 原完整读取结果/逐页信息没有完整传递；选择新文件/关闭时恢复与旧完成回调失效；显式保存/实际发送文字绑定 |
| `App.tsx` IntakePanel props及runtime.capture | 真实App可注入隔离runtime；目前一律textOnly，状态文案固定“无模型外发” | 新能力开关、读取草稿恢复、真实网络状态与逐次发送授权；旧默认不变 |
| MAINLINE05 capture/state/repository | 来源先存、人工响应→语义→确认→联合全图存储已验收 | capture/canAct/Run校验多处固定manual/human_engineering，不是删一个if就能接模型 |
| MAINLINE04 composer/contract | 完整SemanticInput、三值/修订/时间归属、来源检查 | 只增显式模型身份分支；来源有效不等于语义正确，不能把live模型冒称人工/已见模型 |
| MAINLINE05 edits/view | 当前title和受支持deadline显式保存；共享/依赖/已确认保护 | 用户事实核对与有限结构纠错的追加历史、有效视图、当前勾选需一致 |
| 新回环服务 | 旧05启动器仅静态、connect-src none；旧B8仅独立runner | 新同源文本桥、全局预算账本、OCR静态资源、无密钥浏览器；不能复用稳定接口或旧runner |
| 检查与交付 | 原26本机SHA、863保护、4计划、20静态证据及历史工程 | 新候选按新授权基线/审核SHA验证；旧checker历史HEAD失败不改成PASS |

依据文件SHA见CHECKS及白名单。原26实现仍与交付现场逐字一致；24 Git blob相同，2项仅CRLF存储转换，沿旧delivery的双身份处理，不忽略历史换行或重建freeze。原1117/131/42等是历史层，本次未重跑、不算新产品成绩。

## 3. 有边界的输入支持

这是内部实验支持范围，不缩减PRD商业验收矩阵，也不是G3/G4已通过。

| 输入 | 本包拟承诺范围 | 超限/不完整处理 |
|---|---|---|
| 粘贴文字 | 非空，最多24,000字符；不经OCR | 超长保留原文并选明确范围；不slice头部冒充全文 |
| TXT/Markdown | 最多2MiB；复用UTF-8/BOM/GB18030；结构顺序保留 | 解码不确定需选编码/粘贴；不得带乱码请求 |
| PNG/JPEG/WebP | 单张最多10MiB、解码后最多20百万像素；校验文件签名与MIME | HEIC/SVG/GIF、坏图、超像素明确不支持；仅声明已验收介质/质量 |
| 文本/扫描/混合PDF | 最多20MiB、最多6页；每页都必须有终态 | 加密/损坏失败；超页不完整，不自动调用；可用户选≤6页范围但标部分来源 |
| DOCX、URL等 | 本包入口不开放 | 复用旧能力不等于本包支持，不新增远程抓取 |

“PDF页有文本”不证明页内图片的文字已覆盖。新提取profile应检测页内图像/绘制不确定性，必要时对该页本机OCR，保留两路结果与待核对差异，不按置信度静默择一。无法可靠判明覆盖时明确待核对，不把empty当“这页确实没信息”。所有页必须标明parser/ocr/empty/error/unprocessed及范围；已读空白需与未处理区分。

本地原始读取输出、页文本、合并显示文字、用户校对文字、发送范围分别保存hash与映射。PDF显示页标记是程序生成元信息，不能作为原文证据。OCR不是忠实转写保证；低质量/日期数字疑点提示校对或重拍，仍单独记录原始OCR质量。

文件本体不持久化，因此关闭/刷新后可恢复已保存的文字、页级终态和核对记录，不能承诺自动续读未保存的图片/PDF。未完成读取需要用户重新选择同一文件，先核对文件hash与范围；尚无hash时按新读取操作处理。已保存文字不丢，未完成页明确等待重新选择，不能默用别的文件或将原任务标成读取成功。

新profile复用原函数，不另造OCR/解析器。原默认80/6页与20MiB不改。新OCR资源从已安装tesseract/pdfjs及根目录已有chi_sim/eng traineddata按实际SHA白名单本机提供；未核验资产不得fallback CDN。首次公开资源下载若确有必要，应先申请资产路径，不临时新增依赖。

## 4. 最小设计决定

### 4.1 版本与来源，不改全局v8

- WorkspaceV8、全局Schema/capture/repository/validator/confirmationV2/domainCommit保持只读。
- 复用`mainline04-task-semantics-1`字段和引用，不建立第二套同义语义图。
- 在原`draft.legacyData.mainline05`槽位加入显式判别联合`mainline-real-input-state-1`；旧`mainline05-semantic-state-1`完整保留。槽名复用不表示新数据是旧人工响应。
- 来源附加`real-input-receipt-1`：真实sourceType、文件名/MIME/大小/hash、提取器版本、逐页覆盖、原始提取、校对操作、发送快照、引用映射、显式授权。只存文本/元数据，不存文件本体、data URL或base64。
- 新库前缀`rco-mainline-01-02-i1-realinput01-`；全新空库，只能由新启动器初始化。刷新必须找回同库，丢库/坏数据失败，不fallback用户库或MAINLINE05旧库。
- 读取阶段复用既有saveSource保存来源及读取草稿。首次未改文字保存/发送，复用当前SourceVersion，以现有beginRetry建立本地Run/Draft；此方法名仅指本地建档，不授权网络retry。内容实质改变才用beginRevision建立新不可变版本。既有beginRevision按trim判断相同：仅首尾空白变化本包在保存前明确拒绝并保留缓冲，不静默trim、不声称已保存、不改公共capture；普通逐键正文更正应成功。
- 开始模型请求前Source/SourceVersion/Run/Draft及发送receipt必须落库，不覆盖旧版本。新state历史草稿始终核验其自身version/run，不强求等于Source.currentVersionId；Source聚合status只按当前版本最新Run计算。旧版本已确认canonical和历史保持，旧未确认草稿在新版本出现后明确过期，不自动再次写入。
- 旧legacyView的Source.rawText是currentVersion投影；已有App.selectDraftForReview已按draft版本读原文，不存在本轮已证实的历史错引故障。新profile须复用这条保护，App/面板/View按draft.sourceVersionId及其receipt提供原文，不能新开旁路绕过。重新打开旧draft定位旧版本证据，新版本与旧已确认项都可刷新找回；legacyView本身只读。
- 新profile保存、修订、建Run均先在独立内存WorkspaceRecordStore快照复用CapturePersistenceService构造完整候选，再联合全图校验并在同一真实事务CAS落库、独立读回；禁止直接写canonical后再load才发现无效。新source-only/pending/sent/failed/needs-review阶段分别验证，遍历全部Source/SourceVersion及前后历史身份，不能只遍历draft而漏掉source-only。没有模型结果的读取草稿不能走成功确认投影。原人工profile写入方式不改。
- 模型Run.provider使用现有deepseek枚举；人工回放仍manual。model/prompt/pipeline版本来自本机固定配置及真实响应核对，不来自模型自报字段。

### 4.2 模型只提供需要AI理解的部分

`real-input-model-wire-1`是现有语义类型的投影，不重建枚举：任务及实体的本次局部引用、scope选择、动作/对象表面、语气/状态、条件/修订归属和完整材料/事件事实。

本机生成source/version/fingerprint、字符位置、逐字证据、稳定canonical ID、时间AST/归一化、selected和最终计划；模型禁止输出这些权威字段。模型可引用本次局部实体标签，但不得输出工作区稳定ID。时间值来源必须可定位；归属由候选提出、本机引用校验，时间归一化继续唯一AST。

原始HTTP响应、原始output_text及解析对象、适配SemanticInput、首次建议、后续用户操作分别存储。rawOutputText必须是真实原始输出；不能为适配而重写文本后冒称原响应。全对象比较忽略对象键序/JSON空白，不忽略数组顺序、缺字段、值或类型。结构失败记录失败；不能用本地fallback冒充模型成功。

根来源/版本或全图引用无效拒绝整个capture；单项证据或语义待核对不连坐独立有效兄弟。信息未覆盖时禁止把空tasks记为正确纯信息。

### 4.3 默认选择与用户确认的明确决策

首个live模型版本没有独立语义证明，因此模型建议初始不自动勾选，显示“模型建议，尚未逐项核对”。这是待批准的安全策略，不是声称自动选择准确率100%。

用户必须实际查看该项完整相关事实和依据，作出显式“本项事实已核对”操作，再主动勾选/确认；UI打开、停留、selected=true不能代替核对记录。变化后的关键字段或关系须使旧核对记录失效。结构、引用、未知触发、禁止/取消、高风险、未确认前置和已确认实体保护仍由提交器独立检查，不能靠核对按钮越过。

必须有模型候选实际被用户核对并成功确认的非零正例，不能全部拒绝或全部保持未选过闭环门。初始默认全关闭时“自动选择能力”写NOT_ENABLED，不给安全质量加分；另外统计未默认选择的有效项、需要核对次数、拒绝/未知率和完整确认成功率。模型语义错误即使未勾选也计入误项/Forbidden/整案错误，不能被保守选择遮蔽。

本包不承诺自动勾选能力或G5/G7通过。若后续要开放模型自动默认，须有独立语义质量证据与新的显式策略批准，不在本包用关键词补丁解决自然语言真值。

### 4.4 最小人工纠错，形成有效事实而非改显示值

新事实纠错slot嵌入真实DraftReviewPanel，复用同一SemanticInput字段，操作为追加delta，保存后重算有效图；原始模型/首次建议不变。

新profile统一effectiveFacts入口，semanticState的life/canAct/editTimeSupport/canonicalFacts/信息处置/联合校验、semanticView的草稿/日期/优先级、runtime事件数量及SemanticFacts都使用同一已保存修订后事实。raw/first只用于原始展示、追溯与首次评分，不让某个消费者悄悄使用旧值。人工新增日期/材料字面值由manual delta独立标源与本机验证，不能硬塞原文scope再交composer伪装逐字证据；composer只验证仍宣称来源支持的事实。

支持未确认项的：标题、动作/对象的原文scope选择、普通截止或无日期补日期、材料名称/数量/格式/命名/提交渠道及其显式归属。新用户补充须明确标manual，不伪造为OCR/模型原文证据。对关系改变重新检查受影响完整实体并集和依赖。条件/修订状态可由用户在完整原文核对后明确记录处置，但不能把unknown强改false或以选框替代事实修改。

本包不提供任意创建新任务/删除实体/重写稳定ID、跨来源修订、已确认实体改写、共享/多个/开始/事件时间的自由编辑。不能承接的编辑在保存前拒绝并解释，不显示已保存后用旧值确认；有效兄弟仍可操作。这些受限操作不算验收成功。用户可退回原文/读取草稿明确更正；再次模型调用必须消耗本包授权单元，不能自动重试。

### 4.5 服务、网络与隔离

新本机启动器默认replay，只有显式live且有效模型授权、预算门通过才可出站。挂载真实App；不得读取现有用户标签/数据库或开放旧整份草稿自动保存、演示迁移、通知、URL抓取、图片外发、未纳入页面。

浏览器只访问本origin静态资源与固定识别路由。服务仅绑定127.0.0.1，验证Host、Origin、随机会话能力、JSON体/字段/长度、当前来源及请求hash；并发=1。服务器唯一模型目的地`https://api.deepseek.com/responses`，禁止重定向、任意endpoint、工具调用、图片/文件上传和隐式重试。

复用现有合法服务端环境Secret，浏览器不接触；不读取剪贴板，不回显值，不自动从Cloudflare导出Secret。服务端未配置时记录not-configured，只在需要时申请一次安全配置。本轮没有读取凭据，配置可用性为NOT_CHECKED。

隔离CSP仅放行本机worker/WASM/静态资源和同源POST；对旧styles.css已定位Google字体import，只允许新启动器在内存实验bundle去掉该外部import并测试转换边界，旧CSS逐字不动。静态资源表固定，拒绝路径穿越与任意文件服务；不fallback CDN。live bundle禁止导入Expected、评测器、旧夹具和seenInputs；回放/格式工具另用测试侧入口。

## 5. 白名单和可回退性

精确清单见IMPLEMENTATION_WHITELIST.json：13个已有文件显式增量，28个新增路径，共41个源码/测试/脚本路径。不是41个业务功能；新路径含9个服务/检查/格式脚本和独立回归，避免实施中再临时扩大权限。

唯一MAINLINE04例外是semanticComposer.ts的显式新profile/来源身份；其余7项只读。MAINLINE05旧测试只读，所有新断言落新测试路径。全局Schema/repository/capture/validator/confirmationV2/domainCommit、时间AST、依赖、旧runner和freeze/Expected/dataset/checkpoint/cache不改。DomainCommit现有隔离函数已能接收完整nextDraft和canonical计划，拟直接复用，不先申请不必要改动。

回滚是关闭新启动器/实验profile、保留新库和所有证据；不导入稳定库、不清库、不回切或覆盖用户修改。若联合旧接口无法表达新版本，报告精确冲突再申请，不能伪装旧v8天然支持。

## 6. 单包执行与验收

唯一流程：基线/保护→零调用真实输入与回放最小闭环→定向/对抗→独立实现审查→适用完整工程→真实Edge/本机OCR→批准的付费批次→已见结果回放及范围内修补→仅变化链路重验/必要新独立审查→最终分层工程与Edge证据绑定→Git交付。

模型阶段采用A/B首次、可选C新候选验证，最多24次、硬上限10元的条件方案，详见VALIDATION_AND_BUDGET。C不是传输retry或Repair，也不是新盲测；保留首次版本全部失败。不保证24次一定让模型达标。超预算不继续；模型主因无改进时记录瓶颈，不能靠无限付费或关键词救分。

可复用未变SHA证据；新profile、模型身份、文件网络、版本历史及事实纠错必须重验。原1117等工程数量不是本包目标，不重抄旧报告。真正的PASS条件是完整用户旅程、安全与相应质量门；按工程/模型已见诊断/未见泛化/真人/发布分层。

## 7. 一次实施授权提示词（本轮尚未生效）

> 授权实施MAINLINE-REAL-INPUT-01完整包。以本方案最终文档提交及live远端为起点，按IMPLEMENTATION_WHITELIST.json的41路径与职责实施，明确批准13已有文件的显式新profile增量及28新增路径。批准新隔离state/input/model-wire版本，旧接口/default、全局Schema/repository/capture/validator/confirmationV2/domainCommit、时间AST、旧测试/冻结/Expected/dataset/checkpoint/cache只读；不回切、不套旧补丁。
>
> 复用真实App和旧8匿名通知，允许仅为工程验收生成这些旧通知的PNG/JPEG/WebP/PDF格式夹具，不新增语义数据集或改答案。完成本机读取/校对/范围保存、真实模型来源接线、事实核对与获准纠错、部分批量确认、原子保存、下游查找及真实下载对独立读库。
>
> 明确接受本试用包live模型初始不默认勾选，必须实际逐项核对并主动选择；不能把关闭默认选择算成自动安全能力通过，必须有非零真实确认正例，并完整报告漏项/误项/Forbidden/未知与人工核对负担。
>
> 同时明确授权VALIDATION_AND_BUDGET中的A8+B8首次、可选C8新候选评估，模型deepseek-v4-flash-vision-exp，temperature=0、reasoning.effort=none，最多24次请求、人民币10元硬上限，verifier/Repair/传输retry=0。仅批准已见匿名输入；真实材料、未见数据集、真人、图片外发不在授权内。先证明计费上界并冻结请求/参数/输入/评分依赖；不能可靠约束费用则在首个调用前阻断付费，继续范围内零调用工程但不宣称整包完成。
>
> 默认无模型网络；live须独立有效授权账本。安全复用已配置服务端Secret，不读剪贴板、不在客户端/日志/Git保留凭据。仅本机回环、必要公开资料/依赖审计与Git网络；固定模型目的地出站仅在本次计费授权内。
>
> 同包连续实现、修补、审查、工程、真实Edge与Git交付，普通缺陷不另拆阶段。越界、保护/重叠修改、重大安全或预算问题才停。历史证据不改；工程成功不等于模型准确率或商业通过。成功精确清单提交推送并核对远端；失败只交付获准审计并保留现场，不强推或自动变基。完成后停止，不接稳定入口、不部署、不启动RCO-6。

## 8. 本次方案交付结论

独立范围复核与保护结果见SCOPE_REVIEW.md/CHECKS.json；尚无本包产品实现、付费结果、真人数据或部署。模型识别准确率：本轮未测量。
