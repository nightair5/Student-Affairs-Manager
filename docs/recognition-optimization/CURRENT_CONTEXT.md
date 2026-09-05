# RCO Current Context

供压缩恢复使用；以代码、冻结证据和追加日志为准。

## 当前目标与授权

- 目标：提升文字/图片/文件到待确认任务的正确率及确认效率。模型不能直接创建正式任务。
- 当前：`RCO-5-010-E1 LOCAL_VERIFIED_AND_FROZEN / DELIVERY_STATUS_SEE_GIT / NO_PRODUCT_PROMOTION`。
- 用户在 E1 审查失败后明确“继续执行”；仅恢复本轮零调用修补、对抗审查、通过后全量验证、组件冻结和提交推送。
- 模型接口/联网模型请求/verifier/Repair/retry/Secret/费用：`0/0/0/0/0/NONE/0 CNY`。
- 禁止修改既有 Expected/freeze/dataset/checkpoint/cache、旧 B9 runner 和结果；禁止创建 B10、接稳定路径、启动 RCO-6 或部署。

## 工作区

- repository: `C:\Users\Winner\student-affairs-multimodal-exp`
- branch: `codex/e2-multimodal-recognition-exp`
- 恢复时 HEAD/upstream：`c67e59ee14c04c6e15cc003ef06da2c157e92f47`。
- 本阶段交付提交消息：`fix(app): verify source and proposition scope before safe selection`；实际提交和upstream状态以Git为准。受保护tracked文件无修改。
- RC.4、Release、Production 和默认“本机 OCR/解析后只发送文字”路径未接本轮组件。

## 当前实现与证据

- 对象键顺序无关的结构比较；拒绝 sparse/undefined/非有限值。
- 完整命题裁决、三值行动性与 selected 分离。
- E1 移除有限词内“请”黑名单，使用动作位置和受控称谓/时间/方式正向证明，逐出现位置回溯 governor。
- 续修：完整句子的问句或冒号外层语境、名词化与命令竞争均保持未知；从原文重建 scope/catalog，异步前快照，拒绝候选/对象篡改。
- 当前定向：6 文件 122/122；独立无上下文机制复核 PASS（同系列）。全量899 passed/1 live OCR skipped，lint/type/build/security PASS，npm audit 0漏洞。
- B9/009/009A保护检查19/19，B9当前额外默认勾选/内部违规均0。代码测试后只补了安全断言并通过3/3、类型/lint检查。
- 报告：`RCO-5-010_CLOSE_REPORT.md`，机器记录：`RCO-5-010_CLOSE_CHECKS.json`，审查：`RCO-5-010_E1_AUDIT.md`。
- 这是受控规则组件，不是完整中文解析器；冒号后真实转述命令和歧义句式可能保守待确认。

## B9 历史

- 原 B9 唯一零调用结果 `FAIL`，12 案例；本轮不运行旧 runner。
- `rco-5-010-seen-b9-replay/result.json` 是此前已见诊断产物，不覆盖，不称为本轮新盲测。
- 当前已见回归 requiresAction 11/12；B9-07 false/null 分歧保留，B9-12 不是独立语义真值。
- 计数键顺序假失败已解释；工程 PASS 不能说成 B9 PASS 或模型正确率。
- 历史证据：`RCO-5-009-B9_DATA_FREEZE.json`、`RCO-5-009-B9_ZERO_CALL_RESULT_FREEZE.json`。

## 下一动作

1. `RCO-5-010_COMPONENT_FREEZE.json` 已建立，25路径哈希匹配，新旧冻结检查20/20。
2. 恢复时核对本阶段交付提交与upstream；已交付则停止，不重复实现或运行历史runner。提交SHA不递归写入冻结文件。
3. 不自动创建B10，不调用模型，不进入RCO-6或部署；后续产品验证需要另行明确范围。

## 证据边界

不能据本机回归声称模型泛化、OCR/图片/文件识别、真人修改时间、浏览器验收或商业上线。详细历史见 OPTIMIZATION_LOG.md；恢复时不重复加载所有报告。
