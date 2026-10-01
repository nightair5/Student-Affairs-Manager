# D24 实际浏览器验收

2026-10-01，官方Computer Use控制Codex In-app Browser；全部为ENGINEERING_REPLAY。不是单元测试、真人点击或线上模型效果。

主入口6742/d24release01，补充验收6743/d24manual01。最终source SHA均69e9222b263b02f95800832ae9b6d224a0ed41c081a9ba05b32cef22642d8731，代码0b8a6e4。更早bf8/e09构建对应回执保留原身份；最终代码的相关回归见下。旧6730/旧库保留。

| 验收 | 实际操作/结果 | 可审查证据 |
|---|---|---|
| S01步骤 | 录制打开后核对材料→两次主动选择→联合核对→正式加入；旧路径另须本项核对，4点击改3点击，2选择不变 | s01-before-readback.json、final-s01-readback.json；旧路径没有真人时间比较 |
| S09覆盖/归档 | 原答事件/时间为空。人工补平台停机事件、周三晚；剩余出处标签明确分类；信息归档；该来源0Task/0Project/1Event/1TimePoint；null/vague/依据保留；刷新无重复 | final-s09-readback.json、final-s09-refresh.json；最终代码重新独立读回final-main-p1-readback.json |
| 四类时间 | 手动精确截止2026-10-19T16:30；S02仅日期2026-10-20/22全日；S09周三晚模糊null；S07稍后公布/月末前后null | final-manual-readback.json、final-s02-refresh.json、final-s09-refresh.json、final-s07-latest-readback.json |
| 最终S07提示 | 日期未公布不必编造时刻；逐片段核对→明确接受未知→材料联合核对→正式确认；仍needsConfirmation=true | final-s07-unknown-label.txt、final-time-review.png、final-s07-latest-readback.json（最终source/提交构建） |
| 保存失败 | S07注入正式失败，正式Task=0；输入和真实错误保留；手动重试正式Task=1 | final-s07-save-failure.txt、final-s07-failed-readback.json、final-s07-readback.json |
| 提交后读回失败 | S02正式Task=2/TimePoint=2已存在，显示“已提交，读回尚未验证”；只点重新读回，pending清除、无重复；刷新一致 | final-s02-readback-failure.txt、final-readback-pending.png、final-s02-pending-readback.json、final-s02-readback.json、final-s02-refresh.json |
| 空白手动实际闭环 | 补任务/完成标准→按原文补精确截止→补材料→PDF/命名人工修订→联合核对→正式保存；读回Task/Material/TimePoint各1；刷新一致；首次空白保留 | final-manual-readback.json、final-manual-refresh.json；source69e9222b与最终提交代码一致 |
| 材料失败恢复 | 人工新增材料再次修改曾报undefined.name；暂停、保留检查点、最终代码刷新重开、明确接管，无需重输PDF/命名→保存→确认 | manual-new-material-failure.txt、final-manual-readback.json；失败发生于较早构建，修后实际浏览器成功 |
| 计时 | 只阅读超过10秒再退出，实际闭合阅读32,055ms，activeEdit=0；没有打开建议，manual首次NOT_APPLICABLE | final-pure-reading-closed.json；自动操作不能当真人省时 |
| 主工程超时 | 等待代码修复导致p2-1超窗；草稿保留、Task=0、不继续正式写入；不改旧终态 | manual-window-timeout.txt、final-manual-timeout-readback.json、final-main-summary.json |
| 身份隔离 | p1已有Task/Event时p4全图空；后p4独立S02入库，p1原Task/Event不变。各数据库独立读回；最终4身份汇总 | final-isolation-p4-empty.json、final-main-p1-readback.json、final-main-summary.json |
| 页面纠正关联 | S09事件新增和出处核对各有真实editId/检查点/commit/readback；unlinkedEditIds为空，补事件为结构修改 | final-s09-readback.json及final-main-summary.json对应rows.evidence.links |
| 未闭合记录 | 较早刷新区间保留missing和null，缺正式提交/readback不算低修改成功；终态失败/退出仍列入排程 | s09-refresh-readback.json、final-reading-only.json、final-main-summary.json；观察到的成本不补成完整时间 |
| 真实范围门 | 没有真人授权/负责人/同意，资格检查被阻断；工程模拟始终ENGINEERING_REPLAY | final-human-gate.txt；handler隔离验证与编译门通过 |

S01、S02、S09及注入失败早期证据在bf8/e09构建形成。最终额外修改只涉及时间摘要、人工新增实体的后续修订来源、手动时间补录；S02已有日期、S09创建且不再修订、正式事务/只读读回路径没有改语义，实际最终独立读回保留。受影响的手动再次编辑与S07摘要在source69e9222b重新验收，不能把早期截图称为最后构建截图。

过程工具错误：使用错误检查点key曾触发D20_FIELD_KEY_INVALID，已改为正式relation:source:information；某次定位理由字段名错误、异步载入前读取禁用按钮、弹层未关闭前读回pre为undefined均修正操作后完成。不是新的模型/网络错误，也不伪造成功截图。原故障与已超时工程记录保留。

浏览器目录含匿名回放的原答和编辑历史，不含真实人信息、Secret或账本授权。唯一对用户推荐URL为6742；6743仅为补充工程验收证据，不能改为human实例。
