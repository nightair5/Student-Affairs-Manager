# R1 已登记业务反例的先失败、后回归

## 复现入口

唯一仓库为本阶段授权实验仓库。使用真实工程映射 `engineering()` 和真实 `composeSemantics()` / `assessLegacyHandoff()`，不另造替身函数，不修改旧通知或Expected。命令仅运行新增mainline04测试，不运行历史一次性runner。

```powershell
node node_modules/vitest/vitest.mjs run src/experiments/mainline04 --config scripts/mainline-01.vitest.config.mts --silent --reporter=json --outputFile=docs/recognition-optimization/mainline-04-i1/R1_TARGETED_RESULTS.json
```

该命令是已执行最终定向尝试的记录；不要为了查看结果覆盖原JSON。需要重验时必须使用新的获准R1_*路径。

## 反例一：修订证据缺失

- 原工程响应：`engineering('revision')`；仅在新测试内把第一条revision.scopeIds变为空数组。
- 初次真实失败：新要求 `defaultSelected` 实际true，期望false。
- 最终回归：关联旧/新两项都有缺依据问题，均不默认选，requiresAction为unknown；原输入不改。
- 正反：缺失、坏scope、effective未知、有效修订；取消无替代覆盖缺失/坏scope/未知/有效/明确无效力。
- 有效新要求仍默认进入可核对建议；没有用全部未知或全部拒绝获得通过。

## 反例二：独立兄弟被连坐

- 原工程响应：`engineering('multi')`；只在新语义侧把m0名称附加changed。
- 初次真实失败：实际eligibleTaskTempIds为空，期望独立print保留。
- 最终回归：submit仍被FULL_ENTITY_DIFFERENCE阻断，print单独等价可承接，原旧2.0对象全结构不变。
- 正反：独立材料/时间差异只影响关联项；共享材料/时间差异阻断两个真实相关项；旧侧独有/新侧独有关系均纳入并集。
- 仅经材料关联时间仍被比较；任务/材料/时间数组换序不制造差异；旧事件归属和共享时间测试未改。

## 数字与边界

- 初次51项：49通过、2失败；最终68项：68通过、0失败。
- 原49项旧测试内容逐字保留；本轮新增19项。各attempt不累加为独立案例数。
- 原42字段真实V2内存确认/读回为42/42；旧历史40/42和FAIL保留。
- 当前测试中的错误默认选择为0，不等于任意真实通知都正确。
- 新语义实际App、正式保存均NOT_RUN；模型识别准确率本轮未测量。

## 独立审查补充：共享材料不等于共享全部任务信息

在`artificialResponse('multi', 'engineering')`内存副本中，仅令m0.relatedTaskTempIds加print、print.materialTempIds加m0，再令各time.relatedMaterialTempIds=[]。原时间仍各自关联原任务，旧validator认可。经真实engineering映射，第一轮composer错误把两项都列为MULTIPLE_DEADLINES；即使只改print私人m1.quantity，submit也不能保留。

新4项回归先实测68/72，再对composer闭包做第二轮局部修补，结果72/72，详见R1_REVIEW_RED_RESULTS.json及R1_TARGETED_02_RESULTS.json。不改实体时两项均能旧V2等价承接；改私人m1或d1属性时submit保留；改共享m0属性时两项均FULL_ENTITY_DIFFERENCE。原对象与任务换序断言均保留。
