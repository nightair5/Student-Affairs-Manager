# RCO-5-005-B0.2 数据冻结报告

## 结论

`DATA_AND_PLAN_FROZEN / 13 OF 13 DATA-FREEZE TESTS PASS / ZERO MODEL CALLS / PAID RUN NOT AUTHORIZED`

已新建并锁定 12 个此前未交给 DeepSeek 的匿名合成 Development 案例。12 个原文和 12 个语义家族都不复用 B0；参考答案在模型调用前写定并以 SHA-256 绑定。

## 数据构成

- 12 个案例，10 个预期当前任务。
- 4 个无需行动的陷阱案例。
- 9 个安全默认项，1 个明确需要识别但不得默认勾选的对外联系项。
- 覆盖改期、作废引用、条件未触发、事件存在但无需行动、机构截止时间误绑、多任务不同截止时间、可选与必做并存、完成态与当前动作等问题。
- 数据和参考答案由 Codex 单一作者生成并复核，不是独立人工 ground truth、真实材料或 Holdout。

## 完整性检查

- 数据身份、数量和字段：PASS。
- case ID、语义家族、原文唯一：PASS。
- 与 B0 原文和语义家族不重复：PASS。
- 动作、对象、时间、材料、事件、地点参考答案可在原文中找到：PASS。
- obvious identifier / credential pattern：未发现。
- Expected 和安全答案进入模型请求：0。
- B0 dataset/freeze/checkpoint/result 字节哈希：保持不变。
- 数据、计划、跟踪表、校验器、B0.1 契约组件哈希：全部匹配冻结清单。
- B0.1 契约/对抗测试：39/39 PASS。
- 全量工程测试：Vitest 464 passed / 1 live OCR skipped；server 8/8、Worker 25/25、time parity 1/1、multimodal evaluator 23/23、Functions 5/5。
- lint、build、security scan（353 files）和 `npm audit --audit-level=high`（0 vulnerabilities）：PASS；仅保留既有大于 500 kB chunk warning。

## 已锁定文件

- 数据：`RCO-5-005-B02_DEVELOPMENT_DATASET.json`
- 计划：`RCO-5-005-B02_PLAN.md`
- 执行跟踪：`RCO-5-005-B02_TRACKER.md`
- 冻结清单：`RCO-5-005-B02_FREEZE.json`
- 数据/冻结校验：`scripts/rco-5-005-b02-*.node-test.mjs`

## 下一道门

真实测试仍需单独批准：`deepseek-v4-flash-vision-exp`、最多 36 次调用、temperature 0、Repair 0、人民币硬上限 10 元。批准后才创建并二次冻结联网运行器，然后读取服务端/进程 Secret 发起调用。

本报告不支持任何模型正确率、真实材料泛化、真人修改时间、浏览器验收或上线结论。
