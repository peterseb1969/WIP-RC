# Session updates — APP-RC-20261028-145029

## 2026-10-28 15:10 — Stale API-key path; instance on :8443 is now the `default` deployment
`.claude/kb.json` (`kb_api_key_file`) and `.env` (`WIP_API_KEY_FILE`) pointed at `~/.wip-deploy/wip-local/secrets/api-key`, which the running instance rejects (HTTP 401 "Invalid API key") — this was also why the wake's kb mirror failed. The key under `~/.wip-deploy/default/` returns 200. Both paths were repointed to `default` (path only; Peter approved). The instance behind :8443 is a different, fresh install: its KB numbering restarts (cases 001–008 here vs CASE-9xx on the old wip-local KB) and namespaces differ (`pbs-clintrial*` instead of `dev-pbs-clintrial*`, no `dnd`/`clintrial`). Case numbers cited in earlier session reports refer to the old KB.

## 2026-10-28 15:10 — CASE-8 filed: rehash-identities in @wip/client
Filed to BE-YAC (type request, component wip-client): expose `POST /api/document-store/maintenance/rehash-identities` as a `DocumentStoreService` method plus an `@wip/react` hook, and document dry-run/scope/job/permission/collision behaviour. RC's rehash action is blocked on the shape; workaround is raw fetch through the `@wip/proxy` route.

## 2026-10-28 15:10 — E2E cannot run on this install
`tests/e2e/support/env.ts` reads `~/.wip-deploy/default/secrets/dex-password-e2e` (and `-viewer`); neither exists in the `default` deployment, so global setup cannot log in. Parity tab change (per-namespace Check) is verified by tsc + unit tests only; Peter eyeballed it in his own browser and reports it looks good. The reporting E2E parity spec was updated but not run.
