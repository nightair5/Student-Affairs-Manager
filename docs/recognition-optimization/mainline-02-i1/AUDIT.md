# RCO-5-MAINLINE-02-I1 审计

## 结论：未通过交付，NOT ACCEPTED

当前源码保留在本机未提交；本次只提交/推送审计文档与短交接。独立代码审查与全量工程门通过，真实App主链已取得进展，但JSON实际下载文件尚未验证，浏览器协议仍有明确未完成项。不得把工程绿灯或42/42改称整体完成。

模型识别准确率：本轮未测量。外部识别模型、verifier、Repair、retry、模型网络请求与费用均0；不访问密钥/剪贴板，无真实材料/真人/部署/RCO-6。Git与npm依赖审计网络不是模型调用。

## 做了什么，推进哪一环

- 在批准9个公共文件内以显式runtime/可选props接真实App，普通main.tsx不改。
- 8个新源码/测试与2脚本复用真实capture、canonical仓储、冻结V2确认器；新库缺失/错误时拒绝，不回退用户库。
- 先持久化来源，再旧人工响应；面板只传真实用户动作/值/ID/版本，不把显示值伪装成编辑。
- 无截止任务可确认和保存，在任务中心/日历独立列表可找；不造截止时间/提醒，不清除材料/依赖风险。
- 实验关闭旧整份草稿自动保存、模型/状态/OCR/URL/通知路径；未纳入的结构修改、正式编辑/执行/ICS明确阻断。
- 独立审查发现date-only误判和日历伪造08:00，以及实验文案错称本地规则。先新增3个失败测试，第一轮局部修补后闭合，原审查结论保留。

这推进的是“建议正确时，真实产品能否承接、确认和持久化”，不是提高/测量模型识别准确率，也不代表接到稳定入口。

## 数字

| 检查 | 结果与边界 |
| --- | --- |
| 定向/对抗 | 99/99：旧68+新31；旧17未改 |
| 完整Vitest | 932通过、1按原配置跳过（live OCR组件），不运行真实OCR |
| Node工程测试 | 66/66：server8、worker25、time parity1、multimodal library23、seen replay library4、functions5 |
| 全量合计 | 998通过、1跳过；不重复加定向数字 |
| lint / app+node类型 / Schema+时间契约 | 通过 |
| 构建 | 新临时目录通过；存在>500kB chunk警告，未调阈值掩盖，不属本轮修复范围 |
| 构建隔离/安全扫描 | 通过；源码/构建敏感信息扫描749项（工程门时点），不输出疑似值 |
| 依赖审计 | 0 vulnerabilities，使用新临时缓存 |
| 独立审查 | 首轮BLOCKED→一轮局部修补→复核PASS；不是浏览器PASS |
| 新通路42字段 | 定向42/42；真实App→Inbox批量→IndexedDB读回也是42/42 |
| 旧证据 | 40/42、旧17、所有历史FAIL保持不变 |
| 真实App多任务 | 0→双击确认1→剩余2→刷新2；第一项未覆盖；明确编辑历史2，原文/首次响应未变 |
| 真无截止 | 1任务、0时间、0提醒、真实jobs函数0；可搜索/日历找到 |
| 八类旧工程通知 | 实际录入8来源/8run/8草稿；4正式任务，4类预期不默认选，1类契约未支持保留失败来源 |
| 已观察安全数 | 错误默认选、未确认正式写入、重复、覆盖、关键字段丢失均0；只限已跑场景 |
| JSON下载 | NOT VERIFIED：两次监听超时，无同名Downloads文件；处理器已读库，不等于文件可用 |

原始长日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline-02-i1-yjIYJz；提交副本ENGINEERING_CHECKS.json。
定向最终：rco-mainline-02-i1-fiWRls/results.json。更正过的新测试构造详见TEST_CONSTRUCTION_NOTES；不是修改旧Expected。

## 未解决问题

1. App真实JSON下载没有得到可解析文件。没有证据能确定是立即撤销Blob URL、未挂DOM链接、异步下载机制还是IAB能力；不能靠猜测改代码或报浏览器通过。
2. 浏览器尚需补：面板双项一次性批量、保存事务故障、已保存编辑后的确认故障、跨标签过期以及date-only输入→日历显示。对应定向/SSR已过，不冒充浏览器实测。
3. 工程证据工具被实际App固定Sidebar部分遮挡，本轮通过官方键盘操作读取；这不是核心产品已改布局，但后续验收入口应在原获准browser.tsx内保证工具可操作。
4. 正式任务编辑/执行/ICS/真实提醒/报表、图片文件识别与稳定入口接入仍不在本包；禁用不等于这些能力通过。

## 保护与Git

- 唯一仓库C:\Users\Winner\student-affairs-multimodal-exp，分支codex/e2-multimodal-recognition-exp。
- 起始HEAD及远端1657fb9a5b47504e7264a841b919d4765a710233；未回切R2、不重置、不套FAILED补丁。
- 起始R2九源码匹配、SCOPE703保护通过；本轮712项原tracked中701项保护全部SHA-256不变。
- 获准11现有路径：9源码+CURRENT_CONTEXT+追加日志；新源码/脚本精确19个路径集合，无范围扩大。
- Schema/repository/migration/validator/legacyView/confirmationV2/domainCommit/时间AST/旧Expected、freeze、dataset、checkpoint、历史结果/runner均未改。
- 未写旧缓存；测试禁缓存，构建/npm audit用新临时目录。未读取密钥文件或剪贴板；没有全盘哈希声称。
- REJECTED_SNAPSHOT.json绑定19个当前实现文件。当前验收未过，业务代码不暂存、不提交；文档交付SHA与远端以Git回执及FINAL_CHECKS.json为准。
- 稳定入口/用户工作区/Production/已有Preview未触及。未运行旧一次性runner、未建新数据集/B10。

## 唯一下一建议

执行RCO-5-MAINLINE-02-I1-R1，先用明确批准的已安装Edge在新隔离库诊断App真实JSON下载，然后补完上述未验收浏览器项；只在有证据时修导出接线或工程入口可操作性，不换模型、不重做数据/计划。保留本失败结论与旧证据，成功后才提交本机业务实现。详细授权文字见NEXT_PROMPT.md。

理由：用户只有能确认、刷新找回、完整备份才拿得到产品价值；现在再花钱调模型不能替代尚未完成的客户端保存/导出证据。
