# RCO Current Context

## 当前目标
- 同一MAINLINE-REAL-INPUT-01：本机读取校对与新候选确认交付。
- 不重做PLAN；0新增模型，累计24次已用完。
- 本机修复和受影响工程已通过，真实Edge两条旅程尚未闭合。
- 本轮仅审计交付，业务实现保持未提交；禁止重复应用。
- 当前报告：mainline-real-input-01/runs/candidate02-20260908a/READ_CLOSE_AUDIT.md。
- 先恢复原测试窗口；不新增候选、数据、模型请求或阶段。

## Git与范围
- 仓库C:\Users\Winner\student-affairs-multimodal-exp。
- 分支codex/e2-multimodal-recognition-exp；禁止在比赛工作区实施。
- 本轮起点f3b1ed68604e3f95c25894ee4717b1eed2072ec9，起始远端一致。
- 最新审计提交以实际Git核验；不回切、不重装、不套补丁。
- 授权44路径；本轮改变5个：InputReview/runtime/acceptance和两个checker。
- 其余39逐字匹配上轮现场；candidate02及请求内容冻结不动。
- 当前实现快照READ_CLOSE_IMPLEMENTATION_SNAPSHOT.json；开始先核SHA。
- 945保护聚合df68e4eda47f664f9f0fbf218a74687117ac3cc9d2c14f5ee6e9965cd2c28394。
- 334旧包证据+48前轮candidate02证据=382份逐字保护。
- READ_CLOSE_BASELINE绑定44原SHA、51条完整账本和日志旧前缀。
- 全局Schema/repository/capture/validator/confirmationV2/domainCommit只读。
- 不改Expected/评分/raw/first/旧候选/历史，不接真实库或稳定入口，不部署。
- 工作树逐字SHA与Git换行归一化分别核对。

## 本轮实现
- recordedCandidate02模式开放真实InputReview的localOnly能力。
- 可本机读取、查看逐页文本/OCR、缓冲校对、明确保存并恢复。
- 新读取采用local-review操作身份，原库新增独立Source，不改旧输入。
- 恢复菜单只显示该入口新读取；旧A/B/C输入不进入校对菜单。
- UI显示模型关闭；runtime发送处理器直接拒绝，不能顺带调用模型。
- 原默认入口、旧recordedBatch/recordedA02能力限制不变。
- 未保存缓冲不称持久化；原始提取和用户校对分开。
- 旧原子仓储机制复用，不新增DB或全局契约。
- 新read-close检查采用当前HEAD；旧历史HEAD断言不改。

## 本轮检查
- acceptance/extraction/inputReceipt共43/43通过，不与不同attempt相加。
- C03公开接口负例：COVERAGE_TIME保留，拒绝确认，不造假日期。
- C05/C08公开接口正常对照：有效任务确认、独立内存仓储读回、旧任务保持。
- localOnly正常/反例：保存恢复成功，模型执行器0次，直接发送拒绝。
- 当前checker正反1组通过；一次遗漏manifest参数的失败日志保留，补参数后通过。
- 类型、受影响lint、稳定构建通过；大包警告保留。
- 原1250通过/1旧skip按未变部分SHA复用，不称本轮重跑。
- 所有框架调用configFile/envFile=false，新临时env/cache/build输出。
- 不读取根.env；服务器当前无上游派发能力。
- 本轮无新增密钥/真实库/绕过确认/原子保存风险，不另做多轮独审。

## 既有模型与读取证据（不是本轮新成绩）
- C01–C08共8次成功，历史累计24；账本51条全文不动。
- task精确8/9/9，P/R88.89%；严格Complete1/8。
- A03–A08对C03–C08任务Recall66.67%→83.33%，仅6份已见配对。
- C06条件false和保留任务、C08旧新修订改善；仍有材料/时间等错漏。
- C03有time覆盖却无实体，仍待核对；本轮没有扩建时间语义。
- 自动选择NOT_ENABLED；旧A01失败和3.30元未知预留永久保留。
- 结算上界0.427704元，含未知占用3.727704元；实际扣款不可观测。
- 本轮模型准确率未测量，真人编辑时间和省时NOT_RUN。
- 前轮实际Node OCR三图、四PDF五页，不是Edge校对闭环。
- B08同页新要求和B07扫描页不能只取文本层；原引擎输出保留。

## 实际Edge与唯一下一动作
- 原URL http://127.0.0.1:6631/?run=real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862。
- 原库rco-mainline-01-02-i1-real-input-d030c507-3f7c-4a2c-a511-8cd5bd534862。
- 服务recorded_batch+recorded_candidate02，upstreamEnabled=false；不得清/建/fallback库。
- 官方tab763114892选择成功，AX见6任务；刷新成功后点击Runtime.evaluate超时。
- 截图返回Cannot take screenshot with 0 width；不认定为产品故障。
- 已请求用户原标签置前/展开窗口/关闭DevTools（如开）并手动刷新一次。
- 不反复自动切换刷新，不改系统或防护；等可观察恢复后继续。
- 混合PDF实际逐键校对/保存/刷新恢复NOT_RUN。
- C08已在原库有新Run/Draft；本轮未确认，不重复载入。
- C08原库确认/刷新/任务中心/日历无日期/详情/独立读库NOT_RUN。
- 前轮独立读库6任务/jobs0；不能把本机测试当原库已新增任务。
- 旧6任务、原答/首次/修订与材料须逐对象保留。
- 未影响的A02/时区/下载不重跑；没有新文件证据则不报新下载PASS。
- 补两条真实旅程后按最终SHA复用工程，精确业务提交推送核对远端。
- 当前审计交付后停止；不自动调模型或继续其他优化。
