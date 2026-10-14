# 全新数据隔离规则

Candidate13必须先在Git中冻结并推送，随后才允许创建或披露任何全新Development Expected。D4本身不创建新评测来源、Expected、请求身份或预算记录。

## 已见材料

- D1来源与provisional参照；
- D2的24份输出和事后诊断；
- D3的24类契约夹具；
- D4的28类匿名工程反例。

这些材料永久标记为SEEN，不得改名或改写后冒充全新评测。

## 后续数据门

1. 新来源必须使用新的sourceId和独立source SHA。
2. 与已见语料逐字或高相似重合时，必须排除或进入人工裁决。
3. Candidate13实现者在候选冻结前不得查看新Expected。
4. 正式Holdout仍需要真实标注者A和复核者B的密封双审；模型不能冒充人工。
5. 新参照必须通过D3 validator和compiler，之后才可生成`dispatchAuthorized=false`身份。
6. 任何模型调用仍需重新核价、预算卡、新grant和用户明确授权。

`scripts/candidate13-d4-isolation.mjs`检查Candidate13导入边界、默认入口、保护组件和D4夹具角色；发现新Expected读取、默认入口耦合或组件漂移时失败关闭。
