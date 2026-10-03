# D26首次准确率比较接续结果

2026-10-03。状态：**D26_EXECUTION_ENGINEERING_DELIVERED_WAITING_FOR_BATCH_AUTHORIZATION**。

用户现在仍可使用D27普通来源核对和最小安排。本轮把原冻结C17/C18的真实执行宿主与只读比较报告交付并推送，解除此前Git同步阻碍。没有本批新付费授权，16个请求全部未运行，不能宣称首次正确率已提高。

## 首次到底准了多少

| 阶段 | Candidate17 | Candidate18 | 覆盖边界 |
|---|---|---|---|
| 模型原始首答 | 0/8已观察；8未知；正确率NOT_OBSERVABLE | 0/8已观察；8未知；正确率NOT_OBSERVABLE | 将按原冻结解析/公共adapter评分；不冒充独立人工raw评审 |
| 转换后、人工前首次展示 | 0/8已观察；8未知；正确率NOT_OBSERVABLE | 0/8已观察；8未知；正确率NOT_OBSERVABLE | 原v10自动开发契约，参照provisional |
| 人工最终处置 | NOT_OBSERVABLE | NOT_OBSERVABLE | 本轮没有真人试次或裁决 |

这里的0表示**已观察数量为0**，不表示正确率0%。改善/退步/持平均还没有新数据；8个配对来源保留UNKNOWN。[固定16单元报告](evidence/COMPARISON_REPORT.json)提供每份request/identity SHA、状态和分母。标题/自由描述/教学例泄漏未经真实人工复核的部分单列NOT_ADJUDICATED。

D17原v7 C03 1/12、C17 2/12及MIXED_PROGRESS保持。D19旧输出诊断仍为事后诊断。C18本地机制包含候选wire与关系转换，未来只能先判断整包效果，不能单凭整包比較把收益归于Prompt。没有Candidate19或新24身份。

## 本轮实际交付

1. 原4699d5c快照隔离加载，核原145组件、7产物和16冻结请求，不回滚D27当前产品。
2. 已接通受保护真实transport/权威账本/跨进程锁；冻结顺序、一个grant、每单元最多一次发送、raw/usage/settle、封存和只读恢复均有离线故障证据。缺授权时真实CLI机械拒绝，0付费动作。
3. 完成只读完整结果报告；无STATE但有账本或孤立文件不会被误报没发送，部分/不确定不判赢家，固定分母保留。原答/转换后首次展示/真人结果分开。
4. 只读核13个相关Cloudflare Worker Builds无Git绑定，CI无发布步骤，此前5个本地提交已补推；新工具代码4555375788b006506abeae6107de5902ac95ad80已提交并立即普通推送。结果文档另边界提交，最终本地/upstream/远端SHA以Git现场为准。

[实现及命令](IMPLEMENTATION.md)、[48项工具回归与边界](VALIDATION.md)、[绑定核验](CLOUDFLARE_BINDING_EVIDENCE.json)。本轮未改产品运行时，保留D27[普通页/保存/安排/独立读回证据](../d27-planning/BROWSER_EVIDENCE.md)。新输出回放NOT_RUN，不能用旧页面或单测冒充新模型产品效果。

## 调用、费用和保护

实际发送0；确定响应并结算0；不确定0；NOT_RUN16。本批grant/reserve/settle0。真实usage无新观测，内部结算0；供应商实扣NOT_OBSERVABLE。

当前官方核价证明保守上界US$5.190464，建议申请硬上限US$5.30。[具体授权卡](BUDGET_AND_AUTHORIZATION.md)与[官方证据](PRICING_EVIDENCE.json)已列请求SHA、模型、次数、失败上界及有效窗。实际grant前仍重核；历史费用和旧许可不沿用。

84历史保护、119冻结、7归档原样；账本938行/SHA e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9前后不变。旧98行合法追加提示如实保留。本轮工具48PASS、lint/scan通过；D27四个历史全量失败和5high/2moderate历史audit观测单列，未写全量PASS。

首次整份建议正确、最终正确处置、低修改正确处置和主动修改时间四项真人指标均NOT_OBSERVABLE。D27ENGINEERING_REPLAY计量和安排证据继续复用，不证明真人省时。

## 后续只保留三个动作

1. 用户给出本批16请求、deepseek-flash、美元硬上限的明确许可。原身份和安全宿主已具备，直接执行与评分，无需新准备阶段。
2. 依据同批原回答和首次展示，最多选择3个实际根因。优先查无任务事件/时间、条件/前置/可开始、时间与实体关系；没有新回答前不虚构收益或新增修复。
3. 新录制进入现有产品，验证首次展示→必要确认/修改→原子保存→独立读回→安排影响，再按具体假设补代表性覆盖。真人体验可独立获范围授权后并行，不作为当前识别工程总门。

本轮没有真人、Holdout、默认替换、合并或部署。唯一产品入口继续为 http://127.0.0.1:6792/ ，D27原匿名工程构建与数据库；没有另开演示保存链或触碰旧入口/用户库。
