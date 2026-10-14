# RCO-5-005-B02-M2 调用前报告

## 结论

`RUNNER FROZEN / 0 MODEL CALLS / 0 NETWORK DISPATCHES / SECRET NOT ACCESSED / READY FOR AUTHORIZED M2 RUN`

运行器、调用次数、费用上限、请求格式、提示词与严格 JSON Schema 已在真实请求前锁定。本报告不包含模型效果结论。

## 硬边界

- 模型固定为 `deepseek-v4-flash-vision-exp`，temperature 为 0，thinking 为 none。
- 12 次 facts-first、12 次命题图、最多 12 次复核，总请求不超过 36 次。
- Repair 为 0，retry 为 0；请求派发状态在联网前落盘，已经派发的逻辑单元永不重发。
- 单次请求体最多 49,152 UTF-8 bytes，单次输出最多 2,000 tokens。
- 按冻结峰值单价及 10 CNY/USD 保守折算，全轮理论最大值为 8.7360768 CNY，低于 10 CNY 硬上限。
- Expected、forbidden token 与默认选择答案只留在本地计分，不进入模型请求。
- 命题图未通过本地 Schema 时，复核器零调用跳过；失败仍保留在结果分母。
- 首次请求若未完成，整批立即停止，不换接口、不 Repair、不重试。
- 不接入稳定路径，不部署，不自动进入 RCO-6。

## 零调用验证

- B0.1 契约、B02 数据/冻结和新运行器定向测试：59/59 PASS。
- 新运行器自身测试：7/7 PASS。
- lint：PASS。
- 全量工程测试：Vitest 464 passed / 1 live OCR skipped；server 8/8、Worker 25/25、time parity 1/1、multimodal evaluator 23/23、Functions 5/5。
- build：PASS；保留既有大于 500 kB chunk warning。
- security scan：356 files PASS。
- `npm audit --audit-level=high`：0 vulnerabilities。
- 模型调用：0；网络 dispatch：0；Secret 访问：NONE。

## 冻结对象

- Run ID：`rco-5-005-b02-m2-20260903a`
- 数据、Expected、既有 freeze、plan、tracker、validator、contract library 均保持原字节哈希。
- 联网前冻结清单：`RCO-5-005-B02_M2_RUN_FREEZE.json`。

下一动作只允许以冻结 Run ID 和授权 ID 启动一次 M2；结果无论好坏都按原样保留。
