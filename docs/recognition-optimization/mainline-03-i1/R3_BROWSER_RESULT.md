# R3 实际 Edge 验收：NOT_ACCEPTED_DOWNLOAD_UNVERIFIED

本轮按原 BROWSER_PROTOCOL 执行；工程门已先通过。12 项协议按严格口径：10 项 PASS、1 项 PARTIAL（第 2 项文件侧 42 字段未核验）、1 项 BLOCKED（第 11 项真实下载缺失）。不能称整个浏览器验收通过。

## 身份与方法

- 日期：2026-09-06，Asia/Shanghai；只用旧匿名 multi/no-date 与 B8-01 已见候选，无新数据、无模型预测。
- Edge browser id 2；新标签 763114512、763114513；未读取既有用户/API 标签。
- origin：http://127.0.0.1:12736；run：mainline03-de61624d-c2dc-4a41-a629-0509029d2193。
- 唯一新库：rco-mainline-01-02-i1-mainline03-de61624d-c2dc-4a41-a629-0509029d2193。
- 首次 new=1 建空 v8 库；第二标签无 new 参数；未换端口、清库或预置正式任务。
- 真实 App、来源 handoff、V2 面板及真实 IndexedDB repository；工程“读取测试库证据”调用 runtime.load 后输出完整对象，逐对象比较，不以提示语作存储证明。
- 通知输入允许 fill；任务名称和时间编辑全部 pressSequentially 逐键并明确保存，无剪贴板操作。

## 原协议逐项结果

| 项 | 状态 | 本轮实际证据 |
|---|---|---|
| 1 来源先存 | PASS | 空库 0 来源/0 任务；multi 录入后 1 Source/Run/Draft，0 正式任务。原 raw 仍 pending-source/无位置；适配来源 source:8c45d6df、范围 0–82，原文逐字保留。 |
| 2 恢复与两项一次批量 | PARTIAL | 关闭恢复后一次确认两项，库 0→2；原口径 canonical 42/42。首次响应未改；Source 仅 status/updatedAt 变化。实际文件侧 42 字段 NOT_RUN。 |
| 3 真无日期 | PASS | 通过真实统一录入→逐项确认；任务中心和日历无日期独立列表找到。该任务关联时间 0，提醒 0，实际 jobs 0。 |
| 4 逐键与明确保存 | PASS | 另一份旧 no-date；名称先改为“保存活动手册（核对版）”，逐键补 2026-09-18。新增两条用户编辑历史；原文和首次响应未覆写。 |
| 5 保存故障回滚 | PASS | 下一事务故障后保存报 INJECTED_ATOMIC_FAILURE；整库逐 JSON 相等、缓冲保留、逐项/批量确认禁用。用户再次明确保存成功。 |
| 6 已保存后确认故障 | PASS | 确认事务失败，整库不变、正式任务仍 3、两条成功编辑历史保留；刷新读回全对象相同。 |
| 7 跨标签过期 | PASS | 第二标签逐键改“保存活动手册（跨标签核对版）”并保存；旧标签确认报 CONFIRMATION_V2_STALE，整库不变。刷新核对新版本后主动确认。 |
| 8 重复、部分、Inbox | PASS | 旧标签对已确认项再次确认，整库相同、任务仍 4。另一个旧 multi 先确认一项到 5，兄弟仍待确认；Inbox 批量剩余到 6，既有实体逐对象不变。 |
| 9 date-only 与只读边界 | PASS | 用户日期 raw/normalized=2026-09-18、timezone=null、isAllDay=true、precision=date_only、manual；日历 9/18 显示“仅日期”，无日期项仍独立。正式编辑/执行/ICS 按钮禁用，不宣称功能通过。 |
| 10 已见候选失败保留 | PASS | B8-01 报 CONTRACT_UNREPRESENTABLE；Source receipt 保留原模型/原 raw/seen/原文件哈希，Run/Draft failed、result=null，任务仍 6。不是新模型成绩。 |
| 11 实际 JSON 文件 | BLOCKED | 见下面三次 UI 触发与文件定位。未获得本次真实文件，不能用页面 JSON 或内部 exportJson 代替。 |
| 12 刷新读回 | PASS | 最终同库刷新前后整个对象逐 JSON 全等；所有原 receipt、首份 multi 正式实体未变；来源 5、草稿 5、任务 6、时间 5、材料 4、历史 18（编辑 3）、提醒 0。 |

