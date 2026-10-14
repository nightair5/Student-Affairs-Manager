# D13 冻结配对矩阵

已见合成 Development；单作者/模型辅助参照。12来源×2臂，A=Candidate03，B=Candidate16，6AB/6BA。全部NOT_RUN、dispatchAuthorized=false。完整请求正文和身份以PREPARED_REQUEST_IDENTITIES.json为准，未发送。

| 次序 | 来源 | 臂/候选 | 覆盖 | request SHA-256 | identity SHA-256 |
|---|---|---|---|---|---|
| 1 | C13-D5R1-S01 | A/Candidate03 | single, exact_time, material_format | 08c71233ccfa45af30f82aa77728183d86c991553a2a7ba4c73f9962a8cd4f19 | 4d336fd8e326378d50e75542e83363187073a709e56e97cc4019dac028722f86 |
| 2 | C13-D5R1-S01 | B/Candidate16 | single, exact_time, material_format | 3add251dfcf0fe1d106ef7920dd3d7fb4c117a15ede1160e59adbdd66c6951a2 | fc92ffab00bbd6a245e5ae10bf241be1c81f1d7e4d361b098cfbbe5938af5025 |
| 3 | C13-D5R1-S02 | B/Candidate16 | multi, date_only, material | f97ac5013ddf101f3465258789d5ce4a0681c635d96ac31509c71add4c83903b | 3e4c44b2d98a678e1571e53b4b51c245e309d4ba20914fbbbd4da90b8ea264a3 |
| 4 | C13-D5R1-S02 | A/Candidate03 | multi, date_only, material | c0a2dcfa9b93e22a38b62e349db7eda6b1bb6eea7b58534dac8d3fef7091266a | b7cc0ee08cff41eef1d8d876573b7bb03da30f651befdf858503e0323258c7c5 |
| 5 | C13-D5R1-S03 | A/Candidate03 | condition_true, exact_time | 4aaf3648a9d42d55638f3ebfa5778509f3673f094b89f0ecf0630bcca8478419 | 686a170a0890da8cb42c33117c86ce5562ac285a2beb033eff993362f3a02c46 |
| 6 | C13-D5R1-S03 | B/Candidate16 | condition_true, exact_time | f3a7ae54eb094da9df51a8bd5863a4e7f4e8bbe771c163d2a1e013a2ce176441 | 614a0b0a1ce37686019dd89e71c4befdd2c911dcc01f66791be6a074bfb7d793 |
| 7 | C13-D5R1-S04 | B/Candidate16 | condition_false, inactive | 26865b648f3399e91127f990d0d093a389968de93e9679d100df3a6d5eea6bf1 | f00049c35685fcded44ab1f7b385f248ade58358b7522018c34eee3c2adf4c2e |
| 8 | C13-D5R1-S04 | A/Candidate03 | condition_false, inactive | 154c9b036decc72b3e4291ca1ac7a8e50913c656878f97bfcd9ddb4b55d9d6ac | 62765be369a6e9507a6e37da773872ab3adb14c4b24ff6cdfd6335573dd4983f |
| 9 | C13-D5R1-S05 | A/Candidate03 | condition_unknown, vague_time | e5a3d779ae48ddf708dc6ce9b201fc7c430d42c90952fdc7668b862d44d2ef8c | d2bbff4d2038ece0c5428e8755424d3a1970cae9fd7ccae20400752792460cbd |
| 10 | C13-D5R1-S05 | B/Candidate16 | condition_unknown, vague_time | 7999b372aafa001b2515eec7f05ad16d4a43c448f87b7a35ca07c6edf833e8fe | dd295ed37305e34e502d3e11380b5cb3eed8235db5015e78ee649677ee02fe6e |
| 11 | C13-D5R1-S06 | B/Candidate16 | shared_material, dependency, multi | 3874c581083d9aad6da5b251a55eb70588b12c8d723e3ef5fe10d77ce82bd348 | 3348012fb33294bfbe71e285a6b4427c6fd26c8224d51df5c856605c2f2e8a7c |
| 12 | C13-D5R1-S06 | A/Candidate03 | shared_material, dependency, multi | 9f604ac913452dcbc598161464af5904ae7e225204be2a4a77842f1f65f8a60a | 5bfbd92c3025c7c9eaa5a66f077b73f9e7c6d5e66116f0e034216a61fcd474e3 |
| 13 | C13-D5R1-S07 | A/Candidate03 | vague_time, single | e3f0969bba1742997b42b683652883cbaec6ade5343ca576452783d74d4a1279 | 5a5e84cde1a094045682eff828ee3dba50f31fec226b3d8eea07888ab97070ea |
| 14 | C13-D5R1-S07 | B/Candidate16 | vague_time, single | a01e5a72eba86040bf60ca8e36c096b469dbda9c005c16b12c3b45555362ecbd | e0ba1a18134688c31ae94d0b98defc35bcfef258ce0d3f97b4c17ad9b2c8500e |
| 15 | C13-D5R1-S08 | B/Candidate16 | dependency, material, multi | 9383c386137301f00d08de1c6a2556a5ae476c93fdaa255d1a63bf36b2af436e | c852bf8c221f2e0313393eddfd83b5f8224f1d81b3d37d077ce66eb22cb2f94d |
| 16 | C13-D5R1-S08 | A/Candidate03 | dependency, material, multi | 5c4ef3d0a8eb1135cd3fa72cbb2c410091483aa300147f8ae4cef4248b9f61ee | 74f6833aeffdc1106e545adf64a70c0616b5196bca17ce1bea0d43e01e4a99ad |
| 17 | C13-D5R1-S09 | A/Candidate03 | no_task, forbidden, background | 0fceaf92a47463369c64b16f6d4b567c59cc3901cbb4d7f878a7b82b89176765 | b59e8466a135237251fdf438dcebf0a780d9b2952fe2b68137bfe6f3a9248b33 |
| 18 | C13-D5R1-S09 | B/Candidate16 | no_task, forbidden, background | 370368abc9197086f9e9d5d469923d852a605e0fbfc237368055bfa368265a01 | 0dca3b6212225f460f75d5a6a5b307453aa0d9e39dcea5339c0f260b663753d5 |
| 19 | C13-D5R1-S10 | B/Candidate16 | multi_endpoint_cancellation, historical | abaef4c5a900747f10931ce15db689f21d0a1b365dff0a63d768194b3cfaf023 | bcf3a5ababf1743e4e2735c40e234f30898334b2d556b6ca8ff8693a170ac501 |
| 20 | C13-D5R1-S10 | A/Candidate03 | multi_endpoint_cancellation, historical | d7875a3306e9d63317b1126ea77ba501d1a0e1d7639ea81b482a20a80f384760 | 3f5e2cdfb57d4bd265060223007373ac2a2eddda5eb41b3695770032747ea8e4 |
| 21 | C13-D5R1-S11 | A/Candidate03 | multi_endpoint_replacement, historical, multi | 476dab5c2738431d7a2610886722bbc50f4d2aafbeabf80ae4988c6c2bf0cd60 | e577b182a7267df0ca5e691c2d866b9848228883c1b1bc0e7e331fad0206a34d |
| 22 | C13-D5R1-S11 | B/Candidate16 | multi_endpoint_replacement, historical, multi | fd8a706049eebffc4534ef7cd805ca54fa46482a09c755b928e9180d5462fb4c | d5949ed71026f38ffe4d5405abcc989b965df8768e7ef1d66358f4ff533e1d9e |
| 23 | C13-D5R1-S12 | B/Candidate16 | completion_standard, forbidden | b1a7ffc12b8aebc46867b72ef1d1a183bb0a63a378d84d942b2197ffbb1d7ed6 | 0682c1ef0fb6a495d058a12752f1ab4122f9108f7394f4e40663556040898fc9 |
| 24 | C13-D5R1-S12 | A/Candidate03 | completion_standard, forbidden | 82d5c34f692c893d700ba9e12b6c4285a4daf5f148a00b2a3c246efe00d475c1 | 0b213f71178076a3c9143b86cd9260893720292ce62311fe30f01fd350bb35cf |

Manifest SHA-256：b60a6ee22ab1e8f53088ba34d7a2151bbce3f7c700aafa596097701456a5c167

身份文件 SHA-256：0a50d55fb8818cacf01319503df7d127fd1020adc1efcb726eb049ae59a5cbda

只准备，不授权；预算卡仍 BUDGET_UNRESOLVED。D11 录制诊断与这 24 个新身份是两组不同资料。
