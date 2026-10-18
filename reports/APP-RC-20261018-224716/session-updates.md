# Session Updates — APP-RC-20261018-224716

## 2026-10-18 23:00 — wip-local redeployed mid-run (not by this session)
During the reporting spec, WIP answered 502: the core containers were stopped and recreated (template-store "Stopping", others "Created"). Back after ~40 s with 20 wip-* containers; the RC dev container was recreated too (same clone mount). The run's teardown got 502, and the next run's global setup removed the leftover rc-e2e-* namespaces. The first full run after the redeploy had one smoke failure (Dashboard: one resource 500); it did not reproduce in two re-runs (smoke 17/17, full 36/36). Its trace was overwritten by the re-run, so the failing request is unknown — most likely a service still warming up, but unverified.

## 2026-10-18 23:10 — Open: case for @wip/react useTemplateByValue
useTemplateByValue takes no namespace and its query key ignores namespace; RC works around it (use-route-template.ts). Not filed yet — asked Peter whether to file it for the lib owner.
