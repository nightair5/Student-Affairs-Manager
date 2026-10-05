# 当前Candidate19真实首次输出诊断

2026-10-05。本轮只建立最小4来源单臂诊断的具体冻结与普通回放接入；尚无新模型许可，不运行付费步骤。不是新候选、不重建安全执行器、不用手写wire填充首答。

从已有6份官方文字节选选择FRESH-02/04/05/06：大学新生预注册窗口、暑假离留校登记、线上暑期学校、讲座报名和活动时间。FRESH-01为2021历史维护，只留时基控制；FRESH-07面向中学生，只留条件/24点边界控制。4份均已参与本地Development，但从未取得模型输出，不叫Holdout；不声称覆盖整页、未读海报/二维码或全部学生身份。明确未公布、完整取消新来源及普通作业通知仍是范围限制，不临时扩大样本。

`current-notice-reference.mjs`从原文建立任务、事件、起止、材料/渠道、办结、条件及修订最小检查，另要求裁决依据、标题/描述/额外事实/关系。原referenceTime和Asia/Shanghai不按回放日重解释。日期窗口允许无损表示；“日前”保留date_only与原文，不补日终；兴趣/个人资格未提供不默认true。未读内容、旧修订端点及争议不猜补。

`prepare-current-notice-diagnostic.mjs`复用原Candidate19生成组件与公共图：时间2.1.0、首次组装1.1.0以及既有支持/渠道/资格/禁止/保存/安排。模型请求只有源文、原时基与原C19契约，没有Expected或参照。4个新identity/requestSha及来源/参照/评分/首屏依赖图在输出前冻结；NOT_RUN/dispatchAuthorized=false保持在冻结包。旧C19、v11及历史参照/raw/成绩不动。

`current-notice-execution-host.mjs`仅绑定新批名、4身份与独立.data目录，复用scoped-execution-core/host、跨进程锁、原子状态、逐单元reserve/settle及阶段诊断。没有授权原件时CLI在读取包、创建执行目录或访问发送配置前拒绝。相同US$1.30数字不等于旧批许可：旧batch、身份、顺序、requestSha、Manifest、同步HEAD或预算漂移均拒绝。未调用prepare/dispatch，未创建AUTHORIZATION、grant或执行STATE。

`current-notice-recorded-readonly.mjs`只接受一致且无halt/lock/unknown的确定录制，逐字核raw和请求SHA。`serve-candidate19-recorded.mjs --current-notice-batch`复用普通App→ReviewSession→DomainCommitPlan→Repository及D27；新批不混入旧12或旧封存录制。0录制时仅显示待授权状态，不加载普通编辑器、不打开数据库、不制造首次建议。真实录制可用后同一模式、新实例加载既有普通产品保存链；旧6851或其数据库不动。

`report-current-notice-diagnostic.mjs`复用public-source-fact-adjudication-1.0.0，分原答事实、转换后人工前首屏、人改后最终三层；固定分母4。缺裁决/标题自由描述未裁决/重复/争议为UNKNOWN，任何真错误使整份不正确，不能以保存成功或字段总分抵消风险。原文及输出pointer须逐项可查，参照仅single-author/model-assisted/provisional。没有真实输出时不复制一套空裁决表。

## 运行和条件接续

```text
node scripts/prepare-current-notice-diagnostic.mjs --verify
node scripts/current-notice-execution-host.mjs --verify
node scripts/current-notice-execution-host.mjs --resume-read-only
node scripts/report-current-notice-diagnostic.mjs
node scripts/serve-candidate19-recorded.mjs <新端口> <全新实例> --current-notice-batch
```

新具体授权后才在本机.data放实际用户原文、AUTHORIZATION、PRICE_EVIDENCE。首次grant前重核官方核价有效窗、当前同步HEAD/完整账本及4原冻结身份；只能建一个本批新grant。严格ordinal，每身份最多一次；零retry/repair/verifier，发送/计费/raw/settle不确定即封存停发。原公开封存批仍1SETTLED/1UNCERTAIN/2NOT_SENT，不恢复或补settle。

取得确定录制后逐来源追原文→raw→Schema→转换→首屏→保存/安排，最多修2真实根因/1输入假设。新raw必须在新的隔离库实际验首屏、部分确认、坏关系局部阻断、事务失败手动恢复、已提交只重读、刷新与独立数量/值/精度/依据/owner。尚无新raw，因此这些本批模型回放验收是NOT_RUN。底座不变的既有浏览器证据可复用，但不能替代本批首答验收。若必须改冻结组件，保留原提交隔离快照，不重写原Manifest或旧请求。

## 有限独立复核

本轮无参照自动推断算法或新执行器。完成一次独立于生产调用的检查：原文字面值/出处先验参照；构建真实C19请求检查无参照泄漏；三层报告错误/缺失反例；临时目录CLI缺授权及authority字节不变；新批4身份拒旧批授权与身份移位；现有once-send、缺usage、诊断失败、锁和重复派发离线测试。离线fake授权/transport仅临时目录，绝不是用户授权或真实付费。
