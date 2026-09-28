# D15 三项风险的有限根因追踪（D16 修复依据）

本追踪只读使用 [D15 已冻结结果](../candidate16/d15-integrated/SCORING_RESULTS.json)、[D15 决策](../candidate16/d15-integrated/D15_RESULTS.md)、D13 来源/参照和本机受保护 raw。它不是对 D15 的重新评分，不更改 Candidate16 或旧 Expected。原始回答与公共 adapter、评分、页面影响依次分开。

| 来源 | 原文最小义务 | 原始模型回答与 adapter 边界 | v7 判错和用户影响 | D16 有证据的修复 |
|---|---|---|---|---|
| S02 | 分别确认队伍信息、上传知情书；知情书 JPG 与 10 月 22 日上传期限属于第二动作。 | Candidate16 原回答包含第二任务、知情书材料与格式，但材料证据同时带任务句与格式句 scope；时间标成 `task_deadline` 且关联材料 ID。公共 adapter 保留该归属，没有凭空增加关系。 | 参照要求材料格式由直接材料句支持、上传时间为 `submission_deadline` 且任务归属，不把任务期限顺手绑材料。C16 从 C03 的整份正确退为 Severe/关键 Major；用户若不核对会看到错误期限含义和材料依据。 | 新 Prompt 对“动作/对象、材料格式、时间类型及关联”逐项归属；新 S02/S08 类型反例做正负往返。尚无新模型输出，不能说已修好识别率。 |
| S10 | 明确取消归还钥匙和签旧名册两项旧要求；旧端点不可执行，但修订必须各有真实目标。 | Candidate16 原回答 `tasks=[]`，却输出 2 条 `cancels` 指向不存在的 `task-old-return-key`、`task-old-sign-roster`。adapter 没有造这两个实体。 | Schema 可解析，引用校验失败；D15 Candidate16 S10 `REFERENCE_LINK_FAILURE`、未进入语义计数。产品必须阻断相关修订确认，不能把坏 ID 写入正式事实；无关正确项可单独处理。 | Candidate17 明确旧动作对象先有真实任务实体，纯取消分别闭合；无法识别时留未知且不造关系。冻结新 S10 两端点场景。 |
| S11 | 两项旧要求分别被新要求替代，旧端点为 superseded；数字版材料和线上时段分别属于各自新动作。 | Candidate16 原回答列出旧新四任务与两条替代关系，但旧任务混用 `status=cancelled`、`validity=superseded`，新上传任务材料不准；adapter 没有把 cancelled 自动改成 superseded。 | 引用有效却存在 currentness/材料关键错误，C16 关键 Major 多于 C03。用户可能把“被替代”误看成“单纯取消”，且新材料核对成本增加。 | 新 Prompt 明确 `cancels` 与 `supersedes/amends` 的旧端点状态不同，逐动作对象关系和材料归属；冻结新 S11 多端点场景。 |

裁决限制：S02/S11 的 v7 某些证据 scope 是否过宽仍是 provisional 参照，不能冒充独立人工真值；D16 复用冻结 v7 作公平两臂 Development 筛选。S10 的悬空实体是确定性的引用错误。标题、自由描述和教学例泄漏未独立人工复核，保留 `NOT_ADJUDICATED`。
