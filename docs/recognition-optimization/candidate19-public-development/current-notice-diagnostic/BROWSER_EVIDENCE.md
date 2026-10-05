# 实际页面边界与本批待验路径

2026-10-05。当前状态入口http://127.0.0.1:6852/，构建c4f5aedf7cb7 / source 0ae7e9716e95；Candidate19原契约、时间2.1.0/首次组装1.1.0，ENGINEERING_REPLAY。

命令：`node scripts/serve-candidate19-recorded.mjs 6852 currentdiag1005ready --current-notice-batch`。全新预留隔离DB身份rco-mainline-01-02-i1-d27-plan-recorded-currentdiag1005ready；0raw时页面不打开DB。未访问旧6851或旧用户库。新批不加载旧封存录制、旧12控制或手写wire。

官方Computer Use浏览器新建tab后，实读4份通知名称、原referenceTime、NOT_RUN、首次整份UNKNOWN及模式；保存[BROWSER_PENDING.txt](BROWSER_PENDING.txt)及[实际截图](BROWSER_PENDING.png)。浏览器日志error/warn均0。静态页面0表单、无/browser.js；独立HTTP读manifest/recordings确认0录制0fixture0历史混入，POST/api/deepseek为403，GET不存在bundle为404，见[BROWSER_HTTP.json](BROWSER_HTTP.json)。只是待授权状态验收，不是模型首屏语义验收。

| 本批真实输出验收 | 当前状态/最小接续 |
|---|---|
| 四通知人工前首次建议完整事实/依据/关系 | NOT_RUN，取得4确定raw后同模式新实例载入普通App，不由Codex补模型漏项 |
| 正确项部分确认、坏关系局部阻断 | NOT_RUN，跟据实际raw选项及相关风险；既有底座证据不替代新raw |
| 事务失败保留输入、手动恢复、已提交只重读 | NOT_RUN，新库分别注入并核canonical/commit，不自动重发 |
| 刷新、独立Repository数量/值/精度/依据/owner | NOT_RUN，同来源正式事务后另一repository读回，未知不造日历 |
| D27最小安排 | NOT_RUN，原截止与个人planned_start/end分开；不扩全局计划器 |
| 新raw测量 | NOT_RUN，真实edit/checkpoint/commit/readback关联；未闭合时间null，无edit不造editId，工程不计真人 |

授权后保持本次冻结不变，确定录制后使用新未占用端口与全新实例（已建实例禁止覆盖）。最终只推荐实际新raw运行的一个普通入口，记录构建、录制SHA和canonical证据。当前没有这些输出，不能提前标PASS。四项真人指标仍NOT_OBSERVABLE。
