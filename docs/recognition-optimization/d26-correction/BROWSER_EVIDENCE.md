# D26 普通产品路径浏览器验收

2026-10-02；角色均为 ENGINEERING_REPLAY，匿名工程假传输，不是新模型预测或真人试用。唯一推荐入口：<http://127.0.0.1:6777/>。实际构建见 [BROWSER_BUILD_FINAL](BROWSER_BUILD_FINAL.json)：`7b90b1e80691 / source cb7aa9de793a`，数据库 `rco-mainline-01-02-i1-d26-ordinary-delivery-final05`。构建时 HEAD 尚未提交；其源内容对应代码提交 `de670d59803c2c5dbfdd488559175e444662a6d2`，不能把页面旧 HEAD 前缀当成未修代码。

普通 App 的粘贴、识别捕获、摘要编辑、正式 DomainCommitPlanV2、Repository 和自动独立读回均实际运行。工程工具仅替换上游为固定匿名响应，诊断默认折叠；真实 provider 路由机械关闭。浏览器通过官方 Computer Use 操作，没有后台写 IndexedDB 或用脚本伪造页面点击。

## A—H 与实际保存值

| 项 | 场景、实际操作与结果 | canonical / 失败证据 | 状态与构建覆盖 |
|---|---|---|---|
| A | 普通快速粘贴精确截止与两项材料，键盘 Enter 一次接受，自动完成读回；材料不要求逐项填写个人准备情况 | [最终页面](browser/A-final05-review-page.txt)、[独立读回](browser/A-final05-canonical.json)：该来源新增 Task2/Material2/TimePoint2/Project0；PDF/A4、命名、数量、渠道、任务对应截止正确；材料 unverified、耗时 null；commitId 与实体值 hash 已验证 | PASS_FINAL05；刷新任务仍在，见 [刷新页面](browser/A-final05-refresh-page.txt) |
| B | 没有截止任务可直接存；主动补计划日期独立存；仅日期、未公布/模糊时间不强制造时刻 | [用户计划](browser/B-final-user-plan-canonical.json)：实际操作写入的是 **2027-10-12** planned_start，原文没有截止；[仅日期](browser/B-final-date-only-canonical.json) 2026-10-12/date_only；[未知](browser/B-final-unknown-canonical.json) null/近期/vague；[最终混合](browser/FINAL05-canonical.json) 无截止任务与模糊事件 | PASS_REUSED；日期编辑/事务代码之后未变，最终05复验无截止/null；原生日期控件实际年份如实记录 |
| C | 无任务停机事件存 Event1/TimePoint1、不创建空项目；纯信息直接归档 | [事件](browser/C-final-event-canonical.json) 周三晚/null/vague/needsConfirmation；[最终05资讯](browser/C-final05-information-canonical.json) 该来源 Task0/Project0/Event0/TimePoint0 | PASS；事件专项复用未变代码，最终05混合再验模糊事件 |
| D | 两个前置待办保持 todo 与 dependency，未把“填完后”当已完成；unknown资格/false不生成当前执行事实；错修订只阻断关联项，正确报名项可保存 | [最终05资格页](browser/D-final05-conditions-page.txt)、[最终读回](browser/D-final05-canonical.json)；[修订页](browser/D-final-revision-page.txt)、[实际已提交读回](browser/D-final-confirmed-canonical.json)。未验证个人完成事实不写 true。关联 sidecar 与普通 schema 缺项单列 | PASS；最终05复验资格/依赖与 footer；修订共享 guard 复用最终03。没有声称全语义已经原生映射 |
| E | 一任务与两个独立事件同页，一次正式确认；不同事件开始/结束明确关联，周三晚保持未知；逐项拒绝多余打印任务后只保存正确提交 | [最终05页面](browser/E-final05-mixed-page.txt)、[最终05读回](browser/FINAL05-canonical.json)：该来源 Task1/Project0/Event2/TimePoint3；资料讲解会 2026-10-12 14:00→15:00，资料室；停机 null。另见 [拒绝页](browser/E-final-rejected-page.txt)、[拒绝读回](browser/E-final-rejection-canonical.json) | PASS；混合最终05，拒绝复用未变 guard/正式事务 |
| F | 双标签分别改不同任务可共存；同字段保留编辑前/最新/我的值并拒绝覆盖；真实 SourceVersion 变化使旧确认受阻 | [无关字段](browser/F-unrelated-fields-canonical.json)、[同字段冲突](browser/F-same-field-conflict.png)、[同字段读回](browser/F-same-field-canonical.json)、[版本冲突页面](browser/F-final-source-version-conflict.png)、[版本读回](browser/F-final-source-version-canonical.json)。旧 V1 原文不变，新 V2 成当前；无半份正式事实 | PASS_REUSED；仓储与 source guard 自复验后未变；最终05测量又核版本异常逐份 MISSING |
| G | 检查点失败保留输入；正式事务失败无新增半份事实；正式成功后读回失败保留 commitId，提示待验证，只重新读回，未重复提交 | [检查点失败](browser/G-final-checkpoint-failure.png)、[正式失败](browser/G-final-formal-failure-canonical.json)、[读回待验证](browser/G-final-pending-canonical.json)、[手动恢复](browser/G-final-recovered-canonical.json)、[恢复页面](browser/G-final-readback-recovery.png)。pending/recovered 为同一次 commitId | PASS_REUSED；最终共享提交/回执/恢复代码未改；故障不是模型请求 |
| H | 事件暂存后关闭/刷新恢复，无需改字即可保存；完整 repository JSON 真实文件选择导入另一全新库，坏备份明确拒绝且实体不变 | [恢复页](browser/H-final-event-restored-page.txt)、[混合读回](browser/E-H-final-mixed-canonical.json)、[导出原件](browser/H-ordinary-export.json)、[新库读回](browser/H-new-database-canonical.json)、[坏备份后](browser/H-after-invalid-canonical.json)、[最终拒绝提示](browser/H-final-rejected-page.txt) | PASS_REUSED；保存/导入/recovery 未变。**原生浏览器下载落盘事件 NOT_OBSERVABLE**：工具等待超时，不把它冒充通过；合法备份生成与真实导入已单独证明 |

