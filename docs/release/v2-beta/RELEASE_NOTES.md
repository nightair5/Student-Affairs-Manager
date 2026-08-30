# Student Affairs Product v2 Beta Release Notes

> Candidate：`v2.0.0-beta.1-rc.1`
> Preview build commit：`5c443d40d986483b983e98ff52efedd26d9b87fc`
> Preview Version：`64d9b827-0787-4188-9cf3-032202c672c1`
> 当前状态：`RELEASE CANDIDATE VALIDATION IN PROGRESS`
> Production：未部署、未改动

## 面向用户的核心变化

- 通知先保存为 Source，再进入识别；关闭录入面板或 AI 失败不会丢失原文。
- AI 与本地规则只生成待确认 Draft，不会直接创建正式任务。
- 多事项通知支持逐项编辑、拒绝、部分确认与全部确认；默认只勾选原文明示事项。
- 每项建议可定位到本次 SourceVersion 的原文依据；历史 Draft 不会引用后来修改的正文。
- 确认通过 `DomainCommitPlan` 在单个 IndexedDB 事务中写入 Workspace v8，防止半成品。
- 收件箱区分未处理、处理中、待确认、已确认、失败、已归档和纯信息。
- Today 只突出最多三项可执行任务，受阻和稍后事项单独展示。
- Project、Calendar 与 Library 读取 canonical 项目、事件、时间节点和材料事实。
- AI 超时、502、无效输出或未配置时保留 Source，并允许改用本地规则或手动补充。

## 数据与恢复

- 当前浏览器 IndexedDB 是唯一事实源；数据不会自动同步到其他设备、浏览器或域名。
- v7 升级前先保存不可变备份；迁移在内存中完成全图校验和 semantic round-trip 后才原子替换。
- 迁移完整性失败时停止自动保存，不静默覆盖旧记录；用户必须先导出指定备份，再二次确认恢复。
- JSON 导入先验证大小、schema、枚举、JSON-safe 与引用图；失败不破坏当前 Workspace。
- 清空数据需要应用内二次确认，且无法撤销；建议先导出 JSON。
- 文件本体、图片和扫描件不写入 IndexedDB 或 JSON 导出。

## AI 与隐私边界

- 使用固定的稳定产品路径 `deepseek-v4-flash`，不使用未通过门槛的实验模型、Selection、Blind 或 FactLedger runtime。
- 每次智能整理只发送用户当前主动提交的文字；不得发送文件本体、图片、整个工作区或真实裸链接内容。
- DeepSeek Key 只存在于服务端 Secret，不进入 React bundle、IndexedDB、导出、URL、日志或 Git。
- 所有推断显式标记为 `explicit`、`strong_inference` 或 `optional_suggestion`。
- 自动项目匹配和补充通知自动变更未正式开放；Beta 使用人工选择项目与手动编辑降级路径。

## 已诚实保留的限制

- 复杂通知仍需用户重点确认，尤其是任务拆分、项目关联、相对时间和取消事项。
- AI 建议可能遗漏、误解或过度拆分信息；用户应核对关键日期、材料和命名要求。
- 自动项目匹配尚未正式开放。
- 补充通知自动 diff / Apply 尚未正式开放；用户可以关联已有项目后手动编辑。
- 部分图片 OCR 和扫描 PDF 需要人工校对；页数、文本长度和浏览器资源有限制。
- 浏览器通知仅在页面存活期间调度；邮件计划不等于已发送；微信、跨设备同步和账号系统未接通。
- 当前 Preview 的 Browser A–J、真实回滚演练和 48 小时稳定期仍未完成，因此本文件不是 Production 发布批准。
- 未改动的旧 Production 对实验样式路径仍返回 SPA HTML 200；新 Preview 返回 JSON 404。该字面 404 门槛必须在独立 Production 发布任务中经明确批准后关闭。

## 当前验证状态

| 项目 | 状态 |
| --- | --- |
| lint / typecheck / build | PASS |
| UTC 与 Asia/Shanghai 完整测试 | PASS |
| Server / Worker / Functions | PASS |
| security scan / npm audit / Cloudflare dry-run | PASS |
| Preview 部署与版本绑定 | PASS |
| Alpha Test Kit | READY；真实参与者测试 NOT RUN |
| Browser A–J | NOT RUN |
| Preview 浏览器迁移与回滚演练 | NOT RUN |
| 48 小时稳定期 | IN PROGRESS |
| Production 部署 | NOT AUTHORIZED / NOT RUN |

只有 [QA_ACCEPTANCE.md](./QA_ACCEPTANCE.md) 与 [MIGRATION_ROLLBACK.md](./MIGRATION_ROLLBACK.md) 的人工门槛全部关闭，最终报告才允许提升为：

```text
PRODUCT V2 BETA RELEASE CANDIDATE READY
PRODUCTION RELEASE AWAITING APPROVAL
```
