# D23 实际浏览器与独立读回

2026-09-30，官方 Computer Use 浏览器 DOM 控制。匿名工程角色，全新 6725 / `engineering-final01-p1`—`p4`；真实参与者/模型调用均 0。D22 6718 保持，不读旧用户库。本文件报告发生过的操作及实际原始证据，不把自动化时间当真人。

| 接线场景 | 实际操作/结果 | 证据 |
|---|---|---|
| 真人无范围与未登记阻断 | 当前工程入口“检查真人开始资格”返回 D23_REAL_SCOPE_AUTHORIZATION_MISSING；初始空登记不能开始；错计划、缺同意另由定向测试证实 | final-gates.png；角色/同意/身份测试 |
| 固定原文辅助 | p1-1/S01：打开 d21-record-02，材料核对、选择任务；原始回答及真实 commit/readback 保存 | final-recovered.json；delivery-readback.json |
| 固定原文空白手动 | p2-1 同源 S01：空任务/材料/事件/时间，人工补任务、材料和 deadline，再按正式路径核对/确认 | final-manual.json；最终 final-event-no-task.json 同库读回；实际 source SHA 与 p1 一致 |
| 原子写失败 | p1-1 注入正式失败，页面原输入保留，Task=0；无半份 canonical | final-formal-failure.png/json |
| 提交后读回失败 | 手动重试提交成功 Task=1，但页面“已提交，读回尚未验证”；恢复只重读，同一任务仍 1、原 commit 保留 | final-pending-readback.png/json；final-recovered.json |
| 暂停与继续 | p1-1 核对弹层暂停后字段 disabled，继续恢复；p4 partial 在最终逻辑构建暂停/恢复后仍 partial | final-partial.png/json；其 events 与 timing.pauseMs |
| 纯信息归档 | p1-3/S04 manual；无当前义务，正式归档，按该来源读回 Task0/Project0，没有空项目 | final-no-task.json；delivery-readback.json |
| 无任务但有事件 | p2-4/S09 manual；添加停机事件、周三晚模糊起点，正式确认无任务。该来源 Task0/Event1/Time1；normalizedValue=null，rawText=周三晚、precision=vague、needsConfirmation=true | final-event-no-task.png/json |
| partial 不提前结束 | p4-1/S02 两任务仅选第一项保存；Task1，另一项待确认，complete=false，status=partial。暂停恢复不会变整份完成；总时间未闭合为 null | final-partial.png/json |
| 退出与缺失保留 | p3-1 有实际编辑后刷新，再退出；editMs=887，RELOAD_UNCLOSED_INTERVAL，总时间 null。未打开辅助的退出也保留开始分母 | final-exit-missing.json；final-aggregate.json |
| 两身份独立全图 | p1/p2 同源不同条件，独立物理库；p1 Task1/Event0/Time1，p2 Task1/Event1/Time2，各自注册/草稿/历史/trace，不混入真人 | final-adjudication.json、final-event-no-task.json；隔离正反例 |
| 任意旧试次裁决与过期阻断 | p1 已开始 4 条之后选第一条，载入真实 canonical、原答，追加工程全未决/争议记录；旧 SHA 裁决被 D23_STALE_OR_UNCOMMITTED_ADJUDICATION 拒绝 | final-adjudication-gate.png；final-adjudication.json；delivery-readback.json |
| 全身份汇总 | 独立读 4 个白名单库：13 开始、4 完成候选、8 退出、1 partial；首次暴露/固定来源、manual/assisted 与缺失分别报告 | final-aggregate.json |
| 真实错误保留 | p1-4 S09 辅助遗漏事件后覆盖保护阻断；p3-2 S07 模糊时间受 TIME_NEEDS_REVIEW 保护；均退出不凑成功 | final-aggregate.json；source 对应原 D17 raw 引用 |
| 最终构建与页面读回 | 代码已提交/推送 f7b635c，source c4758fcdad41；刷新后 p1 独立读回 Task1/Project0/Event0/Time1，真人仍不可观测 | d23-delivery.png；delivery-readback.json；BUILD_WITNESS.json |

## 构建和复用界限

本轮工程过程中存在多次匿名代码构建。没有实际真人试次，不将这些构建拼成真人效果组。每份 JSON 保留实际构建、库、试次及原始 SHA；不把早期页面叫作最终构建。

`final-formal-failure`、`final-pending-readback`、`final-recovered`、`final-manual` 是 a1f125156987 过程构建的正式保存路径证据。后续改动仅涉及角色门/试次绑定、显示与汇总，不改正式 DomainCommitPlan 或 D22 事务恢复算法；最终逻辑定向测试仍复验相同失败分支。`final-no-task`、`final-exit-missing` 是 e83bc83d3a51 过程证据。最终逻辑 f0ddf4198c8b 已复验 partial 暂停恢复、p1/p2 canonical 和汇总；其后仅去掉代码尾空行，提交构建 c4758fcdad41 再刷新读回留交付图。旧截图出现的“显示 SHA 对应错排程”已修，真实存储来源 SHA 一直正确；最终页面显示与原文一致。

D22 的同页混合任务/两个事件、字段恢复、真实 CAS 并发和旧清理保护未改算法，沿用 D22 A—L 证据；本轮只复验受新增试次门和计时影响的路径，不声称重跑了整套 D22。跨试次修改旧来源、身份漂移和缺同意的原子阻断由实际 Repository 定向反例补证；未声称用浏览器点出了每种身份伪造。

截图与紧凑 canonical/测量见证进入 Git。[EVIDENCE_INDEX.json](EVIDENCE_INDEX.json)列逐文件 SHA、实际角色和构建；浏览器页面导出的原 JSON 原字节在忽略目录 `.data/d23/browser-originals`，摘要保留其 SHA，不修改历史录制 raw。工程模拟负责人和同意引用明确为非真人；唯一模拟裁决全部未知，没有代签真人或独立真值。
