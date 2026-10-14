# R2 原类型错误与新工程阻挡

## 已修复的唯一授权根因

本机Node v24.18.0。新临时目录reproduction.log中app类型检查退出2：三份mainline03测试各导入node:fs与node:crypto，共6个TS2307。添加精确@types/node 24.13.3和必要undici-types 7.18.2后，两个项目类型退出0，旧153测试通过。没有产品/测试/配置修补。

## 全量门首次阻挡

原命令：node --test scripts/rco-5-007-replay.node-test.mjs。仅运行库测试，不是旧一次性联网/回放runner。

结果3通过/1失败，失败名RCO-5-007 prediction and scoring dependency graphs are hash bound；scripts/rco-5-007-integrity.mjs:17抛FREEZE_HASH_MISMATCH:package-lock.json。

旧RCO-5-007_COMPONENT_FREEZE.json的prediction依赖逐字绑定package-lock.json与package.json，17个路径仅这2项变化。两文件起始SHA与旧freeze一致：

- package.json：df4c657cb2f43d2555a7d0cda93f86ac8afb15034530756bb009082dfc0a2123。
- package-lock.json：0712a7885770a869293149bab34cfb2d740562694d8bd30980141df9a5d2a0b1。

新SHA见R2_REJECTED_SNAPSHOT。Git原始blob与工作区换行字节可能不同，不可将Git原始blob SHA直接当作起始工作区SHA；本轮权威是安装前R2_BASELINE，两项都已独立核对。R2_ENGINEERING_EVIDENCE中的headLock字段仅是Git原始blob，不能据此声称旧基线原已失败。

该检查正确拒绝“仍是完全相同历史依赖环境”的说法；本轮批准新增类型，不等于批准改旧freeze/测试或重新定义完整门。原357非根锁package对象零漂移，但并不能使整文件SHA不变。

停止后没有修改旧freeze、两文件回切、临时屏蔽测试、改哈希算法、用any/ignore或跳过旧门重新报绿。functions/build/完整安全/依赖审计/实际Edge均尚未执行。本轮新增证据与源码现场保留。
