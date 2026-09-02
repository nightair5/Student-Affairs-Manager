# RCO-2 唯一中文时间 AST

## 结论与边界

RCO-2 把浏览器 parser、本地 Recognition Pipeline、Cloudflare Worker 和评测器的时间解释收敛到 `src/lib/timeSemantics.ts`。本阶段只完成确定性工程与匿名夹具验证：模型调用、Repair 调用、Secret 访问、真实材料、真人研究和部署均为 0 / NOT RUN；不证明模型正确率、商业正确率或上线资格。

唯一源由 `scripts/generate-time-ast.mjs` 转译为 Worker 可执行的 `cloudflare/chinese-time-ast.generated.mjs`；`npm run recognition:contract:check` 同时检查 Schema 契约和时间 AST 生成物漂移。当前时间源 SHA-256 为 `d72109638ce4c653602478d2cd09049ab5a896a17c041422e8f5b583b8afde7d`。

## 字段责任

| 字段 | 责任方 | 规则 |
|---|---|---|
| `rawText` | 本机 parser 或模型提取 | 保留证据原文；不把归一化值当证据 |
| `type` | 任务/事件语义层或模型提取 | 只允许 RecognitionResult 2.0 枚举 |
| `evidenceIds` | 证据层 | 继续由共享 Schema 检查引用 |
| `normalizedValue` | 时间 AST | 忽略模型自报值；可靠时生成，否则 `null` |
| `timezone` | 请求/工作区 + 时间 AST | 必须为有效 IANA timezone；无效请求在模型前拒绝 |
| `precision` | 时间 AST | 只有日期为 `date_only`；明确日期时刻为 `exact`；不可靠为 `vague` |
| `isAllDay` | 时间 AST | `date_only=true`，明确时刻或模糊时间为 `false` |
| `needsConfirmation` | 时间 AST | 可靠值为 `false`；缺失、非法、冲突或语义不匹配为 `true` |
| `selected` | 安全适配层 | 只有证据存在、值非空且无需确认时才可选中；仍只是待确认建议 |

## 支持与 fail-closed 规则

- 支持阿拉伯/中文数字、全角字符、数字与日期单位间 OCR 空格、中文冒号和“半”。
- 区分清晨/早上/上午、中午、下午/傍晚、晚上/夜间/夜里和凌晨；`上午十二点=00:00`，`下午十二点=12:00`，`夜里十二点`跨到次日。
- `今天/明天/后天/本周/这周/下周`只按显式 `referenceTime + timezone`解析，不读取宿主机本地时区。
- 只有日期时保留 `YYYY-MM-DD + isAllDay=true`，不补 18:00；缺日期时不补七天后。
- 支持日期/时间范围、跨午夜、跨年、闰年和“原定…更正为/延长至…”；更正取明确的新值。
- 裸“3点”、非法日期、无效时区、冲突日期/时刻、错误范围，以及把“预计公布”标成截止时间，统一输出 `normalizedValue=null + needsConfirmation=true`。
- 范围结束值保留在 AST 的 `rangeEndNormalizedValue`；本地事件映射成独立 `event_end` TimePoint。Worker 不凭空创建模型未声明的业务实体。

## 四端接线

1. `src/lib/parser.ts` 删除独立数字/时段/相对日期换算，`ParsedSuggestion.deadline` 只兼容镜像 AST 值；无值使用空字符串，不再造默认日期。
2. `src/recognition/pipeline.ts` 直接映射 AST 到 TimePoint；事件范围生成 start/end；“答辩前准备”没有明确时刻时保持待确认。
3. `cloudflare/recognition.mjs` 在严格 Schema 校验前只覆盖时间派生字段，保留未知字段、缺字段、重复 ID 和悬空引用继续 fail-closed；校验后再用同一 AST 复算一次。
4. `scripts/multimodal-evaluation-lib.mjs` 使用声明的 timezone 解释无偏移 wall-clock，不再由运行评测器的主机时区决定匹配结果。

## 兼容与迁移

- `ParsedSuggestion.timePoint` 为可选字段，旧草稿无需破坏性迁移或重写；进入新 Pipeline 时可从既有 evidence 重新解释。
- 已确认 Task、Workspace v8、历史 TimePoint、Expected、dataset、freeze、checkpoint 和 cache 均不回写。
- RecognitionResult 2.0 外形未改变；旧模型仍可返回既有时间派生字段，但这些字段不再受信任。

## 0 调用验证覆盖

- 版本化单元/属性测试：中文数字、半、全部时段、相对日期、date-only、无日期、歧义、冲突、更正、范围、跨午夜、跨年、闰年、每月合法日与溢出日、OCR 噪声。
- 跨主机验证：同一生成 AST 分别在 `UTC`、`America/New_York`、`Asia/Shanghai` 宿主进程运行，输出逐字一致。
- Worker 对抗验证：模型省略派生时间字段时由 AST 补齐；模型给出非法日期时变为未选中的待确认时间；其他缺字段、未知字段、重复 ID、悬空引用和来源外 evidence 仍失败。
- 评测器验证：带 offset 的期望值与声明 timezone 的本地 wall-clock 值按同一语义匹配。

RCO-G2 通过只表示上述技术契约与回归门成立，结论仍为 `NO_PROMOTION / DO_NOT_LAUNCH`；RCO-3、模型调用、Preview 和 Production 均需另行授权。
