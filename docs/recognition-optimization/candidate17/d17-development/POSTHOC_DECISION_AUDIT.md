# D17 结果选择器的追加式诊断订正

本记录在模型输出与冻结 v7 评分之后形成；不修改 D16 来源、Expected、请求身份、v7、原 raw、账本或 [原始评分结果](SCORING_RESULTS.json)。原始评分结果 SHA-256 为 `559af444f357b1c2aed525b751d17603a6c821cd5a6b10aae98bdb8ee1c063dd`。此处是**事后诊断**，不是新的预注册门槛。

`SCORING_RESULTS.json` 中 S04 的选择器风险理由 `NEW_MATCHED_TASK_LOSS` 是误报。S04 原文明确说你的队伍未列入名单、无需出席；v7 对 Candidate17 的零当前任务给出 `complete=true`、Severe=0、任务 FN=0。Candidate03 则输出了一个带错误条件依据的任务，`complete=false`。选择器比较了两臂各自命中的参照表示 ID，把基线错误输出中命中的 `T1` 当成挑战者必须保留的任务；这与“正确无任务”的可接受表示冲突。S04 应记录为 Candidate17 的**真实整份胜例**，不列为新漏任务。

剔除该误报后，整份正确仍是 Candidate03 **1/12**、Candidate17 **2/12**，逐来源 **1 胜、11 平、0 负**。Candidate17 的 9 个 Severe 和 S08 新增的 `materialDetails` 错误仍在；S10/S11 修订关系仍未通过。原始自动结论与订正后产品判断同为 `MIXED_PROGRESS`、**不得晋级或更换默认候选**。原评分中的其余 `CANDIDATE17_SEVERE` 标志代表挑战者仍有严重错误，不能统称为“相比基线新增”的退步；真正新增的关键字段错误须逐来源另列。

因为订正发生在看见输出之后，本文件只解释选择器误报与不变的决策，不回写原 `SCORING_RESULTS.json`，也不把事后版本伪称预注册评分。未来比较须在新输出前修复这种“不同合法参照表示的匹配 ID 不能直接相减”的选择器问题并冻结新版本。
