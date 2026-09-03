# RCO-5-004 完整命题图零调用契约

## 当前结论

`RCO-5-004 CLOSED / FAIL / REJECT_CANDIDATE / ZERO BUSINESS MODEL CALLS / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`

本轮只建立一个与稳定路径隔离的候选中间层。它回答的不是“某个词是否出现”，而是“原文完整表达了什么命题、谁受约束、是什么语气、现在是否仍有效，以及不同命题之间是什么关系”。这仍是匿名夹具上的技术契约，不是模型正确率。

## 契约主线

1. 本机先按完整句末标点建立不可由模型改写的 `scope`；每个原子字段都必须携带可复算的 `start/end/text/scopeId`。
2. 模型候选只能输出 `nodes + relations`，严格 Schema 拒绝 `selected`、验证结论和额外字段。
3. 每个命题都必须标注受约束或受影响主体、言语行为、极性、时态、状态、有效性、模态和推断等级。
4. 任务—时间、任务—材料、任务—事件、事件—时间、事件—地点及修订关系全部类型化；每条关系都必须列出按原文顺序排列、同时覆盖两端命题的完整 `evidenceScopeIds`。
5. 验证报告必须绑定整份原文和完整候选图，覆盖全部 scope、node、relation，并明确图覆盖与修订覆盖均为 `complete`。
6. 候选生成与验证必须使用不同 run ID。匿名测试 oracle 只能通过显式开关启用；尚未接入可信验证服务时，声称 `independent_semantic_verifier` 会直接拒绝。
7. `selected` 只由 composer 计算。命题必须同时为独立判定 `entailed`、原文明示、肯定、现在/未来、待办、有效、面向用户/目标群体，且满足字段专属条件。
8. 任何未确认修订关系都会保守压住旧命题；关系、时间、材料或地点一旦不安全，就不会借由安全任务“搭便车”进入默认关联。
9. 事件还必须有已选任务通过 `task_event` 指向它；只有时间地点、没有用户行动的纯信息活动保持未勾选，`requiresAction=false`。
10. 输出仍是 `userConfirmationRequired=true` 的待确认建议，不建立正式任务、项目或已确认日历事件。

## 属性变形与反例

- V1 定向测试共 49 个；第一轮新鲜审查仍复现了“上传 API Key”被勾选、取消关系被等价重复节点绕过，因此 V1 已拒绝，不能用 49/49 宣称通过。
- V2 定向测试共 56 个；第二轮新鲜审查仍复现零宽字符绕过和“上传附件—材料为 API Key”的跨命题搭便车，因此 V2 同样拒绝。
- V3 定向测试共 59 个，安全判断和命题等价识别先做 NFKC、去不可见控制/格式/分隔/标点/组合符归一化；受控外传动作仅允许校园常见材料对象，且所有可输出命题的原子字段都经过敏感内容阻断。
- V3 第三轮新鲜审查用“Access Token 文件”证明“文件名像校园材料即可放行”仍是关键词死胡同，因此 V3 拒绝。V4 改用行为级门：`提交/上传/发送/交付` 无论对象叫什么都只生成未勾选建议，用户必须手动确认；敏感词只做额外拒绝，不再承担外传动作的默认安全证明。
- V4 第四轮新鲜审查又用“填写并提交报名表”等动词—对象拆分绕过，证明只检查 `verb` 仍不是真正行为级。V5 将 `effect` 纳入动作 Schema，并用完整 scope 检查外传表面与 effect 一致；`external_transfer/unknown` 一律未勾选。同时补齐兼容/多语问号与 task-event 关系证据传播。
- V5 定向 69/69 后，第五轮新鲜审查仍用未登记反例“请完成报名材料邮寄。”复现错误默认勾选：`完成` 被判为本地动作，`报名材料邮寄` 中的“邮寄”不在有限外传词表，候选仍通过验证并生成 `selected=true`。V5 因此同样拒绝。
- 覆盖 RCO-5-003 的决定性反例：完整问号保留在 scope 内，问句不能冒充肯定断言。
- 覆盖伪造 offset、跨 scope 原子、候选偷带 `selected`、候选偷带 verifier、错误/不完整 fingerprint、漏读 scope、缺 node/relation 判定、图覆盖不完整、修订覆盖未知。
- 覆盖关系证据漏掉端点、乱序、重复角色、错误端点和修订环。
- 覆盖 unknown 修订 fail-closed、被判 contradicted 的假修订不压制有效命题。
- 覆盖纯信息事件、事件事实主体不安全，以及未验证材料/时间经安全任务关系泄漏。

## 已知边界

- `contract_fixture_oracle` 是测试装置，不是独立 AI 或人工复核。当前真正的独立验证器是 `NOT_CONNECTED`，因此本候选不能在真实路径生成默认勾选建议。
- fixture fingerprint 使用 FNV-1a 只用于发现无意漂移，不是密码学签名；后续可信验证接入必须使用服务端身份绑定和抗篡改摘要。
- 当前 69/69 只能证明登记的匿名属性变形均按预期 fail-closed；第五轮未登记反例已经证明测试外仍可绕过。它不证明模型能正确产出完整命题图，也不证明真实材料泛化、Recall、Precision 或修改时间。
- 该文件没有被 Worker、浏览器录入、稳定模型或 Workspace 提交路径 import；RC.4、Release、Production 均未改变。

## 工程验证快照

- 定向 Vitest：V5 `69/69 PASS`；V1 至 V5 的 fresh audit 均为 `FAIL / REJECT_CANDIDATE`，最终反例为“请完成报名材料邮寄。”。
- 全量：Vitest `464 passed / 1 live OCR skipped`；server `8`、Worker `25`、time parity `1`、multimodal evaluator `23`、Functions `5` 全部通过。
- `lint`、`typecheck`、Schema/time drift check、`build` 通过；构建仍保留既有大于 500 kB chunk warning。
- 安全扫描覆盖 `327` 个源码/构建文件；`npm audit --audit-level=high` 为 `0 vulnerabilities`。
- Cloudflare default、preview、multimodal_preview 仅 `dry-run PASS`；没有部署。
- 受保护 V2/V3 dataset、OCR、checkpoint、summary、freeze 当前 `10/10` SHA-256 匹配，保护路径无 Git diff；只证明当前无净字节漂移。
- business model / Repair calls：`0 / 0`；Secret：`NONE`；真实材料：`NOT_USED`；真人研究、浏览器验收、部署：`NOT_RUN`。

## 最终裁决

完整命题图、`action.effect` 和独立 composer 是正确的抽象方向，但当前实现仍用有限本地词表判断开放式自然语言中的动作效果。只要存在词表外同义表达，就可能把真实的对外发送、上传、交付或邮寄误标为 `local_change`，继而错误默认勾选。继续补“邮寄”等词只能修复一个已见样例，不能封闭测试外表达空间。

真正独立的语义/安全验证器当前为 `NOT_CONNECTED`，因此没有可信组件能够证明 `action.effect`。RCO-5-004 的基础技术门失败，候选封存为 `REJECT_CANDIDATE`；不运行付费 B1，不启动 RCO-6，不接稳定路径，不部署。若继续，需由新的明确授权先设计并接入有身份绑定、全图绑定和失败关闭能力的独立语义/安全验证器，或改成只有在非词表证据能够确定动作效果时才允许默认勾选。
