# Candidate12 Development 冻结说明

状态：`CANDIDATE12_ENGINEERING_FROZEN_MODEL_NOT_RUN`。

Candidate12 只根据 Candidate11 B2 已见 Development 的四类错误形成一个紧凑修正：当前任务准入、附属事实边界、多个修订端点守恒、完成标准与条件保真。它没有使用新 Holdout 来源或 Expected，没有教学例，也没有改变模型、Schema、适配器、评分器、candidate03、candidate10、candidate11 或默认候选。

## 修正范围

- 否定、无需、不得、禁止和背景说明不能反向生成当前任务；明确取消/替代的旧义务只保留为不可执行历史端点。
- 材料、格式、数量、命名、渠道、地点和联系方式附着到有依据的任务或信息，只有原文另有明确动作时才成为任务。
- 动作、对象、条件、时间、完成标准、状态或材料归属不同的义务不得合并；多条替代关系必须各自连接新旧端点。
- 核验等动作不能扩大为通过；正文直接要求取得批准等结果时保留结果目标。false/unknown 条件实体保留但不可执行，不额外生成“确认条件”任务。

## 冻结与证据边界

`FREEZE.json` 绑定 Candidate12、candidate03 基座、模型 wire、语义契约、评分器和验证脚本的 SHA-256，并保存 prompt、Schema、固定模型参数及候选包哈希。冻结探针只证明请求构造确定、身份可审计和边界未漂移，不证明模型质量。

匿名工程反例只出现在本地测试中，不进入 Prompt，也不作为 Holdout。Candidate12 的模型结果仍为 `NOT_RUN`，不得依据工程测试宣称优于 candidate03 或 candidate11。

生成与验证：

```bash
node scripts/freeze-candidate12-c1.mjs --write
node scripts/freeze-candidate12-c1.mjs --verify
npx vitest run src/experiments/realInput01/candidate12.test.ts
```

本阶段禁止模型派发、Secret 读取、grant/reserve/settle、权威账本写入、默认候选切换、合并和部署。
