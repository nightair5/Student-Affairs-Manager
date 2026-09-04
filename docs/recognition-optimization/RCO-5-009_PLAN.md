# RCO-5-009 本机候选枚举与局部失败隔离计划

**Problem**：B8 证明模型自由创建 directive 时会漏掉历史动作、把修订状态冒充动作，并反复把“请/禁止/可自行”等语气吞进 action。P4 能纠正部分词面，但当前一条不可控动作会使整例失败。

**Primary claim**：本机先枚举不可变动作候选和对象候选，模型只能引用候选 ID 并判断“行动命题 / 纯提及 / 不确定”；模型不能自由写 action、创建 directive 或删除候选。

**Supporting claim**：局部候选不合格只隔离该候选；只有来源绑定、候选目录或覆盖账目被篡改才拒绝整例。这样安全失败关闭不再必然牺牲整份通知的召回。

**Anti-claim**：不得靠修改 B8 Expected、放宽危险默认、把历史任务静默丢弃、重新调用 B8 模型，或用已见 B8 满分冒充泛化。

## 当前授权解释

用户要求从第一性原理彻底根治并持续优化。本轮仅执行 0 次模型调用的隔离 RCO-5-009：实现 Schema/index/composer、属性变形与对抗测试、已见 B8 回归；通过后才创建并冻结全新匿名 B9，再运行一次本机理想分类上限。没有新的付费调用、Secret、稳定路径、RCO-6 或部署授权。

## 根治结构

1. 本机从版本化受控动作表扫描 scope，生成不可变 `actionCandidateId`、最小动作头和本机字符范围。
2. 本机为每个动作候选生成有限、可审计的 `objectCandidateId`；模型只能选择 ID，不得输出文字或位置。
3. 本机先把证据明确的候选标为 `local_proposition`、`local_non_task` 或 `needs_model`。引用按钮、示例和说明不得成为任务；明确命令、禁止、可选、第三方、历史及完成句保留为命题，由 P4 决定状态和默认勾选。
4. 模型合同只允许逐候选输出 `proposition / mention_only / uncertain` 和一个既有对象候选 ID；不能输出 action、scope span、语义、requiresAction、修订、风险或 selected。
5. composer 对每个候选独立裁决。模型缺失、重复、越权或对象无效时，该候选进入 quarantine 且默认不选；其他合法候选继续形成建议。
6. 无受控动作头的“取消、停止执行、作废、改为”等 scope 不会成为 action candidate，仍由本机修订关系层消费。
7. 来源绑定、候选目录指纹或根结构错误属于全局污染，整例拒绝；普通候选错误不得拖垮整例。

## 已见 B8 回归门

- 使用冻结 B8 source、Expected 和 raw result，仅做 0 调用回放；B8 在本轮始终标为已见。
- scope/action/object、Task F1、requiresAction、Complete、三类修订、旧要求失效、新要求生效、unresolved 均为 100%。
- unsafe-default false positive、Forbidden、stale、selected stale 均为 0。
- 单条伪动作、缺失分类、重复分类、未知 ID、对象篡改均不得让其他合法候选消失或变为默认勾选。

## 全新 B9 首次本机门

- 只有实现、已见 B8 回归、组件冻结、全量工程门和提交推送全部通过后才创建 B9。
- B9 与 B0–B8 的 source text 和 semantic family 不重复，逐例字符 bigram Jaccard `<0.55`。
- 首次运行前冻结 dataset/Expected/generator/test 和 RCO-5-009 组件；运行后立即标为已见。
- 固定门：合同与本机可组合 100%；Task F1、requiresAction、Complete、action/object、修订与 unresolved 全部 100%；unsafe/Forbidden/stale 为 0。
- B9 通过只允许申请新的付费分类器盲测，不授权调用。

## 停止条件

- B8 或任何既有 Expected/freeze/dataset/checkpoint/cache 漂移。
- 为追分修改已运行数据或降低门槛。
- 出现模型、网络、Secret、稳定路径 import、RCO-6 或部署行为。
- 候选目录无法完整解释来源、对象候选不唯一却被默认采用、或 quarantine 候选产生 selected task。

本计划沿用项目的计划—跟踪表—冻结清单—追加日志体系；通用实验模板不替代项目现有权威链。
