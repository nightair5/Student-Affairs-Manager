# 6833最终构建普通页面证据

2026-10-04，官方Computer Use / Codex IAB tab11，DOM语义操作；全新库与构建见[证明](PROTECTION_AND_BUILD_PROOF.json)。所有记录ENGINEERING_REPLAY，不发送模型请求，不是参与者试次。数量是该来源增量；独立读回由页面按钮创建另一Repository读取真实IndexedDB，不读取隐藏浏览器状态。

| 场景 | 首屏/操作 | 正式增量 Task/Project/Event/Time/Material | 结果与文件 |
|---|---|---|---|
| 对象前置、陌生渠道星槎入口 | 首屏直接显示明确渠道；一次接受，无字段改动 | 1/0/2/5/1 | PASS；LEGAL_FIRST.txt/png，LEGAL_READBACK.json。 |
| 请勿通过资料门户 | 关联任务按钮disabled；只保存独立事件 | 0/0/2/4/0 | PASS；PROHIBITED_FIRST.txt/png、PROHIBITED_PARTIAL.txt、PROHIBITED_READBACK.json；partial保留。 |
| 把字句交到资料门户 | 首屏有渠道；一次接受 | 1/0/2/5/1 | PASS；HANDOVER_FIRST.txt、HANDOVER_READBACK.json。弹层外故障点击未建立，本来源不计失败验收。 |
| 提交后保留回执 | 首屏有目的地；在开弹层前注入正式失败并核已注入状态 | 失败0增量；手动重试1/0/2/5/1 | PASS；TRANSACTION_FAILURE.txt/png、TRANSACTION_FAILED_READBACK.json；关闭重开原选择保留，TRANSACTION_RECOVERED_READBACK.json。TRANSACTION_ATTEMPT_READBACK.json是早读旧结果，未用于断言。 |
| C19 S05原录制 | 平台仅回执，渠道未确认；PDF/命名/完成标准/截止/培训起止保留；一次接受 | 1/0/1/3/1 | PASS；C19_S05_FIRST.txt/png。注入读回失败后READBACK_PENDING.txt/png及CANONICAL；已提交pending保留。只重新读取后READBACK_RECOVERED_CANONICAL，数组不变。S05_SAVED_VIEW.txt/png正式详情保留原文与办结标准。 |
| C19 S01原录制 | 0任务1独立事件；周日晚间未知null；确认信息并保存事件 | 0/0/1/1/0 | PASS；C19_S01_FIRST.txt/png、C19_S01_READBACK.json。没有人工补录。 |
| 同对象同渠道正反冲突 | taskDisabled=true，只保存无关2事件 | 0/0/2/4/0 | PASS；CONTRADICTION_FIRST.txt、FINAL_BEFORE_REFRESH.json。 |
| 刷新与独立核值 | 刷新→新Repository读回 | 总4/0/12/27/4 | PASS；FINAL_AFTER_REFRESH.json、CHECK.json；正式5数组完全相同，7来源/5confirmed/2partial，11时间null、引用owner核验通过。 |
| 页面计量 | 页面测量读回，7commit/readback，无字段editId | 非模型分数 | PASS；MEASUREMENT.json、CHECK.json；4阅读>10秒/active0，3缺失不补0；2失败保留。语义未裁决、四真人NOT_OBSERVABLE。 |

本轮改变渠道角色转换、匿名回放选择区，未改变source-contract、条件转换、时间图校验、ReviewSession/CAS/正式事务实现。资格unknown/前置等待及坏时间关系的既有浏览器证据可复用[上轮最终C19 S03及graph反例](../channel-followup/browser/final/CHECK.json)、[错owner图](../channel-followup/browser/graph/CHECK.json)；本轮还用真实Schema/保存定向回归这些公共组件。没有声称重跑无关完整矩阵或以旧首屏代替本轮渠道场景。

没有编辑字段，因此本轮不证明新字段恢复/冲突机制，只证明既有选择/草稿关闭重开、原子失败恢复及只读恢复仍可用。手动/真人均NOT_RUN。页面留在已保存任务详情供核对，内部唯一URL6833。
