# RCO-5-007-P3/B6 本机修订关系解析与新盲测计划

## 授权与边界

- status: `AUTHORIZED / ZERO_MODEL_CALLS / IN_PROGRESS`
- primary claim: 本机先构造“状态声明指向哪条旧指令”的可审计关系边，再投影任务状态，可以跨词面表达正确处理撤销、替代和修改，而不靠不断扩张历史关键词表。
- supporting claim: 旧任务退出当前待办与新任务生效彼此独立；修订解析不得改变动作原文、对象、执行人、安全默认或模型职责边界。
- anti-claim: 不能只把“先前、前述、上一版”等词补入 P2 正则并把已见 B5 的分数追到通过；也不能让模型直接输出 `selected` 或最终修订状态。
- unique variable: 新增隔离 `revision-relation-resolver-1.0.0` 和 `task-formation-policy-2.3.0-p3`；P2、B5 Expected/dataset/freeze/result、评分器和既有 checkpoint/cache 保持字节不变。
- stable path / RCO-6 / deploy: `UNCHANGED / NOT_STARTED / NOT_RUN`。
- model / network / repair / retry / secret: `0 / 0 / 0 / 0 / NONE`。

实验计划技能引用的三个共享输出模板本机缺失，本阶段沿用项目既有计划、跟踪表、冻结清单、追加日志和短上下文。

## 机制契约

1. 状态声明必须形成独立 `RevisionRelation`，至少包含 `kind`、旧任务 ID、可选新任务 ID、证据 scope ID 和解析依据。
2. `cancels` 表示旧要求失效且无替代任务；`supersedes` 表示旧要求失效并由新要求接替；`amends` 表示旧要求被明确修改为新要求。
3. 解析优先使用任务绑定范围中的状态声明；否则只允许唯一、相邻且类型一致的指称解析。多候选或证据不足必须返回 unresolved，不得猜测。
4. 旧任务保留在建议中供审计，但语义必须为 `past + cancelled + superseded`，且永不默认勾选；新任务独立按当前义务与安全规则判断。
5. 模型的 semantics、effect、revisionRefs、requiresAction 和 selected 继续无权威；P3 输出必须可由 index、缩减锚点和本机规则完全重算验证。

## 执行顺序与门槛

| 阶段 | 数据分类 | 固定门槛 | 失败处理 |
|---|---|---|---|
| P3 定向/变形 | 新匿名夹具 | cancels/supersedes/amends、歧义失败关闭、证据绑定和篡改检测全部通过 | 仅在冻结前修实现 |
| B5 回归 | 已见 Development | 16/16 可评分；全部主指标 100%；修订整例、旧要求失效、新要求生效 100%；stale=0；Forbidden=0 | B5 仅诊断，不称泛化 |
| P3 冻结 | 代码、测试、B5 runner/result 和依赖 | SHA-256 全匹配；lint/test/build/security 通过 | 未通过不得创建 B6 |
| B6 首次门 | 全新匿名 Development | 16/16 可评分；Task F1>=90%；requiresAction>=95%；Complete>=80%；Forbidden=0；三类修订覆盖；旧要求失效=100%；新要求生效=100%；stale=0 | 运行一次即变已见；失败只审计和停止 |

## B6 数据要求

- 16 个全新匿名合成案例，source text 与 semantic family 不复用 B0-B5，逐例字符 bigram Jaccard <0.55。
- 至少 6 个修订案例，`cancels`、`supersedes`、`amends` 各至少 2 个；同时包含无替代、显式新要求、同一句改为、跨句指称、歧义失败关闭和无修订对照。
- Expected 只用于本地构造理想 scope/action/object 锚点与评分，不进入任何请求投影。
- 数据、Expected、生成器、测试、P3 和依赖必须在首次运行前冻结、提交并推送。

## 结论边界

B6 即使通过，也只证明理想上游锚点下的本机修订与任务形成上限；不证明模型、OCR、图片/文件、真实材料、真人修改时间、浏览器或上线质量。付费模型、RCO-6 和部署仍需另行授权。
