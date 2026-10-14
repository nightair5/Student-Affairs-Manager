# D11 旧回答在 D13 v7 下的逐例事后诊断

不是新 Candidate16 输出，不修改 D11 原结果/拒绝，不是独立质量验证。分母24；每臂12，引用失败保留分母但没有语义分数。完整参照指有限且 provisional 的公开合同，不等于独立人工真值或所有合法表述均穷尽。

| 来源 | 参照状态 | 原文义务/场景 | Candidate03旧回答 | Candidate15旧回答 |
|---|---|---|---|---|
| C13-D5R1-S01 | complete / provisional |  请于2026年10月19日16:30前归档研究伦理声明。研究伦理声明须为PDF/A格式，文件名为课题号-负责人；系统显示归档完成即结束。 | 未整份正确；独立事实/信息归类/额外实体（auxiliary） | 未整份正确；独立事实/信息归类/额外实体（auxiliary） |
| C13-D5R1-S02 | complete / provisional |  请在10月20日前确认竞赛队伍信息，页面显示确认完成；另于10月22日前上传监护人知情书，监护人知情书须为JPG，平台显示知情书已接收。两项分别办理。 | 未整份正确；materialDetails | 未整份正确；materialDetails、独立事实/信息归类/额外实体（auxiliary） |
| C13-D5R1-S03 | complete / provisional |  你的入场申请已获批准。获批准的同学须在10月16日11:30前领取实验室门禁卡，以在领取册签字为完成。 | 未整份正确；conditionScopes、独立事实/信息归类/额外实体（auxiliary） | 未整份正确；condition、conditionScopes、独立事实/信息归类/额外实体（auxiliary） |
| C13-D5R1-S04 | complete / provisional |  进入复评名单的同学须参加作品复评陈述，以完成作品复评陈述为准。你的作品未进入复评名单，本通知不要求你参加。 | 未整份正确；currentness、修订关系 | 契约整份正确；无合同字段错误 |
| C13-D5R1-S05 | complete / provisional |  若安排你担任主持人，请提交主持提纲，以平台显示提纲已收取为完成。暂定下周二下午办理，主持人安排尚未确定。 | 未整份正确；conditionScopes、materials、materialDetails、times | 未整份正确；action、currentness、actionability、materials、materialDetails |
| C13-D5R1-S06 | complete / provisional |  请先补全田野调查名册，名册必填栏均已填写后，再报送田野调查名册；田野调查名册格式为XLSX，以办公室确认收到名册为完成。 | 未整份正确；materialDetails、condition、actionability、conditionScopes、独立事实/信息归类/额外实体（auxiliary） | 未整份正确；materialDetails、condition、conditionScopes、独立事实/信息归类/额外实体（auxiliary） |
| C13-D5R1-S07 | complete / provisional |  请在月底前后向策展组交付展览海报初稿，以策展组确认收到初稿为完成；确切日期稍后公布。 | 未整份正确；times | 未整份正确；materials、materialDetails |
| C13-D5R1-S08 | complete / provisional |  请先核验报销银行卡信息，页面显示银行卡核验完成后，才能上传差旅报销声明。差旅报销声明须为PDF；系统显示声明上传成功即完成。 | 未整份正确；condition、actionability、conditionScopes、独立事实/信息归类/额外实体（auxiliary） | 未整份正确；condition、conditionScopes、独立事实/信息归类/额外实体（auxiliary） |
| C13-D5R1-S09 | complete / provisional |  图书馆检索服务将在周三晚维护，原有预约记录不受影响。无需取消预约，不要上传说明，也不必给管理员发邮件。本通知仅说明维护安排。 | 未整份正确；独立事实/信息归类/额外实体（auxiliary） | 未整份正确；独立事实/信息归类/额外实体（auxiliary） |
| C13-D5R1-S10 | complete / provisional |  原通知要求归还实验室备用钥匙并签署旧版值班名册。现通知：取消归还实验室备用钥匙，同时取消签署旧版值班名册；两项都无需办理。 | 未整份正确；FN=2、FP=2、修订关系 | REFERENCE_LINK_FAILURE（语义未评分，保留分母） |
| C13-D5R1-S11 | complete / provisional |  原定打印会议海报，并登记现场展示场地。现调整为：会议海报改为上传电子版，平台显示电子海报上传成功；现场展示场地改为预约线上时段，页面保存线上展示时段。两项分别替代原要求。 | 未整份正确；currentness、propositionScopes、materials、materialDetails、修订关系 | REFERENCE_LINK_FAILURE（语义未评分，保留分母） |
| C13-D5R1-S12 | complete / provisional |  请复核项目成员资料，以页面显示资料复核完成为完成标准。无需院长签字，也不要创建“联系项目办”任务。 | 契约整份正确；无合同字段错误 | 契约整份正确；无合同字段错误 |

