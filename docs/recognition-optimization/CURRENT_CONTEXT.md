# MAINLINE-REAL-INPUT-01 当前交接

## 当前结论
- 本轮比较 deepseek-flash 的 reasoning none 与 low。
- candidate03、wire、正文、时区和评价口径固定。
- 实际完成 12 份、两臂 24/24 次有效返回。
- none 明显少错、少改、更快、更便宜；结论 KEEP_NONE。
- 剩余 8 份、16 次因累计 290 次硬上限而 NOT_RUN。

## 仓库
- 仓库：C:\Users\Winner\student-affairs-multimodal-exp。
- 分支：codex/e2-multimodal-recognition-exp。
- 本轮起点：934fb9e3afdd02c233f58e0831b1ce1dcf15b9df。
- 用户给出的 129dd1 是较早快照，未回切。
- 本轮业务提交：待提交后写入 DELIVERY.json。

## 固定设计
- 20 份已见完整匿名通知原样复用。
- 优先前四份：W01、W11、W04、W12。
- 两臂均为 deepseek-flash + candidate03；A none，B low。
- 两臂 max_output_tokens=16384，stream=false。
- verifier、Repair、传输 retry 均为 0。
- low 为思考模式，temperature=0 按官方规则不生效。
- 参考答案只用于评价，不进入请求。

## 截断响应用量
- Y01-B 的身份、模型、截断原因和 usage 已在旧追加事件中核验。
- Y01-B 费用上界 ¥0.075140 已结算，但回答保持 incomplete。
- Y01-B 不评分、不回放、不形成可确认任务。
- A01 未知 ¥3.30 预留永久保持，本轮没有解除。

## 质量结果
- none 无需实质纠正 10/12，low 为 5/12。
- none 实质事实错误 4 个，low 为 11 个。
- none 最少用户纠正操作 3 次，low 为 11 次。
- low 修掉 W11 的多余任务，并把条件恢复为 unknown。
- low 在 W11 仍多造材料和时间，在更多通知新增假时间或材料错误。
- W01/W04/W05/W08/W09 两臂均无需实质纠正。
- W12 两臂都需纠正，low 没有净收益。
- 严格 completeCase 两臂均为 0/12，业务裁决单独保留。
- low 不采用，6632 不切换路线。

## 正确任务口径
- 12 份参考事实共有 19 个任务事实。
- 当前可确认的正确任务为 13 个。
- 另有取消或替代 3 个、condition=false 1 个、condition=unknown 2 个。
- 既有 candidate03 工程回放曾在 10 个来源正确保存 12 个任务。
- 该数字是工程回放，不是本轮真实浏览器或真人转化率。

## 等待、用量与费用
- none：输入 55,555，输出 19,580，reasoning 0。
- low：输入 55,855，输出 109,691，reasoning 91,344。
- none 中位 7.790 秒、P95 8.918 秒。
- low 中位 43.190 秒、P95 53.336 秒。
- low 中位约慢 5.544 倍，P95 约慢 5.981 倍。
- none 费用上界 ¥0.267750，low 为 ¥0.989238。
- low 费用上界约为 none 的 3.695 倍。
- 本批 24 次费用上界合计 ¥1.256988。
- 服务商实际扣费 NOT_OBSERVABLE。

## 账本
- 账本现有 290 次请求、595 行，最后 sequence=594/L12-B。
- settled 288、settledIncomplete 1、heldUnknown 1。
- 已结算费用上界 ¥10.363183。
- 加 A01 未知预留后的保守总上界 ¥13.663183，低于 ¥20 上限。
- 账本 SHA256：acd7a263be10887b5727b695faaaa8970cba4c57fd253df33a80116dcf42d0e5。
- 最后一行 hash：622b837675c52de02dcef78102e022e40c8a974a5973c75f1a2febca181c5f3f。

## 工程接入
- none/low 16K 通过显式新实验策略接入，旧配置未放宽。
- reasoning 项与最终 message 分离，仅完整最终答案生成建议。
- reasoning tokens 已包含在 output usage，不重复计费。
- 截断回答可在身份和 usage 可信时结算，但始终不可保存。
- candidate03、modelWire、全局 Schema 和正式仓储均未修改。

## 产品与浏览器
- 官方控制只尝试一次，21.910 秒后 nodeRepl.fetch request failed。
- 本轮页面确认、刷新、独立读库和两个实际下载均 NOT_RUN。
- 本轮实际新保存正式任务 0。
- 历史 Q01/Q07、U11 页面和下载证据仅作历史证据。
- 6632、公开产物和生产入口均未修改。

## 工程检查
- 预算/网关测试最终 124/124 通过。
- Node 语法、类型、lint 通过；4 个既有警告保留。
- 禁根 .env 的临时 Vite 构建通过。
- Vitest 初次 1381 通过、1 失败、1 跳过。
- 唯一失败为缺少外部匿名 carriers 清单；定向复跑 1/1 通过。
- server 8、Worker 25、时间/评价 24、Functions 5 项通过。
- 安全扫描 2317 个文件通过。
- 旧 RCO-5-007 仍为 package-lock 历史 SHA 不匹配。
- package-lock 本轮无 diff，旧断言未修改。

## 证据入口
- 主报告：reasoning-low16-compare-20260914a/AUDIT.md。
- 逐例裁决：BUSINESS_ADJUDICATION.json。
- 派生结果：FIRST12_DERIVED.json。
- 原始回答：L01 至 L12 的 A/B_RAW.jsonl。
- 浏览器：BROWSER.json。
- 检查与 SHA：CHECKS.json、IMPLEMENTATION_SNAPSHOT.json。

## 下一动作
- 精确提交并推送本轮业务实现和证据。
- 写入 DELIVERY.json 并核对远端 SHA。
- 完成本轮后停止，不继续剩余 8 份或追加请求。
- 保留 none + candidate03；不创建 candidate10。
- 下一次若继续优化，优先处理假时间而不是提高思考强度。
