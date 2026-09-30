# D22 浏览器 A—L 与证据边界

2026-09-30。全部操作由官方 Computer Use 的浏览器 DOM 控制完成，故障是匿名库的离线注入。独立读回通过产品工具调用 Repository 后呈现的 JSON 读取；未在浏览器注入脚本修改数据库，未使用盲目按键、坐标脚本或业务模型。

推荐库 p29、回归库 p30 及过程库 p22—p28 均为本轮新建工程库；旧 6709 入口和旧用户库未操作。真实负责人、参与者、同意及真人试次均为 0。每个证据的确切构建、数据库、来源 SHA、刺激 SHA、试次和原文件 SHA 在 EVIDENCE_INDEX 中；累计数量与本来源增量不能混用。

## 实际缺项收口表

| 项 | 场景、操作与正式读回 | 证据/结局 |
|---|---|---|
| A | D17 S01 录制：打开原文和材料，核对准备情况，改任务名称；正式确认及读回。PDF、文件名“社团编号-经办人”、截止 2026-10-19T16:30 和证据保留 | A-H-L-final-p29；本来源 Task1/Material1/Time1，原有任务关联 Event1。PASS |
| B | 任务+两事件同页编辑，事件名称/地点关闭刷新恢复，接管后不改字保存；改未公布结束时间，核对任务，一次正式确认 | B-C-I-final-p30；Task1/Project0/Event2/Time4，事件地点“图书馆一楼”。PASS |
| C | B 的精确起止 19:00/20:00；模糊开始“周三晚”和未公布结束原文独立读回 | P3/P4 值 null、vague、needsConfirmation=true，原文及证据保留；没有编造日历时刻。PASS |
| D | 辅助无任务维护通知确认事件，另用手动纯信息确认无任务 | D-L-read-only-final-p29 / D-manual-final-p29；前者增量 Task0/Project0/Event1/Time1，后者不增 Task/Project。PASS |
| E | 两项依赖任务；先改前置再保存后项导致真实关联冲突，保留后项输入，明确重载/接管并核对后保存 | E-J-related-recovered-final；两 Task，后项 dependencyIds 指向前项，均未伪称完成。PASS |
| F | 坏修订旧端点不存在，只核对无关联事项，部分确认后退出 | F-final-p29；只增无关联 Task1，坏关系仍受阻；partial/exited 保留。PASS |
| G | 拒绝多余“联系项目办”，核对正确“复核项目成员资料”，正式读回 | G-final-p29；增 Task1，拒绝 T2 为结构纠正；读回/刷新一致。PASS |
| H1 | 检查点失败后输入在、提示仅在本页、手动重试再保存；关闭刷新后恢复 | H-checkpoint-final-committed.png + A-H-L-final-p29 中真实 editId；失败前不宣称持久化。PASS |
| H2 | 正式事务失败；独立读回本来源 Task/Event/Time 都未新增；手动重试 | H-atomic-final-p29 与 A-H-L-final-p29 对照；没有半份正式事实。PASS |
| H3 | 正式提交成功而读回故障；显示已提交/待核实，刷新恢复，手动重新读回 | H-readback-final-committed.png；原正式 commit 只有一个，恢复只有对应 readback，没有第二次正式提交。PASS |
| I | 材料准备观察、动作/对象、条件、依赖/修订输入，以及事件名称/地点/起止时间关闭或刷新恢复 | 过程/最终证据按字段分列见下表；未知保留未知，恢复事件不改字直接保存，拒绝和选择不伪算模型纠错。PASS（明确复用范围） |
| J | 不同任务字段两标签分别正式保存；同字段三方值；关联任务变化；真实 SourceVersion 更新；旧 clear/旧裁决保护 | J-unrelated-both-confirm-final / E-J-related-recovered-final / J-source-version-final-p30 / J-stale-clear-final-p30 / J-stale-choice-final-p30 及最终修复回归。PASS |
| K | 新 p29 空库与 p28 图分别读回，p29 写入后 p28 Source/Version/Draft/History/事实全图不变；p30 为另一独立身份 | p28 图两次规范 JSON SHA 均 `58f7f547367fadf115322604f59d269d167561d04ab18f5e985cba3b638a3bb9`，p29 起初全0，后来9来源/9Task/4Event/6Time。PASS |
| L | 页面真实编辑→检查点→草稿操作→commit→独立读回；阅读、保存失败、刷新缺失、拒绝/退出分层 | B-C-I-final-p30 有真实检查点版本和对应 readback；阅读约25.8秒编辑0；刷新时间 null；manual 建议收益 NOT_APPLICABLE；真人全 NOT_OBSERVABLE。PASS |

## I 的逐字段证据和复用理由

