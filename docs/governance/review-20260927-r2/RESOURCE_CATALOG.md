# 与本项目有关的外部资源及采用决定

检索日期：2026-09-27。范围：官方 GitHub、项目文档与原始论文。筛选了 20 项，覆盖相似产品、信息提取、评测、标注、文件读取、交互与浏览器验证；这是有范围的资源检索，不声称穷尽全网。本轮没有安装、克隆或运行这些外部项目，也没有实测它们在本项目的准确率。

取舍原则：先看能修掉哪类已知错误，再看接入成本、数据流、许可和可验证收益。下面的优先级与适配建议是本次分析判断。代码许可不自动覆盖模型权重、数据集、商标或托管服务；实际引入时固定版本并复核对应条款。

## 1. 优先借鉴的方法

| 资源与一手来源 | 可用做法 | 本项目怎样用 | 许可/成本与采用决定 |
|---|---|---|---|
| 1. [Google LangExtract](https://github.com/google/langextract) | 结构化提取与原文位置关联、可视核对 | 复用现有 scope/evidence，让每个关键字段可点回原文，减少搜索原文的时间 | Apache-2.0；Python 工具。先借鉴证据结构与核对方式，不迁移现有 TS 栈；多轮提取会增加调用，另评估 |
| 2. [CheckList 原论文](https://aclanthology.org/2020.acl-main.442/) | 按语言能力设计最小、保持含义和改变含义的测试 | 否定、条件、取消、替代、时间、材料、依赖逐类建立正反例；合法别名不扣分，关键变错必须扣分 | 先采用研究方法，用现有 Vitest/Node 实现，不需要引入其 Python 工具 |
| 3. [fast-check](https://github.com/dubzzz/fast-check) | TS/JS 属性测试、固定种子及缩小失败例 | 对 type、时区、精度、对象等逐字段变异，系统检验“错时间仍满分” | MIT；当前先做确定性变异矩阵，不新增依赖。矩阵不足再评估安装 |
| 4. [promptfoo](https://github.com/promptfoo/promptfoo) | 候选矩阵、断言和差异浏览 | 如需界面，离线读录制输出帮助查差异；权威评分和结算仍走本项目版本化链路 | MIT；可选工具，不替换一次发送执行器，不启用额外 LLM grader、重试或云端分享 |
| 5. [Microsoft HAX / 人机交互指南](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) | 系统化考虑 AI 能力说明、交互失败与恢复场景 | 检查不确定提示、依据定位、局部修改和失败继续；把“更好用”拆成可观察动作 | 研究/设计资源，按公开页面使用；不是识别模型、代码库或效果保证 |
| 6. [Playwright](https://github.com/microsoft/playwright) 与 [测试建议](https://playwright.dev/docs/best-practices) | 浏览器隔离、面向用户行为的定位和验收 | 在独立入口验证编辑→部分确认→提交→独立读回→刷新恢复，用匿名数据留证 | Apache-2.0；新增依赖/浏览器下载需另评估，本轮只采纳测试设计。不是绕过当前工具故障的隐式安装授权 |

LangExtract 的价值在于“输出与来源绑定”，但字符位置正确不代表意思正确；现有不可变 scope 索引和公共校验仍应保留，不接受模型随意编造偏移。[项目说明](https://github.com/google/langextract)

promptfoo 可以对录制输出运行断言，适合离线对照；其重试错误命令会重新运行失败案例，不符合当前批次零重试与保留首次失败的规则。配置还能执行自定义代码，所以外部配置不能当安全数据直接执行。[录制输出](https://github.com/promptfoo/promptfoo/blob/main/site/docs/configuration/expected-outputs/index.md)、[命令行](https://github.com/promptfoo/promptfoo/blob/main/site/docs/usage/command-line.md)、[安全说明](https://github.com/promptfoo/promptfoo/blob/main/SECURITY.md)

浏览器验收宜按使用者可见行为编写，并给每个测试独立状态；trace 可帮助查操作与页面状态，但只能记录匿名工程资料。自动化操作耗时不能用于真人主动修改时间。[Playwright 官方建议](https://playwright.dev/docs/best-practices)、[Trace Viewer](https://playwright.dev/docs/trace-viewer)

## 2. 独立标注：选一个工具，不等于已经有人工真值

| 资源 | 适合用途 | 本项目约束与决定 |
|---|---|---|
| 7. [Label Studio](https://github.com/HumanSignal/label-studio) | 文本及多模态标注、片段定位、可配置界面；Apache-2.0 | 较丰富的标注候选；必须先验证本项目任务/关系导出格式。社区版不能默认承担 A/B 盲审隔离 |
| 8. [Doccano](https://github.com/doccano/doccano) | 文本分类、序列和序列到序列标注；MIT | 若只做文本片段标签可评估更轻的方案；复杂完成标准、拆合与修订关系先做导出样例验证 |

Label Studio 社区版用户可看到所有项目，不能仅建两个项目就宣称人工 A 与 B 互盲；部分角色与复核能力属于企业版。可先使用两份独立来源包或独立实例，再汇合裁决。标注者只见原文和口径，不导入 Candidate 输出或教学答案；两人实际署名与冲突裁决仍由真实人员完成。[社区用户权限](https://labelstud.io/guide/signup)、[企业版能力](https://labelstud.io/guide/enterprise_features)

最小可行方案仍是项目已有空白模板；只有模板确实成为多人协作瓶颈时才部署标注平台。安装工具本身不会增加独立性，也不会解决含糊原文。

## 3. 相似产品：借鉴流程，不整体替换

| 产品 | 与本项目相似在哪里 | 借鉴与限制 |
|---|---|---|
| 9. [Super Productivity](https://github.com/super-productivity/super-productivity) | 本地任务、计划与时间管理 | MIT；借鉴快速编辑、今日优先项和暂停操作。其任务执行计时不能直接当成本项目的建议纠错计时 |
| 10. [Inbox Zero](https://github.com/elie222/inbox-zero) | 从消息到分类、规则和待处理状态 | 借鉴“信息/需要行动/等待回复”的分流。当前许可含额外商业限制，先限于产品研究，不作为可直接商业复用的普通 AGPL 库 |
| 11. [Vikunja](https://github.com/go-vikunja/vikunja) | 自托管任务及组织管理 | AGPL-3.0；借鉴已确认任务的查看与组织。当前没有必要替换 Workspace v8 或增加账号后端 |
| 12. [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | 文档摄入、OCR、分类与可检索归档 | GPL-3.0；借鉴摄入状态与来源档案。本项目不默认长期存文件本体，不直接照搬其全文档存储方案 |

Inbox Zero 的 LICENSE 在 AGPL 文本前加入软件商业变现及企业使用的额外条件；不能因为仓库公开就标为无条件可商用。这里仅记录仓库文本，实际接入前按具体版本与使用方式核验。[当前许可证原文](https://raw.githubusercontent.com/elie222/inbox-zero/main/LICENSE)

## 4. 文件与 OCR：排到语义修复之后，按错误来源决定是否引入

| 资源 | 能解决哪类读取问题 | 本项目适配与采用决定 |
|---|---|---|
| 13. [Tesseract.js](https://github.com/naptha/tesseract.js) | 浏览器/WASM OCR | 已有依赖，继续作基线；先查中文数字、日期、否定词与漏行，而不只看平均字符率。代码 Apache-2.0，语言数据另核来源；PDF 需现有解析/渲染配合 |
| 14. [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | OCR 与文档结构解析 | Apache-2.0 代码；适合后续中文图片对照。Python/Paddle 部署、模型大小和计算资源需实测，不能直接塞进当前前端 |
| 15. [Docling](https://github.com/docling-project/docling) | PDF/Office 结构、表格、阅读顺序、统一文档表示 | MIT 代码，模型许可另核；优先评估复杂文档的本地独立适配器，保留页段与提取范围。会增加 Python 运行环境，当前不安装 |
| 16. [MinerU](https://github.com/opendatalab/MinerU) | 复杂文档解析的备选 | 当前 README 声明基于 Apache-2.0 并有额外条件的专用许可；完整 LICENSE 本轮获取失败，不作可商用结论。待明确许可、硬件和本机适配后再评估 |
| 17. [OmniDocBench](https://github.com/opendatalab/OmniDocBench) | 文档解析/版式与阅读顺序评测 | 仓库 Apache-2.0，数据许可另核；借鉴分版式评测方法，公开数据不作为本产品独立未见 Holdout，也不评价通知是否拆对任务 |

Tesseract.js 当前包的代码许可与版本可从 [官方 package.json](https://raw.githubusercontent.com/naptha/tesseract.js/master/package.json) 核对。PaddleOCR、Docling、MinerU 的官方展示成绩不等于校园通知整份建议正确率；需要同一匿名来源、同一后续语义链路的实际对照才能比较。

先分清三类失败：字没读对、顺序/表格读错、字已读对但意思理解错。只有前两类占据可观的失败份额时，OCR/解析器替换才是当前优先项。文字链路尚有明确契约漏洞时盲换 OCR，无法修复错误的评分与条件判断。

## 5. 时间与结构化提取：辅助现有链路

| 资源 | 可以借鉴什么 | 使用边界 |
|---|---|---|
| 18. [Microsoft Recognizers-Text](https://github.com/microsoft/Recognizers-Text) | 中文数字、日期时间等解析规则与测试语料 | MIT；先做差异测试案例。官方 .NET 与 JS/Python 等端口能力不完全一致，不假设全中文同等支持；现有统一时间策略仍是唯一归一化入口 |
| 19. [Instructor](https://github.com/567-labs/instructor) | 类型约束、输出验证与错误呈现 | MIT；借鉴契约验证，不把合法 JSON 当语义正确。自动重试不符合当前零重试批次，不为它迁移到 Python 或增加调用 |
| 20. [DSPy](https://github.com/stanfordnlp/dspy) | 用任务指标优化模型程序/提示词 | MIT；评分可信、Development 足够后再考虑。它会围绕给定指标优化，坏评分会放大错误目标；优化调用需独立预算，不能接触正式 Holdout |

## 6. 最小采用路线与验收

| 时点 | 采用内容 | 对应本地位置/产物 | 怎样判定值得继续 |
|---|---|---|---|
| D8 契约修复 | CheckList 思路 + 字段变异矩阵 | 另建新版 reference/scorer，参照现有 candidate14-contract 测试 | 正确 wire 可达；时间、否定、条件、关联变错必失败；合理等价不误罚 |
| D8 确认/测量 | LangExtract 来源绑定思路 + HAX 失败场景 | 新版实验入口、真实 DraftReviewPanel / DomainCommitPlan 路径、测量 sidecar | 点字段能定位；不重复建任务；失败可恢复；阅读/编辑/等待可区分 |
| Development 准备 | 现有一次发送执行器，promptfoo 仅可选离线展示 | 新运行版本、两臂公共契约、完整参照和零调用身份 | 公平、可重现、无 Expected 泄漏，调用前再取得对应预算授权 |
| 独立 Holdout | 空白模板优先，必要时 Label Studio 或 Doccano 二选一 | 来源包、A/B 隔离、裁决记录与签名 | 真实人员独立工作、无答案污染、覆盖范围明确 |
| 真人验证 | 可观察交互 + 独立语义判断 | 合法注册试次、首次快照、全部试次分母 | 正确处置与低修改率提高，主动时间及总处置时间一起报告 |
| 读取专项 | 现有 OCR 对照 PaddleOCR / Docling，其他备选后置 | 独立本机 adapter 与匿名读取集 | 关键字/页段覆盖及下游整份正确共同改善，成本/延迟可接受 |

本轮研究结论：无需先装更多框架。最直接可执行的是把上述方法写进当前 W1/W2 的正反例、来源定位、计时口径和浏览器验收；这部分不需要新增业务模型调用。任何资源都不能替代本项目自己的可靠参照与真实用户证据。