“重复不增项”指同一确认操作重放；为部分/编辑验收而再次主动录入同一旧通知形成新来源，不计为同一提交重复。新来源保留 duplicateOfSourceIds 提示，不静默覆盖旧来源。

## 下载阻碍的已见证据

- 导出前仅定位 Downloads 中 mainline-02-i1-workspace*.json 元数据：5 个旧文件，最近为 2026-09-05 14:30:55 UTC 的 (4).json，34166 字节；未读取这些旧文件内容。
- 2026-09-06 04:18:41.929 UTC：真实导出按钮 Enter + 下载监听，15 秒超时。
- 第二次真实按钮 click + 监听，10 秒超时；再次定位同名文件，仍无本次新增文件。
- 重新选择本轮主标签后第三次可见按钮 click，完成于 04:20:41.456 UTC；再次定位仍只有上述 5 个旧文件。
- 三次 UI 操作均不改产品；未调用内部 exportJson、未改下载设置或安全限制、未访问 edge://downloads、未绕行浏览器安全策略。
- 文件绝对路径/大小/SHA/解析/文件与 canonical 全对象比对：均 NOT_AVAILABLE/NOT_RUN，不能借用旧文件或 R1 历史成功。
- read-only 源码显示 App.tsx:1410–1412 使用 runtime.exportJson、Blob 链接与即时 revoke；这只是定位线索，尚不能判定是产品生命周期、浏览器拦截还是工具交付问题。R3 无权修改该处理器，未修补。
- 后续应先定位下载落点/触发/链接生命周期证据，再申请准确改动范围。不要重新跑识别或重做已通过的主链。

## 观察误差与非零日志

- 某些鼠标操作出现 CDP Runtime.evaluate 超时；每次先读取新状态，确认未执行后才以正常键盘 Enter 操作。工程工具折叠条会遮挡面板底部按钮，截图可见；未强制点击、未改布局。
- 批量确认完成后弹层保留“0 待确认/已处理 2”，错误等待弹层自动关闭导致一次观察超时；随后显式关闭，真实库已确认 2，不重复确认。
- 一次读库按钮后立即读到旧 UI 快照，拆分调用后读到真实新快照；没有把初次旧显示当成数据丢失。
- 诊断曾错用不支持的 inputValue 和 Draft.sourceId；改用 DOM value 与真实实体 ID 后才计结果。DOM 沙箱不提供 TextEncoder，摘要尝试失败；未用替代隐藏状态 API，无 SHA 成功声称。
- 主标签抽查仅 React DevTools/info 与扩展 content-script log；第二标签有 1 条 message-channel 异步响应错误，不能无源栈归因或声称控制台零错误。
- 上述观察问题与真实存储检查分别记录；下载缺失仍阻断，不因其他项目通过而放行。

## 安全及清场

- 本轮测试所见：错误默认选择/未确认正式写入/同操作重复新增/覆盖/丢失均 0；只覆盖本轮旧工程响应与已见诊断，不代表真实模型泛化。
- 主标签最终刷新前 epoch：recordReads 28、recordWrites 9；写入是尝试计数，不等于成功数，也非整个会话累计。
- 最终刷新后：只打开指定库，recordReads 3、recordWrites 0；localStorage/fetch/XHR/WebSocket/beacon/通知权限/通知发送均 0，实际 jobs 0。
- 两个本轮标签已关闭；服务器 PID 43692 的命令行与 12736 监听归属核对后停止。测试库/旧文件/临时日志保留，未清理或删除。
- 模型识别准确率：本轮未测量。外部识别模型/verifier/Repair/retry/模型网络/费用/密钥/剪贴板/真实用户库访问均 0。