自动合同完整率 C03=1/12，C15=2/12。C15引用10/12，另外两份没有语义计数；Forbidden自动0不能代替对全部输出的人工禁止行动审查。自由描述/标题、有限别名/合法拆合、信息分类重叠及教学例泄漏需要人工审查才能支持更广义的整份质量声明。

auxiliary 同时覆盖独立事件/时间/信息归类与额外实体；任务存在正确不代表该项通过。尤其“将完成说明同时归为信息”是否影响产品处置是有范围限制的契约判断，不能仅凭该标签说用户无法完成操作。后续若负责人认为允许集合应改变，追加 corrections 并另建版本，不回写本次分数。这类分类争议不自动叫真实禁止行动，也不阻断安全工程回放。

逐字段 expected/actual、scope错误、raw/response SHA 在 [完整诊断](POSTHOC_DIAGNOSTIC.json)。原答逐例路径及摘要如下；这些均为旧 D11 只读文件。

| 原D11次序 | 来源/臂 | raw | raw SHA-256 | response SHA-256 |
|---|---|---|---|---|
| 1 | C13-D5R1-S01/A | [原raw](../../candidate15/d11-development-20260928a/raw/01.json) | 7788c82fb8f74287bdd3d9e7aac50ebca355fe32c2af39870a35106f2ddc6753 | 9a4de48a1b9c9ca6c8af121057e7db6fbf2b102fa52e9871ce30869a109d19ed |
| 2 | C13-D5R1-S01/B | [原raw](../../candidate15/d11-development-20260928a/raw/02.json) | 45f07c84d5a3954974a8760f909450b36f062cdfdb58880f373f1d8b89eb8d6d | c6a8b9d72ebe4b5fa2381925b78f00415cb7c6cfc19a06d23d5c3874239500db |
| 3 | C13-D5R1-S02/B | [原raw](../../candidate15/d11-development-20260928a/raw/03.json) | ff469160423d07176fcc2b4ffca386348cc09b977fb38cc3f75d24a0ae4e5709 | bbb23ca2d9a46005c7a559dcd5b3b6e0c343673a627fb19c65dd787a26da2af2 |
| 4 | C13-D5R1-S02/A | [原raw](../../candidate15/d11-development-20260928a/raw/04.json) | 83c996ea58da0b5c4bff42270907674a25f24b73428eaddae127d708734174b0 | 8646830c8ebfa669623f6fdc6696f2dfb5d5e874ddc1dfe195653af49de2c365 |
| 5 | C13-D5R1-S03/B | [原raw](../../candidate15/d11-development-20260928a/raw/05.json) | 801512af62facc1b1432cac758e1675c5d891278aba2c59805d46f8fdfaecf3d | 2080072e0bff6f52e21890ffad31f97903120e2ac55364eb4a41eed8accb7603 |
| 6 | C13-D5R1-S03/A | [原raw](../../candidate15/d11-development-20260928a/raw/06.json) | 6a958079046d81c9acc13ed9eab5233e263c8677f2ac0b28e45f84731d16a190 | e4d647b510d526761a708c6c704bc387842afd5ec44a93b16a6b58ae6bf6337b |
| 7 | C13-D5R1-S04/A | [原raw](../../candidate15/d11-development-20260928a/raw/07.json) | 261354b81885f23b381450c99525d32f9ac90f0964dc2071d86978ae4e4eb1e8 | d7f0350a4c920f702f542d66970e24d2464bf2acd9208b1875107492b306fff3 |
| 8 | C13-D5R1-S04/B | [原raw](../../candidate15/d11-development-20260928a/raw/08.json) | 5aaf48f192a3eb1c3d3e1393800d268573461539c92e42f76cf10862ead5c2bf | 9802d301da647b66465b8e5911a75273e910b8b1828c171527e4abcc53ad3da4 |
| 9 | C13-D5R1-S05/B | [原raw](../../candidate15/d11-development-20260928a/raw/09.json) | 27e7b9aba601dd2e9a7577a52379ca5af2662ebe6bc91b2b8cd91002a28ff02b | 16b71f829d84f88fbda8e6dc191a64956becdac07e397a1f9cc0bd2041d6f484 |
| 10 | C13-D5R1-S05/A | [原raw](../../candidate15/d11-development-20260928a/raw/10.json) | af556fe0ddfb320bfe6dcd001fc8ced6625ab325f3c0a11185434fd79477b129 | 51104b897e7347af83a2bf1d4922af097627904ba9d84ec9d0f6b1c7532881db |
| 11 | C13-D5R1-S06/A | [原raw](../../candidate15/d11-development-20260928a/raw/11.json) | 88f2ccb3979bf8e0855eed04cc652a53c4bd88cc2d1ae8755305638e551ad5de | b2f40110302b69e118a29e44f9d7cd7b4848af8e65b880051c639b4276d3e16e |
| 12 | C13-D5R1-S06/B | [原raw](../../candidate15/d11-development-20260928a/raw/12.json) | 868ee0e3c26cf86c2cf5f3ac3d828619b623ba10fce91237c1ef38695c4a84ae | a23934133e4fe0c4af3f4ef77972b50d9fcbc50d95c0fc6547e01ca1f678b4a6 |
| 13 | C13-D5R1-S07/A | [原raw](../../candidate15/d11-development-20260928a/raw/13.json) | c74f54a6cc743fcef3c3492b426117296628f51e83213df98f85a88e7e3dcfb7 | f269d5623a92b350270c8056952be9256c36c9accde0898cb5a94a39fb4da9e0 |
| 14 | C13-D5R1-S07/B | [原raw](../../candidate15/d11-development-20260928a/raw/14.json) | 01dfc54a8e65034f1d33e20c8af7aa884f834930f4cbe240d2579f5f3ebf5643 | cf4edcbf15ccdec6a0ed3ecba61586f84870ece087c6b291c63117e0945c96ec |
| 15 | C13-D5R1-S08/B | [原raw](../../candidate15/d11-development-20260928a/raw/15.json) | d719ba94981f4b346316e5bd3f9835f28f06d331a469f7a2a31a47701a7a127e | 7b5716a24c89b0012fc1884fd4cf1cd56c526f2ae9556a9ffa749c774a41b080 |
| 16 | C13-D5R1-S08/A | [原raw](../../candidate15/d11-development-20260928a/raw/16.json) | a22cc7f8a002e372a351f3b544b44005853ec1840650b4cdf7904b1213174e20 | 9948937c25ec2927b2d31a28c4c7a576a75739e7c7afa0e479eb6b73b95182e8 |
| 17 | C13-D5R1-S09/A | [原raw](../../candidate15/d11-development-20260928a/raw/17.json) | fdb9904cf35a8ea579cc4e8385528473ab6984a78aca7647cf9c1567afb02d81 | 5d202ce110ab929731ce8396c614f281d855a427e4250a6492c6b59121c14bdd |
| 18 | C13-D5R1-S09/B | [原raw](../../candidate15/d11-development-20260928a/raw/18.json) | 00ad4e5c3f6e2f9b8bb23461591745b5dca42f7281f9a9ef76b4be9c42353226 | 2dbe1c3b8d1bfd0edd4d483457abe919e0ea4edcfa676db11a03513c5f04c7b2 |
| 19 | C13-D5R1-S10/B | [原raw](../../candidate15/d11-development-20260928a/raw/19.json) | eefaf0113e7b913490f2a1a506d8ebb2126f16babfaf9b245f798698fde0b9d1 | 193c4ba36e1d18d421b12ff88368602fd8cade1511fc4258470ef44d8f0b7d49 |
| 20 | C13-D5R1-S10/A | [原raw](../../candidate15/d11-development-20260928a/raw/20.json) | 9fe01cc9cfc89adb61ba755b512501358227c3630391b66ddf0132b7d53cce12 | 35d83fa7d3add361272e855953e9d20943a87e3f6f2e50f19f090ce71d80bdeb |
| 21 | C13-D5R1-S11/B | [原raw](../../candidate15/d11-development-20260928a/raw/21.json) | fe5fb894af901fcfdcac6d4d36a5623bcc8700cc045181ea88b9a96a3a332379 | 82338352adb9c710373bca8763045b0df9a060de7a0be9576553a60d51f97278 |
| 22 | C13-D5R1-S11/A | [原raw](../../candidate15/d11-development-20260928a/raw/22.json) | 7a4b9dcf722306cc71aa831bcb142299d2bb7a8063cfa3dfa28028da073fbcec | bd731aacf5c16edac37e031af97892483ad75d2a21d58b7f5e55568b662a8094 |
| 23 | C13-D5R1-S12/A | [原raw](../../candidate15/d11-development-20260928a/raw/23.json) | f5fea0e4a32f1b531ce78ac2d1173158b2ab1132ea30c99c6b6f8bd6d8c9a151 | a581777bd59f33256f72a42fcc682db74d14d091ec53676e80ab267aaa3ef16b |
| 24 | C13-D5R1-S12/B | [原raw](../../candidate15/d11-development-20260928a/raw/24.json) | 04777cea4d92aabab71577f7410f2bd76c83261e57c93e9299566cdfb74ccc46 | c165e2a36cf769578067d21d050a77f646888a1bc01919696600fbc63b0d808f |
