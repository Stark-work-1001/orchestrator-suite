# 迭代记录 2.3.2

本次迭代**不改变运行时功能**，只修正发布形态并把脱敏固化为发布门禁。

## 动机

2.3.1 及之前的发布包包含单机信息：补丁入口与 `suite.config.json` 写死了本机绝对路径，
`DEPLOYMENT.md` 与 `docs/ITERATION-*.md` 记录了交付目录、profile 位置与会话标识，
`docs/installation.json` 与 `docs/plugin-audit.json` 则是完整的本机安装差异与插件清单。
`scripts/preflight.mjs` 会把 CLI 的 stderr 原样写入 `verification.json`，路径因此随包扩散。
发布流程本身没有任何隐私检查。

## 变更

**可移植性**

- `cordis.patch.yml` 的套件入口由绝对路径改为包名 `orchestrator-suite`，交由宿主从
  profile 的 `node_modules` 解析，包可安装到任意目录。
- 随包 `suite.config.json` 的 `memoryRoots` 与 `assetRoots` 置空，默认不做目录探查。
- 新增 `ORCHESTRATOR_SUITE_CONFIG`：部署方指向自己的配置文件即可指定目录，无需修改包内
  文件，升级不会覆盖配置。
- `scripts/preflight.mjs` 与 `scripts/install-symbolic.mjs` 移除内置本机默认路径，改为
  仅接受环境变量；前者未配置时如实记录 `status: "skipped"` 并以 0 退出，不伪造通过。
- `scripts/pack.mjs` 默认输出目录改为相对套件的 `../release`。

**脱敏与门禁**

- 新增 `scripts/privacy-scan.mjs`，16 条规则覆盖：Windows/UNC 绝对路径、POSIX 家目录、
  家目录环境变量、工具工作区目录、会话 UUID 与 `session-` 前缀标识、邮箱、手机号、
  身份证号、GitHub/模型 API 令牌、私钥块、Bearer 字面量、凭据赋值、非回环 IPv4。
- 接入 `verify`（第 6 项检查）与 `pack`（打包前硬门禁）。`pack` 的暂存内容与被扫描的文件
  列表来自同一函数，打包后再解包复扫一次——门禁结果因此不可能描述另一份文件集。
- `verify.mjs` 与 `preflight.mjs` 在写入报告前用 `scrub()` 脱敏工具输出。
- JSON 与 `.map` 在**解码后**扫描，避免转义序列被误判为 UNC 路径。
- 扫描器扫描自身源码并要求零命中。规则只描述敏感数据的形状，不写入任何具体工作站的值；
  两处家目录环境变量记号以分片书写，避免自身源码包含其检测字面量，
  编译后的规则不变，因此不影响对其他文件的检测强度。

**文档**

- `DEPLOYMENT.md` 重写为可复现的部署方法与验证边界，去除机器绑定记录。
- 删除 `docs/installation.json`、`docs/plugin-audit.json`，并加入 `MACHINE_BOUND` 排除集，
  即使本地重新生成也不会被打包。
- `README.md` 更新安装说明与配置方式，标注 2.3.2 为可移植性修订。
- `LICENSE` 去除本机路径，保留上游署名。

## 验证

发布流程内自动完成：类型检查、生产构建、21 项自动回归、自包含依赖解析、隐私扫描、
打包后逐文件哈希比对、解包复扫与入口模块加载。

**未**验证：补丁应用后运行中是否生效、真实裁判调用、明暗主题渲染、移动端宽度。
这些需要真实宿主与浏览器入口，不在发布流程内，也不得由打包成功推断。

## 已知取舍

- 空的 `memoryRoots`/`assetRoots` 意味着默认不做目录探查。这是刻意的失败关闭：默认值不应
  指向某台机器的目录。使用者通过 `ORCHESTRATOR_SUITE_CONFIG` 自行开启。
- `tests/runtime.test.mjs` 中的 `http://user:password@127.0.0.1:...` 是用于验证"拒绝带凭据
  URL"的伪造夹具，不是泄露的密钥。扫描器对回环地址的凭据规则做了有记录的豁免，
  真实凭据仍会被拦截。
