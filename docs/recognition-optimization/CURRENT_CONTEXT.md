# MAINLINE-REAL-INPUT-01 当前交接

## 当前结论
- 固定candidate03与可靠wire，只比较了模型身份。
- A臂deepseek-flash继续作为可靠基线。
- B臂deepseek-v4-pro结论为DO_NOT_ADOPT_PRO。
- 不创建candidate10，不改Prompt、wire、Expected或评分器。

## 仓库
- 仓库：C:\Users\Winner\student-affairs-multimodal-exp。
- 分支：codex/e2-multimodal-recognition-exp。
- 本轮起点：95ffc393b5a10e6443bbb77413cc1195ad7822e4。
- 业务提交：6a8b459ece9e6cc551a6bd9d07fa042ab4a9ef98。
- 远端同分支已核对为同一业务SHA。

## 比较设计
- 复用candidate09批次的20份完整匿名通知。
- 原12份与后8份分别报告，全部属于已见材料开发回归。
- 每份两臂各一次，共40次正式请求。
- 两臂正文、来源索引、参考时刻、时区、Prompt和wire一致。
- 唯一变量是deepseek-flash与deepseek-v4-pro。
- 参考答案仅评分，不进入模型请求或产品决策。

## 请求结果
- 40/40 HTTP 200，两臂各20次。
- 实际返回身份与请求模型逐次一致，没有路由成同一模型。
- temperature=0，reasoning.effort=none，stream=false。
- max_output_tokens=8192，verifier/Repair/retry均为0。
- 原账本追加后507行、最后sequence=506。
- 本批40份batchSettle齐全，历史调用不删除。

## 业务结果
- Flash无需实质纠正：17/20。
- Pro无需实质纠正：15/20。
- Flash实质错误：6个。
- Pro实质错误：10个。
- Flash结构核对阻断来源：1份。
- Pro结构核对阻断来源：6份。
- 原12份：Flash 9/12，Pro 8/12无需实质纠正。
- 后8份：Flash 8/8，Pro 7/8无需实质纠正。

## Pro的有限收益
- W11把未知条件从错误true修正为unknown。
- X07少拆授权编号、校对人姓名两个辅助材料核对项。
- 这些收益不足以抵消新增退化。

## Pro的主要退化
- W02遗漏“近期”和“具体完成日期另行通知”两个时间依据。
- X05把“出示工作证”多拆成独立任务并错归工作证材料。
- W11仍多造密封袋任务，并额外多造“检测样本”材料。
- W01/W02/W04/W06/X03/X05出现结构核对阻断。
- W12的无依据依赖和纯取消误写替代仍未改善。

## 等待与费用
- Flash总等待141409ms，中位7671ms，P95 9128ms。
- Pro总等待363167ms，中位17008ms，P95 25417ms。
- 本批Flash峰值价格上界0.431170元。
- 本批Pro峰值价格上界1.825677元。
- 本批合计峰值价格上界2.256847元。
- 累计248次，含A01未知预留的费用上界10.559813元。
- 服务商实扣NOT_OBSERVABLE，不以价格上界冒充实扣。
- A01未知3.30元预留和20元项目上限保持。

## 保存转化
- Pro未接入6632，避免将退化结果写入隔离库。
- 可靠Flash历史回答的零调用工程回放仍为20条正确保存。
- 20条分布于16份来源，意外程序阻碍0。
- 这不是本轮真人转化率，也不是浏览器新保存结果。

## 浏览器与6632
- 官方浏览器控制本轮只尝试一次。
- 23.276秒后返回nodeRepl.fetch request failed。
- 当前两条新浏览器旅程、刷新读回和新下载均NOT_RUN。
- 6632当前源码服务已重新启动，HTTP 200。
- 6632模型接口关闭，构建未读取根.env。
- 历史Q01/Q07三任务刷新找回证据继续复用。
- 历史U11双下载一致证据只证明当时一项任务。

## 下一主线
- 保持Flash+candidate03，不扩大Pro流量。
- 最大剩余问题仍是复合通知的事实角色与归属。
- 重点是独立动作、材料说明、未知条件、纯取消和替代对象。
- 下一次先用W11/W12/X05类最小门槛筛模型，再决定是否付费比较。
- 不再靠模型名称、价格或更长Prompt推断质量。

## 证据入口
- 主报告：model-compare-20260914a/AUDIT.md。
- 逐例比较：model-compare-20260914a/COMPARISON.json。
- 原始响应与结果：model-compare-20260914a/*_RAW.jsonl及*_RESULT.json。
- 浏览器边界：model-compare-20260914a/BROWSER.json。
- 最终检查、快照与Git：本run对应JSON及最终交付答复。

## 最终工程检查
- 预算与网关定向测试118/118通过。
- Vitest 1382项通过、1项按原配置跳过。
- 服务端8项、Worker25项、评估库23项、函数5项通过。
- lint为0错误、4个旧警告；typecheck、build和secret scan通过。
- npm全链最后仅旧RCO-5-007冻结检查失败。
- 失败原因为package-lock历史SHA与当前HEAD不一致；本轮未改锁文件。
- 旧冻结断言按授权保留，没有回切、删除或弱化。
- 独立实验审计为PASS_WITH_DISCLOSED_LIMITATIONS，本轮blocker为0。
- 审计独立重算请求、响应身份、账本链、费用和采用结论一致。
- 业务提交和远端均为6a8b459ece9e6cc551a6bd9d07fa042ab4a9ef98。
- 交付回执另写入本run的DELIVERY.json。
