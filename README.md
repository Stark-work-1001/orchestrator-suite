# Orchestrator Suite 3.0.3

[简体中文](main/README.md) · [English](main/README.en.md) · [版本记录 / Changelog](main/CHANGELOG.md)

DSH 编排提示套件，提供看板、进度状态栏和自建“调度编排模式”。模型先汇报理解，再执行；阶段、步骤和证据可展开查看。其他 Agent 预设仅开始时一次多层对照，完成后显示“已经编排”。套件不限制其他插件或更改其调度预设。

An advisory orchestration suite for DSH, with a capability board, compact progress and its own dispatch preset. Models report understanding before execution, with inspectable phase/step evidence. Other presets receive one initial layer comparison and an “Orchestrated” indicator. Other plugins and their presets remain independent.

- main/: source, built assets, bilingual documentation and version history / 源码、构建产物、双语说明和版本记录。
- release/: distributions, checksums and release notes / 发行包、校验和与发布说明。

## 3.0.3

修复共享样式清理和布局劣化，限定三阶段范围，移除重复计划/委派服务及工具过滤。Fixes style lifecycle/layout regressions, scopes the three-phase workflow and removes competing planning/delegation services and tool filters.

[发布说明 / Release notes](release/orchestrator-suite-3.0.3.release-notes.md) · [下载 / Download](release/orchestrator-suite-3.0.3.tar.gz) · [SHA-256](release/orchestrator-suite-3.0.3.tar.gz.sha256)

61 regression tests and CLI composition checks passed. Fixtures and disk installation do not establish live host activation. From main/, install dependencies and run npm run verify. Distribution archives include dependencies. See [deployment](main/DEPLOYMENT.md) and [licenses](main/LICENSE).
