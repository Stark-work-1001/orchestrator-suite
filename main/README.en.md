# Orchestrator Suite 3.0.3

[简体中文](README.md) · [Changelog](CHANGELOG.md) · [Release notes](docs/RELEASE-NOTES-3.0.3.md)

An advisory orchestration suite for DeepSeek Harness: a capability board, compact progress indicator and its own **调度编排模式 / dispatch-orchestrator** preset. Models report their understanding before executing; users can inspect phase diagrams, step reports and actual evidence.

## Preset scope

| Active preset | Behavior |
| --- | --- |
| dispatch-orchestrator | Three phases and eleven steps, with visible understanding, evidence, requirement changes and todo history |
| Any other preset | One initial comparison of registered tools, verification, collaboration and identity; report the understanding, then show only “Orchestrated” in the indicator |

Ordinary presets use relic_prepare and relic_result once. The indicator stays “Layer comparison” until the model submits a real result. Follow-ups do not start a dispatch workflow. Switching presets uses the host’s current selection, without changing other plugins’ dispatch presets.

## Three phases

1. Planning: original prompt, triage, four registered layers, actual third-party evaluation and integrated understanding/execution plan.
2. Execution reaction: assess supplements, update or explicitly retain todos, and record deeper execution insights.
3. Delivery verification: trace all requirements to results, attempt current-session acceptance, state the outcome and separate project gaps/problems/suite feedback.

Steps require inspection and public understanding, while execution choices remain advisory. The compact indicator opens into phase/step diagrams and evidence; missing assessments, no-change decisions, modifications and failed attempts are distinct.

Use dispatch_plan, dispatch_review and dispatch_commit for planning; dispatch_adjust, dispatch_refine and dispatch_checkpoint for incremental execution. dispatch_delivery attempts verifier_current_session; dispatch_conclude records completion, implementation, overall effect and limitations. Understanding and conclusions enter system context and the progress view; the model must also tell the user, since system context is not automatically a visible chat message. dispatch_report records stage/identity reports and dispatch_export preserves the full task history. State is in memory; export before restarting.

## Plugin cooperation

The suite owns only its tools, routes, UI and preset. It adds no competing plan mode/delegation engine or tool deny list, and never changes external plugins. Team, memory, skill, MCP and identity tools remain governed by the host and active preset. Discovery is not evidence of successful execution.

The mounted dsh-llm-verifier remains independent. Board controls select this task’s planning tool route/repeats; the original verifier owns judge configuration and returns actual models/evaluations. Missing tools, failures, cancellation and stale results remain explicit. Scores do not imply acceptance.

## UI stability in 3.0.3

Each mounted slot owns its stylesheet, avoiding shared-style deletion by an old mount. Explicit control styles, single-line labels, responsive width limits and viewport-bound details keep the header compact. No extra native process or Rust wrapper is required for this style-lifecycle/layout repair.

## Install and develop

Node.js ≥22.19; DSH >=0.2.1-0 <0.3. Work from main/ in this repository. Distribution archives are self-contained plugin directories.

~~~sh
npm install
npm run verify
node scripts/pack.mjs <output-directory>
~~~

Install through DSH’s local bundle workflow. The upgrade script changes only suite distribution files and preserves configuration/rollback copies. See [deployment](DEPLOYMENT.md). Composition checks, fixtures and disk installation do not prove live host activation; reload through the host’s supported workflow and check the actual version.

MIT. Dependencies retain their own licenses; see [LICENSE](LICENSE).
