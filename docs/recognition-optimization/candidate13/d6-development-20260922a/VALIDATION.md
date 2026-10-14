# D6验证记录

验证范围包括执行器失败分支、v4.1真实链路、四项指标计算、独立回放、身份/预算/账本/保护文件、lint、test、build和安全扫描。

已确认的固定事实：

- 24 raw、24 result，全部HTTP 200、settled、确定结局。
- 0 transport、parse、Schema、reference和执行期semantic failure。
- Manifest SHA-256仍为`2acd34fce52396a3be17b70fee28e4fe1f3d11bec796e97c672249406c453f53`。
- 84份保护文件保持一致。
- 权威账本合法追加49行；最终791行和SHA-256 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`。
- 浏览器工程回放部分通过，零任务最终处置存在已记录阻断。

## 实测结果

- D6执行器、预算和Preview Node：17/17通过。
- Candidate13测量、观察、身份、候选和D6真实链路Vitest：22/22通过。
- `npm run lint`通过，0 error、6 warning；其中1条为D6 runtime的Fast Refresh结构提示，另5条为既有提示。
- `npm run build`通过；保留Vite大chunk提示。
- `npm run security:scan`通过，检查2,787个源码/构建文件。
- server 8/8、Worker 25/25、time parity 1/1、multimodal 23/23、Functions 5/5通过。
- 裸`npm run test`为1452通过、3失败、1跳过。两项5秒超时分别单独复跑1/1通过；剩余一项为历史`REAL_INPUT_CARRIERS_MANIFEST`缺失导致launcher解析`undefined`。
- RCO-5-007单独复跑3/4，仍为`FREEZE_HASH_MISMATCH:package-lock.json`。
- D5历史冻结包在D6账本追加后3/6通过，另外3项固定报`D3_AUTHORITY_LEDGER_DRIFT`；这是742行历史账本锁与当前791行的预期差异。

保留的历史问题：

- 裸`npm run test`仍受`REAL_INPUT_CARRIERS_MANIFEST`环境前置问题影响。
- RCO-5-007仍为`FREEZE_HASH_MISMATCH:package-lock.json`。
- D5零调用冻结测试仍绑定742行旧账本快照；D6已获授权合法追加到791行后，这些历史只读断言按设计报`D3_AUTHORITY_LEDGER_DRIFT`，未修改旧锁或旧哈希迁就新状态。
