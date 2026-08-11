# P5 Path A Prompt Candidate RC1

状态：`CANDIDATE_NOT_YET_EVALUATED`。

## 固定条件

- 模型：`deepseek-v4-flash`
- Schema：`RecognitionResult 2.0`
- 单次 Recognition：保持
- ModelGateway、temperature、max tokens：保持
- Workspace v8、Repository、Migration、DomainCommitPlan：不变
- Router、Validator、Repair：本轮不修改
- 部署范围：仅独立 Cloudflare Preview；不得部署 Production

## 唯一改动

Prompt 从 `recognition-2.4.1` 更新为 `recognition-2.5.0-rc.1`，新增一个原则化 `planning-contract` 模块。它不包含 caseId、完整固定句子或样例补丁，只规定：

1. 建立明确义务覆盖表并保持原始行动谓词；
2. Task、Material、TimePoint、Event、Ambiguity 各自承担单一职责；
3. 并列材料按同一谓词聚合，不按材料数量机械拆分；
4. 只有独立截止、渠道、条件、依赖或完成状态才拆 Task；
5. TimePoint 按实际业务角色分类，不统一降为 `task_deadline`；
6. 适用范围、条件、模态和不确定性不得静默删除；
7. Milestone 只表示真实业务阶段；
8. 输出前反查关键实体、引用与逐字 Evidence。

## 预注册判断

RC1 的主要目标是改善 Task Recall、TimePoint Type Accuracy、Ambiguity Recall 与 User-impact Major，同时保持 Task Precision、Evidence Coverage 和 Severe Error。所有 108 条 Generalization Development 输入生成完成后才统一读取 expected 评分；失败结果完整保留。若 RC1 不产生足够净收益，最多还允许一轮新的原则性候选；不得无限追加规则。