| 字段 | 操作与实际结果 | 文件 |
|---|---|---|
| 材料 | 材料必需性/准备状态检查点保留，手动重试；真实 review_material 操作读回，PDF/命名及任务关联保持。观察不伪算模型纠正 | A-H-L-final-p29，材料观察故障回归测试 |
| 动作 | 修改“复核”为“请复核”，等待检查点已保存后刷新/接管，保存纠正并正式确认；保留完成标准和对象 | B-C-I-L-final-p29 |
| 对象 | 原文选段人工纠正对象，恢复并保存；独立 Task/材料/时间/依据读回，原回答不改 | A-I-L-p26-precise-material-object |
| 条件 | D17 S06 前置未知，恢复关系表单，人工纠正 true→unknown；原条件依据保留，关联实际 editId/commit/readback。unknown 项留待核对，不拿它伪造正式成功 | I-condition-linked-final-p29 / I-condition-final-p29 |
| 依赖 | 前置依赖表单与读集检查；恢复后两任务正式保存。已有正确依赖核对不会计新纠正 | E-I-p28 / E-J-related-recovered-final |
| 修订端点 | 两组合法旧新端点的关系编辑恢复；未改变事实的核对不计修订重接。坏端点拒绝正式保存，无关项继续 | J-unrelated-both-confirm-final / F-final-p29 |
| 事件名称/地点 | p30 改名、改地点、关闭刷新重开，接管直接保存；正式读回新名和地点 | B-C-I-final-p30 |
| 开始/结束时间 | 精确起止保留；模糊结束改 rawText、值仍 null；关闭刷新恢复未知时刻，不填写假 ISO | B-C-I-final-p30 / B-C-I-L-final-p29 |
| 拒绝/选择 | 多余项拒绝与剩余选择正式保存；按字段版本持久化，刷新恢复；选择是确认状态，拒绝是结构修改 | G-final-p29 / J-unrelated-both-confirm-final；过期选择定向事务反例 |

文件名含 final 不等于它自动属于最终构建；索引保存实际 source 指纹。对象/依赖等早期证据只复用单作者已保存输入恢复的对应断言，不复用早期计时或失败结论。随后变化涉及材料观察计量、弃编辑清理、父级冲突状态与无任务事件状态；相关失败/计量/冲突路径分别在 p29/p30 重验。最后父级同步与无任务文案修复不改 Schema、Repository、正式事务、CAS、语义字段转换或测量；最终回归直接验证它们受影响的事件冲突路径。没有将旧 D21 过程证据当作本轮最终验收，也没有把旧 carrier 环境错误当产品失败。

最终代码提交 `6fc2ff8c6e4f` / source `e44972c00346b6471f35d01e2ca891327bb00c8b07ed3a939905178351f2896f`。最后一次无任务事件实际改名→保存草稿（明确尚未正式确认）→正式确认→独立读回，页面改为“独立事件已正式确认并保存”；D-J-final-status-p30 是最终构建记录。本来源增量 Task0/Project0/Event1/Time1，模糊时间仍 null；另外读回上一精确事件的新地点与三方裁决值。主动编辑5000ms、阅读32192ms、等待65ms、空闲3709ms、墙钟40966ms，各项相加一致，但都为 ENGINEERING_REPLAY，不是人的省时结果。该试次无 missing，刷新恢复试次继续有 missing。

父级同步修复回归直接形成地点三方冲突，重新读取冲突版本、选择最新并保存草稿后，父级旧冲突提示消失，无需额外关闭重开就能正式确认无任务事件。旧选择尝试仍被版本保护拒绝；没有关闭 CAS。

## 失败与工具记录

真实的预期阻断包括 MAINLINE05_STALE_RELOAD_REQUIRED、D20_FIELD_STALE、过期冲突裁决 D20_FIELD_CONFLICT_MISSING；输入仍在，未宣称成功，库未多出错误事实。显示冲突时仍需明确接管/选择；真实来源版本变化必须重载核对，不可最后写入覆盖。

浏览器曾因当前位于收件箱而找不到首页录入按钮，也曾因 modal 内有多个 pre 或工具报告尚未更新读错目标。沿当前 DOM 选正确按钮/专用报告区域，关闭 modal 后生成并核 trialId，已恢复；这些是控制/取证问题，不是模型请求。两份过早的过程 E/G 报告指向上个试次，明确不采用。没有持续工具故障，没有改用盲目输入，也没有用单测替代上述浏览器路径。

完整匿名 JSON 与原截图保存在本机 `.data/d22/browser`；提交的紧凑索引含 SHA 和原始来源定位，关键截图在本目录 evidence。原文件不包含 Secret 或真实参与者。
