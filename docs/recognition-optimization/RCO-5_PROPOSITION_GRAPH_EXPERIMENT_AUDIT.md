# RCO-5-004 完整命题图实验审计

## 最终结论

`FAIL / REJECT_CANDIDATE / RCO-G5 QUALITY NOT_RUN / RCO-6 BLOCKED / NO_PROMOTION / DO_NOT_LAUNCH`

本轮按授权完成了隔离 Schema、composer、匿名属性变形和五轮新鲜对抗审查，业务模型调用为 0。候选没有接入 Worker、浏览器录入、稳定模型或部署路径。

## 五轮结果

| 轮次 | 登记测试 | 新鲜审查结果 | 决定性问题 |
|---|---:|---|---|
| V1 | 49/49 | FAIL | “上传 API Key”被勾选；重复旧命题绕过取消关系 |
| V2 | 56/56 | FAIL | 零宽字符绕过；敏感材料经关系搭便车 |
| V3 | 59/59 | FAIL | “Access Token 文件”利用对象白名单绕过 |
| V4 | 62/62 | FAIL | 外传动作藏在 object 中，verb-only 门失效 |
| V5 | 69/69 | FAIL | “请完成报名材料邮寄。”利用词表未包含“邮寄”而被误勾选 |

第五轮的实际失败是：动作被拆成 `verb=完成`、`object=报名材料邮寄`、`effect=local_change`，候选校验通过，composer 生成了默认勾选建议。这个反例没有出现在已登记的 69 个测试里。

## 第一性原理解释

默认勾选的本质要求不是“句子里有没有某个危险词”，而是必须证明该动作不会把信息、材料或权限向外传递。完整命题图和 `action.effect` 把问题放到了正确层级，但当前代码仍靠有限词表给 `effect` 做一致性判断。自然语言的同义表达没有封闭边界；补上“邮寄”后还会有新的词表外表达，所以继续加词不是根治。

可信独立语义/安全验证器当前为 `NOT_CONNECTED`。在这一基础事实无法被可信验证的情况下，安全策略必须失败关闭，候选不得晋级。

## 工程与完整性证据

- 定向测试 69/69；全量 Vitest 464 passed，1 个 live OCR 按策略 skipped；server 8、Worker 25、time parity 1、multimodal evaluator 23、Functions 5 全部通过；安全扫描覆盖 327 个源码/构建文件。
- lint、typecheck、build、Schema/time drift、安全扫描与三环境 Cloudflare dry-run 通过；`npm audit --audit-level=high` 为 0 vulnerabilities；未部署。
- 受保护输入 10/10 SHA-256 匹配，保护路径无 Git diff；Expected、既有 freeze、dataset、checkpoint、cache 未改。
- 以上绿灯证明工程没有明显回归，不推翻新鲜审查复现的语义安全缺口。

## 下一步边界

本轮授权已关闭，B1 和 RCO-6 均不运行。若用户另行授权，应先建立可验证身份、绑定整份原文和完整候选图、缺失时失败关闭的独立语义/安全验证器；或者规定只有来自词表之外的确定性结构证据足以证明动作效果时才能默认勾选。该基础门重新通过后，才讨论 12×2 的付费 B1 配对。
