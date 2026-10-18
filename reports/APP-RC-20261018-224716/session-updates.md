# Session Updates — APP-RC-20261018-224716

## 2026-10-18 23:00 — wip-local redeployed mid-run (not by this session)
During the reporting spec, WIP answered 502: the core containers were stopped and recreated (template-store "Stopping", others "Created"). Back after ~40 s with 20 wip-* containers; the RC dev container was recreated too (same clone mount). The run's teardown got 502, and the next run's global setup removed the leftover rc-e2e-* namespaces. The first full run after the redeploy had one smoke failure (Dashboard: one resource 500); it did not reproduce in two re-runs (smoke 17/17, full 36/36). Its trace was overwritten by the re-run, so the failing request is unknown — most likely a service still warming up, but unverified.

## 2026-10-18 23:10 — Open: case for @wip/react useTemplateByValue
useTemplateByValue takes no namespace and its query key ignores namespace; RC works around it (use-route-template.ts). Peter approved; filed as CASE-905 (01a150d5-e26c-7843-916d-b4d7d43cfd9b), target BE-YAC. useFormSchema has the same flaw.

## 2026-10-18 23:47 — RC 20261018c verified on dev-test, prod-test, kb.internal
Peter built react-console:20261018c from e4fec53 (run 39168163530) and rolled it to all three k8s installs; deployer state pins react-console=20261018c on each. Every pod runs digest sha256:db40c711…, NODE_ENV=production, ALLOWED_GROUPS=wip-admins. From inside each pod: health 200 for all; app-config, /wip proxy and SPA root give none=401 / viewer=403 / admin=200; viewer POST through the proxy 403. MongoDB 4 databases ok as react-console, $where 400; NATS connected as react-console 2.15.1; services healthy (dev-test ingest-gateway inactive, not deployed). Streams WIP_EVENTS: dev-test 95, prod-test 111, kb 179. Each pod still fetches tsx@4.23.15 via npx at start; fixed in 810ca72 for the next image.
