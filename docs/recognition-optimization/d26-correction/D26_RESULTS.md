# D26：普通核对路径与首次质量测量已修订，付费比较未运行

2026-10-02。状态：**D26_LOCAL_PRODUCT_DELIVERED_COMPARISON_NOT_RUN**；Git 状态为 **LOCAL_COMMITS_ONLY / PUSH_BLOCKED_AUTODEPLOY_BINDING_UNVERIFIED**。全局自动排期依用户修订延后，本輪未把它作为完成条件。

三个相连的本地成果已实现：普通页面陈旧保存与隐私范围保护；承接 C18 的独立时间/显示/评分修订与16身份冻结；来源级低负担确认接到普通 App 正式事务与独立读回。实际代码与风险边界见 [IMPLEMENTATION](IMPLEMENTATION.md)，页面与 A—H 见 [BROWSER_EVIDENCE](BROWSER_EVIDENCE.md)，验证见 [VALIDATION](VALIDATION.md)。不能据此宣称首次模型正确率已提高或产品成熟上线。

## 用户现在如何处理通知

唯一内部入口 <http://127.0.0.1:6777/>，匿名工程假传输，模型关闭。展开底部诊断可复制预置匿名原文；在普通首页粘贴、智能拆分、看任务/材料/事件/时间摘要，正确时点一次接受。系统原子保存并自动独立读回，不要求再点检查点/读回。没有截止可直接保存，事件或资讯不创建假任务/空项目；材料个人准备情况保持未核实，耗时未知不默认一小时。

不准确时才编辑、拒绝或局部确认；输入关闭/刷新可恢复。不同标签无关字段可合并，同字段/关联/来源版本变化保留我的输入并明确冲突，不能最后写入覆盖。正式成功但读回失败显示“已提交，读回尚未验证”，手动恢复只重新读，不重复提交。正常路径步骤已实测，旧路径同口径步骤未测，不编造减少百分比。

## 首次准确率主线发生了什么

| 根因 | 本轮工程修正与反例 | 新模型效果 |
|---|---|---|
| S09 无任务漏事件/时间 | C18 独立事实账目继续；普通页独立事件可存，模糊时间 null；真正漏事件仍判错，不用程序补原答 | 未观察 |
| S06 资格/前置完成/可开始混淆 | 不凭“填写完后提交”写完成 true；真实后续任务与依赖保留；false 与 unknown 独立阻断 | 未观察 |
| S05 时间/实体关系不一致 | 单向权威关联和记录反向索引继续；错对象/修订方向和缺端点不猜补；无关项可存 | 未观察 |
| 评分与展示误判 | v10 接受有依据合法事件描述，拒绝矛盾/漏事件/错时间对象；源语义 Expected 不从 adapter 输出回灌；摘要按结构装配并保留原文案 | 工程正确性已验；不是原模型质量提升 |

C17/C18 原 Prompt、历史原答和旧结果保持；未建 Candidate19。两臂共有新 adapter/时间/显示/scorer，实验变量为 C17 prompt/wire 与 C18 prompt/显式边 envelope；只能归因于候选机制整包。普通默认候选未替换，**默认在线首次正确率本包尚未测得**。RecognitionResult 原生契约不能完整表达全部条件/生命周期/修订/事件关系；sidecar 无损保留且明确 gaps，不冒称全语义已经原生可编辑。

## 16 单元与费用

[冻结 Manifest](MANIFEST.json) SHA `c41185c3831d35db610e5a4a563b7471b0bd60d1d92a373edd6a5c10d28f7ac2`；[身份文件](PREPARED_REQUEST_IDENTITIES.json) SHA `89f33327eabd2ec90f9d383ac922d56b56ca4654cfee0be47aac083eea411e89`。8 已见 D25 Development 来源，C17/C18 每臂8，4AB/4BA。参照 single-author/model-assisted/provisional；8正例/8最小负例/8顺序例往返有确定结果。不是独立 Holdout。

实际发送 **0**，确定付费结局 **0**，不确定付费结局 **0**；16/16 NOT_RUN，dispatchAuthorized=false；grant/reserve/settle 均0。每臂已观察来源0/8、未知8/8，逐例全部 UNKNOWN；正确率是 **NOT_OBSERVABLE**，不是0%或100%。见 [CALL_STATUS](CALL_STATUS.json)、[COMPARISON_STATUS](COMPARISON_STATUS.json)。D17原v7 C03=1/12、C17=2/12及MIXED_PROGRESS保持，旧录制诊断不叫新版成绩。

按官方峰时价格和整上下文输入界计算，16次内部保守费用上界 **US$5.190464**，建议新批硬上限 **US$5.30**；不是请求字节/token粗估，不预测实耗。模型 usage NOT_RUN，内部预留/结算0，供应商实扣 NOT_OBSERVABLE。见 [具体授权卡及来源](BUDGET_AND_AUTHORIZATION.md)。价格、host、身份及账本在未来授权后必须重新核。安全执行器离线锁/漂移/重复/无许可/顺序/不确定停止/raw/usage/settle分支通过；真实宿主还须将既有D25 ledger/transport接线绑定这16身份并离线验证，不能照旧CLI直接运行或复用grant。

## 验证、保护与同步

- 普通浏览器 A—H 已实际验收/注明未变路径复用；最终6777再验精确材料、纯资讯、混合事件、资格依赖、刷新和逐份测量。正式数量、关键值、source/commit/readback均留证。原生下载落盘工具事件不可观察，备份生成、真实新库导入和坏备份拒绝单独通过，不把下载超时写PASS。
- 当前产品915pass/1旧skip；全量34组30PASS/4历史FAIL。lint/build/security通过；Linux隔离当前产品与最终相关回归通过，安全全组仍因旧D25 PowerShell原测试不可用而INCOMPLETE。GitHub云CI未运行。audit 5high/2moderate 工具链风险保留，不改锁凑绿。
- 84保护/119冻结/7历史归档原样。权威账本938行，前后SHA `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`，完整链与旧98行合法追加提示保留，本轮零写。旧D25活动源码用原Git提交复建，不回写旧Manifest。
- 实现本地提交 `de670d59803c2c5dbfdd488559175e444662a6d2`；证据/交接另一个 Conventional Commit，最终SHA由交付后的Git输出核对。upstream/remote仍 `7b90b1e806919ea9a8fb02e6c62a9657499ee94a`。没有强推/合并/部署。未确认Cloudflare Worker Builds自动发布绑定，依本轮明确规则不推送；不能用Pages列表或手动部署历史冒充无自动发布证明。

## 下一步的最小动作

1. 外部只需确认本仓库/分支的 Cloudflare 自动部署触发设置；确认无发布副作用后普通推送并核远端。它只阻挡同步/付费宿主，不阻挡本地产品开发。
2. 用户提供 [授权卡](BUDGET_AND_AUTHORIZATION.md) 中本批 deepseek-flash/16身份/US$5.30 的明确许可，付费前完成真实宿主绑定和全部安全核验；在同一工作包做完真实比较，不再另造启动阶段。
3. 紧接做本机有限窗口、一任务一段的最小安排；已就绪输入为明确截止、固定事件、依赖、个人状态和耗时来源。无可靠耗时就保留未安排原因/请求最少信息，不把兼容60分钟当事实；计划不覆盖原文截止。该工程不以16次全面胜出或真人招募为总门。

四项真人指标仍全部 NOT_OBSERVABLE，真人未启动。独立质量、默认替换与发布都没有授权；本轮不宣称普遍省时、识别提升、泛化或上线完成。
