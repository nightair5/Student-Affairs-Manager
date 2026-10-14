# 4份官方节选的真实首答诊断：恢复已有事实，没有证明生成机制提升

2026-10-09，工作包开始18:05（Asia/Shanghai）；3小时、16请求、US$6共享预授权。本轮实际仅4次，单臂当前FactRoleAuthority。先按原文固定来源、最小事实参照和请求，随后取得4份真实响应；没有新增输入候选、二次比较或用预算扩样。两个确定公共程序根因已修并普通推送。

本轮用户少卡两处：论文/贷款的长操作原文不会再触发动作字段长度限制，让整份草稿生成失败；门户维护不必重填已在原答里的事件名称和03:00结束时间。资格未知、复杂窗口、渠道引用和未决关系仍按原事实保留，没有假装全部正确。

| 每层固定分母4，暂定最小事实完整性 | 正确 | 错误/整份首次数据未闭合 | 未知 |
|---|---:|---:|---:|
| 实际模型原答事实 | 1 | 1 | 2 |
| 输出前冻结公共程序首次数据 | 0 | 4 | 0 |
| 修公共程序后同4份raw首次数据 | 1 | 3 | 0 |

这里统计普通App将消费的首次RecognitionResult和Capture路径，**尚未观察浏览器首次画面**。原答的“未知”是事实/表示裁决未决，不是个人资格unknown或未公布null自动扣分。编译拒绝与事实错分开，首次程序完整恢复0/4→1/4不能称新模型准确率提高。参照single-author/model-assisted/provisional；旧原v11/12后验/各旧批成绩不改。自由描述和标题除RN-04逐源暂定核对外仍NOT_ADJUDICATED，泄漏未独立裁决；不声称独立真值、Holdout、泛化或总体25%准确率。

[逐事实裁决](FACT_ADJUDICATION.json) · [原答](MODEL_OBSERVATIONS.json) · [冻结/新程序逐份](PRODUCT_DIAGNOSTIC.json) · [正式值/读回](PERSISTENCE_REPLAY.json) · [机制](IMPLEMENTATION.md) · [全部证据哈希](EVIDENCE_INDEX.json)。

