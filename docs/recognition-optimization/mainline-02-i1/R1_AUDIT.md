# RCO-5-MAINLINE-02-I1-R1 审计

## 结论：本机隔离工程验收通过

本轮闭合I1登记的下载与浏览器缺口。19实现文件从起始到完成均匹配拒收快照，R1新增源码修补0；交付的是此前未提交、此次验证通过的I1实现。旧I1 NOT_ACCEPTED、40/42、旧17测试和历史FAIL均保持不变。

模型识别准确率：本轮未测量。外部识别模型/verifier/Repair/retry/模型网络/人民币费用/密钥与剪贴板访问均0。无新数据集、真实材料、真人、RCO-6、稳定路径接入或部署；Git/npm审计与Codex开发用量另计。

## 原因与实际推进

Edge下载监听仍超时，但取得了实际文件，内容与同一测试库的canonical读回完全一致。因而监听不能作为唯一成功判据，也没有证据需要修改App导出代码。新成功不覆盖I1当时未取得文件的历史结论。

本轮推进“正确建议→真实App确认→可靠保存→刷新/查询→完整备份”。问题定位技能要求先找真实文件，不猜测改代码；Computer Use用于真实Edge操作；代码审查技能落实无上下文独立复核；Git技能在通过后交付获准实现，不强推。

## 数字与证据

| 检查 | 本轮结果 |
| --- | --- |
| 定向/对抗 | 新跑99/99，8文件；旧测试未弱化 |
| 完整Vitest | 新跑932通过、1原live OCR配置跳过 |
| Node工程测试 | 66/66：server8、worker25、time parity1、multimodal lib23、seen replay lib4、functions5 |
| 全量合计 | 998通过、1跳过；不叠加定向数字 |
| lint/双类型/Schema与时间契约 | 通过，未改配置或契约 |
| 构建/隔离/安全/依赖 | 通过；0漏洞，新临时目录/缓存，>500kB构建警告保留 |
| 独立审查 | 新无上下文PASS；独立重新读取文件、validator与真实提醒jobs |
| 实际面板双项一次确认 | 0→2任务、2时间；后续不覆盖 |
| 保存失败 | 全库不变、未保存缓冲保留、确认继续拦截，无假成功历史 |
| 已保存后确认失败 | 全库不变，2条已保存编辑保留，无新增任务 |
| 跨标签过期 | CONFIRMATION_V2_STALE、零写入；核对最新版本后主动确认成功 |
| 仅日期 | 逐键补2026-09-18并保存，date_only/all-day/timezone null；日历格及即将到来不造时刻 |
| 最终实际库/文件 | 3来源、3草稿、4任务、3时间、3用户编辑、0提醒 |
| 真无日期任务 | 1任务、0关联时间、0关联提醒；实际提醒jobs0 |
| 42字段 | 最终真实下载按原口径42/42；评分在读回后，不进入产品链 |
| 下载/刷新/工程后回读 | 实际JSON 34166字节，现行validator valid=true、issues=[]；全对象摘要相同 |
| 已跑安全场景 | 错误默认选、未确认写入、重复、覆盖、关键丢失0；外部请求/旧存储/通知尝试0 |

本轮用旧multi/no-date及重复no-date的不同操作，没有新建数据；I1八类场景及其他主链证据只读复用，不声称R1重新跑全部八类。
详见R1_BROWSER_RESULT、R1_DOWNLOAD_CHECK、R1_INDEPENDENT_REVIEW、R1_ENGINEERING_CHECKS。
实际下载：C:\Users\Winner\Downloads\mainline-02-i1-workspace (4).json。
全量日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline-02-i1-nWXYwl；定向：rco-mainline-02-i1-Lcfq08。

## 未解决范围与诚实边界

- 下载监听超时、message-channel日志非零，缺少可归因源栈，不称控制台全零或认定扩展导致；实际文件和存储结果已验证。
- 工程辅助工具局部被Sidebar遮挡，使用官方键盘操作；不称该辅助工具的鼠标布局已验收。
- 正式任务编辑/执行、ICS、真实提醒、报表、真实识别接线、稳定入口、Chrome/手机组合、真人效用和商业上线不属于本包通过范围。
- 两次只读诊断命令构造错误已记录并更正，不是产品失败；未修改旧Expected/夹具/评分。辅助下载管理器访问被工具策略拒绝后未绕行。

## 保护、收尾与Git

唯一repo C:\Users\Winner\student-affairs-multimodal-exp，branch codex/e2-multimodal-recognition-exp；起始HEAD/远端54e8f15ad7426ed37339bea56f19da33751aca2d。没有回切或套FAILED补丁。
701受保护文件、17份旧I1报告和19实现哈希均保持，追加日志前缀不变。Schema/repository/迁移/validator/confirmationV2/domainCommit/时间AST及旧Expected/freeze/dataset/checkpoint/cache/runner/result只读。
只运行获准工程检查，没有旧一次性runner；新构建/测试/审计不读.env、不写旧cache。新快照见R1_IMPLEMENTATION_SNAPSHOT，提交前保护见R1_FINAL_CHECKS。
Edge标签763114430、763114444及辅助空标签763114431已关闭；本轮server PID42292已停止、11829端口无监听。新旧测试库、下载文件和临时证据保留，没有访问/删除真实库。
通过后单独提交推送19实现、新R1报告及2动态文档；最终SHA与远端一致性以本次Git回执为准，不在本提交内伪造自包含SHA。回滚为停用本机实验入口；不自动清库、revert或reset。

## 唯一下一建议

RCO-5-MAINLINE-03-SCOPE：只读查清“现有真实识别输出→已验证V2”的字段与引用交接，形成唯一最小实施白名单。客户端承接上限已有工程证据，主线应回到真实识别输出的完整性，不再反复造人工数据，也不直接换模型或花钱。
详细待授权文字见R1_NEXT_PROMPT.md；本轮完成后停止，不自动实施下一包。
