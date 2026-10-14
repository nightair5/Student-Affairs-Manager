# RCO-5-007-P3 已见 B5 对抗审查

## 结论

`TECHNICAL_PASS_SEEN_B5 / ELIGIBLE_TO_FREEZE_P3 / NOT UNSEEN EVIDENCE`

P3 将 B5-08 的“该规定不再有效”绑定到旧“发送宿舍分配表”任务，形成 `supersedes` 边；旧任务被标为 `past + cancelled + superseded` 且不默认勾选，新“核对房间编号”任务独立保持当前有效。B5 16/16 整例正确，陈旧任务从 1 降到 0，Forbidden 保持 0。

## 对抗检查

- 六种失效表面表达在相同命题结构下产生相同 `supersedes` 关系。
- 独立覆盖 `cancels`、`supersedes` 和 `amends`。
- 关系证据只引用不可变 scope ID，不复制自由文本位置。
- 关系解析只改变旧任务的时态、状态、有效性和默认选择；原文动作、对象、执行人、动作类型与风险效果保持不变。
- 当“上述要求取消”前存在两个同类型候选时，解析器返回 unresolved，不猜测目标。
- 篡改关系证据、旧任务状态或 requiresAction 会被重算校验发现。

## 仍未证明

B5 已用于发现 P2 故障，因此本结果只能证明定向修复，没有证明新表达泛化。测试中的上游 action/object/scope 仍由 Expected 构造，不是模型输出；也没有真实材料、OCR、图片、真人修改时间、浏览器或发布证据。必须冻结 P3 后用全新 B6 唯一首次运行。