| 来源和严格节选范围 | 原答与发生层 | 本轮结果及还需核对 |
|---|---|---|
| [RN-01学位材料首段](https://cee.xmu.edu.cn/info/1038/41505.htm)，不评价后续清单/涉密例外 | 6月10日提交截止被标registration_deadline，与冻结提交类型不符；分段窗口在描述/引用里存在，端点表示仍未决；26字纸质提交action进20字普通动词字段导致Capture拒绝 | 新程序保留Word/PDF/签字/完整版本及纸质提交，动作可进草稿；渠道和窗口仍局部阻断，原时间角色未修，整份不正确 |
| [RN-02贷款确认方式第1项](https://xsc.xmu.edu.cn/info/1017/111282.htm)，不含另行新生入口/盖章/缴费 | 8月13日起、材料和机构条件有；五步骤及“上传后才能提交校验码”的强依赖与普通步骤顺序有争议，原答UNKNOWN；URL被冒号拆scope、两动作超限又造成程序失败 | 登录/选择不再使草稿失败，URL仍是原文真实值；unknown个人资格不改true/false；确定业务渠道尚未完整投影，部分事项不可保存，首次未闭合 |
| [RN-03积分兑换操作段](https://library.xmu.edu.cn/info/5191/15738255.htm)，不读海报/二维码 | 两义务、校园卡、资格和前置unknown有；每日/周三例外存在scope上下文，正式窗口表达是否完整仍未决；participation资格scope未重复列proposition，现契约编译拒绝 | 原答UNKNOWN，程序整份拒绝保留；不为第三根因扩大本包，不用另一臂回答、程序或人工补录制造首次正确 |
| [RN-04门户维护主段](https://inc.xmu.edu.cn/info/1091/9372.htm)，不含后续可选访问入口 | 原答已有事件、00:00/03:00和无法访问说明；同对象+操作名称不是连续字串、结束日期是范围省略，程序误删名称/结束 | 不改raw，仅封闭名称等价和同owner范围端点支持；Task0/Project0/Event1/Time2，exact00:00/03:00，工程正式确认及独立加载一致 |

来源是2026年4—8月历史公开节选，回放保留各自referenceTime/timezone，不当10月当前活动。来源/参照在输出前选定；与19个已有冻结身份文件的来源hash对照在发送过程中完成，不能称输出前完成的全面泄漏检查。未匹配旧来源hash，不是重发旧不确定单元；来源均为Development。

最多两根因：①wire完整动作句到普通有长度限制动词字段的确定性投影；②同事件名称/钟点省略的合法表示误阻断。公共first1.6.0/compound-name1.1.0，其余支持/关系/材料渠道/资格/禁止/窗口/时间/D27保持。无新Prompt/Schema生成变化，因此不需要再付费验证生成收益。

正式链继续是Schema→公共转换→普通App数据→ReviewSession→DomainCommitPlan→Repository。RN-04真实raw进入Capture、非编辑选择检查点、事件正式事务、读回和独立Repository实例；注入事务失败无半份，手动恢复成功；提交后读回失败只重新读取，commit不重复。原答/转换审计/首次数据/人改分开，事实编辑0，不制造editId。RN-01/RN-02没有可安全正式接受的任务，因此未伪造个人计划；RN-04只有事件，没有待办。部分/坏关系/检查点失败/安排使用受影响及现有产品回归，旧点击过程不算本次页面证据。

唯一当前内部入口：[6917固定4录制](http://127.0.0.1:6917/)，全新隔离库`rco-mainline-01-02-i1-d27-plan-recorded-rn20261009-1805`；构建`ac45bb4693b7 / source fdbf658f9d68`。HTTP首页200、模型POST403，实时机械关闭。**点击、刷新、IndexedDB NOT_RUN_POLICY_STOP**：Computer Use原错误为“could not determine the current browser URL on Windows with enough confidence to enforce policy”；没有换CDP/Playwright/SendKeys等绕过。实际DB打开未观察。四项真人指标NOT_OBSERVABLE。

4SETTLED/0UNCERTAIN、1grant4reserve4settle；零retry/repair/verifier。真实usage25879输入（cached20480）/15785输出；内部按峰时cache-miss保守结算US$0.026707，供应商实扣NOT_OBSERVABLE。输出前官方1M输入上界及8192输出界，4身份最坏US$1.297616，分配硬限1.30；没有依赖短输出/缓存/淡季优惠。真实预授权引用本次粘贴原文，授权/核价仅本机.data，不伪造逐批回复。全部旧封存、已耗尽grant及锁保持，没有恢复/解锁/补settle/替代身份。

最终77受影响检查通过；lint0错误8旧警告，build/security通过。权威全量42独立组36PASS、6旧历史FAIL、0缺组，整体exit1，**没有全绿或完整验收通过的声明**。六组d19-diagnostic、d9-historical、rco-5-007、c11-history、c11-gateway、vitest-d17-history仍是旧账本快照/哈希，不改断言/锁/Expected。server本轮通过，无新bad-port失败。开发audit2critical6high1moderate、production0，依赖未改。末次否定守卫修正只重跑受影响6组及lint/build；未变层全量证据明确复用。

历史84保护/119冻结/7归档、235本机资产及新4raw原字节保持，旧8录制首次数据逐份deepEqual。完整账本1091行SHA`0870d6ccd38b54315a600d347657606aad3d19ae499e47c36077a9db0276e62f`；原1082前缀SHA`b3e3952c66cc1f3a1a1302f8ae7ef36394b5502e59ce044f5a5e5c7f903183af`不变，合法9行定位为本批grant4reserve4settle。[保护](PROTECTION.json) · [费用](EXECUTION_SUMMARY.json) · [验证](VALIDATION_SUMMARY.json) · [旧录制回归](OLD_RECORDING_REGRESSION.json)。实现提交`ac45bb4`已普通推送，最终交接HEAD见live核验。

下一仍围绕少修改：先用已有RN-03 raw定位参与依据与窗口的主/附属支持边界，以及RN-01/RN-02全局业务渠道的合法来源作用范围，选最多两个具体根因；可离线证明的公共问题先修，不默认换模型或造下一批。真实页面尚需恢复官方浏览器通道后验本构建，当前无需新的模型预算。可回退新工程提交，不能删原调用证据/账本或改旧结果；未开展真人/default替换/Holdout/合并/部署。