final05 内真实数据库身份为新库。来源版本故障使用匿名备份导入，备份的 logical workspaceId 仍为 final04；这是受控恢复夹具保留的逻辑身份，不能据此声称碰了旧库。实际 origin 与 IndexedDB 配置均为 final05，旧 6743/6751 库没有访问或改写。final05 最终累计 Task5、Project0、Event2、TimePoint5、Material2；每份来源按独立 sourceId/commit 判定，不能把累计数量当作某一来源的新事实数。

## 最终构建与复用依据

验收中每个服务构建使用新端口/新库，见 [证据索引](EVIDENCE_INDEX.json) 中逐文件 SHA 和构建 manifest。final05 在 final04 后只改诊断读回对过期来源的逐份异常处理、lint 临时产物忽略；不改普通编辑、CAS、确认或正式事务。A、纯资讯、混合事件、资格依赖、刷新与测量在 final05 再验；其余未受影响路径复用实际浏览器原件并明确标 REUSED，没有把旧过程截图写成最终全量重跑。

桌面 [1024px](browser/desktop-1024-verified.png)、手机 [390px](browser/mobile-390-final.png) 已核实际 viewport/弹层边界；源 UI 自该构建后未改。键盘主流程实际 Enter 接受后自动保存/读回。原先两个误绑旧 tab 的 desktop-1024 图留作 PROCESS，不用于响应式 PASS。

页面必要步骤：粘贴匿名通知 → 智能拆分 → 核对摘要 → 一次接受；正确来源没有强制逐材料准备状态、逐片段证明、检查点按钮或额外读回按钮。复杂例外才编辑/局部拒绝。没有同口径旧路径实测，**不计算减少点击或省时百分比**。

## 四项测量的真实工程链

- [阅读记录](browser/MEASUREMENT-final05-reading.json)：至少 10 秒仅阅读，实际墙钟 50.579s、阅读 50.556s、等待 0.023s、主动编辑 **0**，语义纠正字段 0；正式 commit/readback 可查。
- [实际改字段](browser/MEASUREMENT-release01.json)：标题/日期两组语义纠正、2 editId，检查点→草稿→commit/readback 闭合；主动编辑 5.426s、墙钟 35.470s，阅读/等待/空闲分列。旧 measurement3.2 与 low-edit-v2 保留。
- [最终逐来源报告](browser/MEASUREMENT-final05-per-source.json)：过期来源是 MISSING，正常来源仍 OBSERVED，没有整批抛错或删去未决。保存失败成本保留、重试不重复计纠正；缺 commit/readback/未闭合区间不补0。
- 自动化角色始终 ENGINEERING_REPLAY；首次/最终语义未真人裁决为 NOT_ADJUDICATED，四项真人指标全部 NOT_OBSERVABLE。不把 0 编辑或读回成功直接当作正确处置。

原回答、生成摘要、适配日志、用户修改及 canonical 分开，原件不覆盖。浏览器日志中的 6776 旧测量异常留为已修过程错误；最终6777没有新控制台错误。旧模态遮罩下未真正触发的读回、错误 desktop viewport、假 duration 纠正报告明确 PROCESS_NOT_ACCEPTANCE，不用于结果证明。
