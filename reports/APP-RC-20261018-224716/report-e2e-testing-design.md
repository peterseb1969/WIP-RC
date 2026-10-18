---
session: APP-RC-20261018-224716
type: fireside
topic: E2E testing design for WIP apps — RC's Playwright suite
time: 2026-10-19 00:15
participants: Peter, APP-RC-20261018-224716
---

## Context

RC (the React admin console) now has an end-to-end suite: 48 Playwright tests in 9 specs, about 50 s against a local WIP install (wip-local). APP-RC-20261012-143854 built the foundation and the first three groups. This session added imports, relationships, reporting, same-named templates across namespaces, template versioning and access control.

Peter asked for the whole design and its reasoning to be written down so that other app-YACs can comment on it and copy it. It is written for an app-YAC that has a WIP app and no browser tests yet. Everything named here is in WIP-RC (`tests/e2e/`, `playwright.config.ts`), master `aa4414e`.

The headline result first, because it is the reason to bother. Writing and running the suite surfaced **eight bugs** the 183 unit tests had not caught:
- **Data at risk:** the document pages wrote into another namespace when a template value existed in two namespaces.
- the template editor called an identity change "safe", which the platform always refuses (found by probing the platform while writing the versioning spec);
- the document list showed 0 documents after a successful import;
- the list lost its selection when data came from cache;
- the version chips went stale for a minute;
- a dev-proxy rule swallowed the `/api-keys` page route (previous session);
- inputs and buttons without accessible names: document form labels, the field slide-out's close button (previous session), and the view editor's labels.

Found in the same period by other means, and now guarded by the suite or a production-build check:
- a viewer could write through the app's admin-key proxy (found by hand; the access spec now covers it);
- a failed CSV export was invisible to the user (found reading code during CASE-898);
- unknown API routes answered with HTML (CASE-888).

## Options Considered

**Where the tests run**
- *Against a mocked backend (MSW, fixtures).* Rejected. RC's job is to show what WIP really does. A mock encodes our *assumption* of WIP, and assumptions about WIP are exactly what break: identity hashing, bulk 200s with per-item errors, namespace resolution, `versioned: false`. Several bugs above were only visible against the real platform.
- *Against a per-run disposable WIP install in CI.* The ideal, but heavy: a full stack per run. Deferred as "phase 2, not planned".
- **Chosen: the developer's local install (wip-local), through its real router and real auth gateway.** The app under test is the `--app-source` dev container serving the working tree. A run tests the code on disk, behind the same Caddy, Dex and gateway headers as production. Phase 1 is local only, by Peter's decision (recorded in APP-RC-20261012-143854's commits.md for `bf8eb21`).

**How tests get their data**
- *Shared seeded namespace.* Rejected: tests interfere, and old data hides bugs.
- **Chosen: one disposable namespace per run** (`rc-e2e-<timestamp>`, `deletion_mode: full`), created in global setup and deleted in teardown. Global setup also deletes any leftover `rc-e2e-*` namespace, so an aborted run cleans up after itself on the next start. Since this session there is a second one, `<run>-twin`, for checks that a same-named entity in another namespace is *not* picked up.

**What drives each step**
- *Everything through the UI.* Slow, and brittle for setup that isn't the subject of the test.
- *Everything through the API.* Then it isn't an end-to-end test of the app.
- **Chosen: the UI for the behaviour under test, the WIP API for fixtures and for checking outcomes.** The rule is written in `support/wip.ts`: "Tests use it to create and remove their own data, never to drive what the UI is supposed to do." Example: the relationships spec creates the person template and documents through the API, then builds the edge type in the Template Builder and creates the edge through the form.

**Who logs in**
- *Bypass auth (headers, dev mode).* Rejected: it skips the gateway, which is where RC's access bug lived.
- **Chosen: a real Dex login, once per run in global setup, saved as Playwright `storageState`.** The user is `e2e@wip.local` in `wip-admins`, created with `wip-deploy user add`. The access spec logs in a second user (the deployer's default `viewer@wip.local`) in its own fresh session.

## Decision

### Layout

```
playwright.config.ts          serial, 1 worker, baseURL = RC behind the router
tests/e2e/
  global-setup.ts             clean stale rc-e2e-*, create <run> and <run>-twin, Dex login → storageState
  global-teardown.ts          delete both namespaces
  support/env.ts              all settings, env-overridable; secrets read from ~/.wip-deploy/<deployment>/secrets/
  support/wip.ts              API context with the deploy key; getJson/postJson; eventually();
                              createTemplate / createDocuments / templateId (check per-item results)
  support/login.ts            one Dex form login, shared by setup and the access spec
  smoke.spec.ts               17: health endpoints + every sidebar page
  lifecycle.spec.ts           6: terminology → term → Template Builder → form → edit (v2) → archive
  imports.spec.ts             3: terminology CSV (new + into existing), document CSV wizard
  namespaces.spec.ts          3: same template value in two namespaces
  relationships.spec.ts       3: edge type, edge via endpoint pickers, Relationships panel
  reporting.spec.ts           6: Query Pad, CSV exports, Table Browser, Parity, views, forced Batch Sync
  versioning.spec.ts          4: v2 with v1 still active, pinned docs, deactivate/reactivate, identity lock
  access.spec.ts              4: ALLOWED_GROUPS with a viewer login (403s, refused write), admin control
  infra.spec.ts               2: MongoDB query pad incl. $where refusal, NATS identity
```

### Principles, with the reasoning

1. **Real platform, real auth, real router.** `baseURL` is `https://localhost:8443/apps/rc/`, not the Vite port. Path prefixing (`BASE_URL`), the gateway's identity headers, `ALLOWED_GROUPS` and the `/wip` proxy are all on the path a user takes. The access spec could only exist this way.

2. **Disposable namespaces, deleted for real.** `deletion_mode: full` means teardown removes everything, and nothing accumulates on the developer's install. Every spec writes only inside `run().namespace`. Global setup deletes leftovers by prefix, so a killed run costs nothing.

3. **Serial by design, and self-contained specs.** `workers: 1`, `fullyParallel: false`, `mode: 'serial'` inside a spec. Steps in a spec build on each other: the lifecycle spec's edit test opens the document the create test made. Specs do not depend on one another, though. Each creates its own fixtures under its own values (`E2E_ITEM`, `E2E_IMPORT_ITEM`, `E2E_METRIC`, …), because Playwright runs files alphabetically and a spec should pass alone with `-g`.

4. **Read run state lazily.** Test files are collected *before* global setup writes `.run.json`. A `run()` at describe level reads the *previous* run's namespace without complaint. Read it inside `beforeAll` or the test.

5. **Assert twice: in the UI, and against the API where the UI could mislead.** The UI showing "Second title" doesn't prove version 2 exists. `GET /documents/{id}` → `version: 2` does. Most bugs above were caught by the API half: the namespace write, `template_version` per document, both template versions active.

6. **Fixture helpers respect PoNIF #4 (bulk-first 200).** Template and document creates answer HTTP 200 even when the item failed. `createTemplate` / `createDocuments` check `results[i].status` and throw with the item's error. Plain `postJson` would turn a failed fixture into a mysterious UI failure three steps later.

7. **`eventually()` for the asynchronous parts of the platform.** reporting-sync applies events asynchronously. The reporting spec polls `/query` until the rows are there (60 s cap) instead of sleeping. The same goes for a forced Batch Sync job reaching `completed`.

8. **Every new spec must be able to fail on the old code — and you check that it does.** When a spec accompanies a fix, I stashed the fix, ran the spec against the old code, saw it fail, and restored. The namespace spec failed on the old pages (they loaded the twin's template). Two of three new VersionWarnings unit tests failed on the old component.

   Twice it showed the test proved less than it looked. The relationships spec passed on the old picker: the platform now stores endpoint `target_templates` as ids, so the bug only affects older edge types, and that fix is covered by unit tests instead. The access spec was *not* run against the pre-fix server, because that would restart the dev server and drop its in-memory Anthropic key. That gap is written down rather than hidden.

9. **Probe the platform before you assert its behaviour.** Before writing assertions for versioning and identity, I created a throwaway `rc-e2e-probe` namespace and called the API directly. Result: a schema change gives v2 with v1 still active, and an identity change is refused on drafts *and* active templates. The editor claimed the opposite, which is how that bug surfaced. The same applies to CSV export behaviour and to the stored shape of `target_templates`. A test written from what you believe the platform does will happily pass against a UI that shares the same wrong belief.

10. **Selectors: roles and labels first; when you can't, fix the app.** `getByRole` / `getByLabel` / `getByPlaceholder`, then structure (`locator('form', { has: … })`) for repeated inputs. When a control had no accessible name, the fix went into the app, not into a CSS selector: document form labels (`ffcc943`), the field slide-out's close button, the view editor's labels, `role="alert"` on error states and on the new export errors. Accessibility and testability turn out to be the same work.

11. **Know what is an automation artifact, then check it by hand.**
    - Typing into URL-synced inputs drops characters under automation. Set those filters through the URL (`?find=`).
    - On CodeMirror, `fill()` works but leaves the completion list open over the buttons below it. Press Escape after `fill()`. I confirmed with real `keyboard.type` plus a click that users don't hit this.
    - `press('ControlOrMeta+Enter')` did not run the editor's action; click the button.

    The rule: before calling something a bug or an artifact, reproduce it the way a person would.

12. **Smoke is cheap and catches lib bumps.** Every sidebar page renders its `h1`, shows no `role="alert"`, and logs no `pageerror` or console error after `networkidle`. This is the first line of defence when `@wip/*` tarballs change.

13. **Mind what the dev container is and isn't.** wip-local's RC is a Vite dev server. The SPA shell renders for anyone, and only the server routes enforce `ALLOWED_GROUPS`; the production image also gates the shell. Production-only behaviour (static serving, the CASE-888 API 404) is verified separately: build the production image locally and run it with `--network none` through a curl matrix.

### How to run

```
npm run test:e2e                     # all; ~50 s
npx playwright test reporting        # one spec (fixtures are per spec)
npx playwright test -g "Batch Sync"  # one test
```

Run it in the background from an agent (Bash's 60 s cap). Before waiting, check that the router port is up (`nc -z localhost 8443`). HTML report, traces and failure screenshots go to `test-results/e2e/`. The trace's action log names what intercepted a click; that is how the CodeMirror overlay was found.

**Prerequisites:**
- the e2e user: `wip-deploy user add e2e --email e2e@wip.local --group wip-admins --name wip-local`;
- `ALLOWED_GROUPS` set on the install, for the access spec;
- secrets in `~/.wip-deploy/<deployment>/secrets/`: `dex-password-e2e`, `dex-password-viewer`, `api-key`. The access spec skips its viewer checks if the viewer password is absent.

**After a dependency change:** restart the dev container (its `npm ci` is lockfile-hash-gated) before running.

### To copy into another app

1. `@playwright/test` pinned exact, `channel: 'chrome'` (system Chrome; no browser download).
2. Copy `playwright.config.ts` and `tests/e2e/support/*`, and set `E2E.baseURL` to your app's `/apps/<name>/`.
3. Copy `global-setup.ts` / `global-teardown.ts`, and change `NAMESPACE_PREFIX`. The setup creates namespaces with the deploy key. If your app *owns* a namespace and bootstraps it (BootstrapGate), point your tests at a disposable copy, never at the real one.
4. Start with smoke (your sidebar paths and headings), then your app's core write path, UI plus API check.
5. Add the twin-namespace pattern if your app resolves anything by value. Anything taking a template value, terminology value or `ns:VALUE` can pick the wrong namespace under a multi-namespace key.

## Deferred

- **CI (phase 2).** Needs a WIP install per run; not planned. The suite runs locally before image builds.
- **Not yet covered in RC:** files (upload, file field, orphans, delete), the API Keys and Registry pages, form validation errors, the Integrity page.
- **Excluded by decision:** NL Query (needs an Anthropic key and isn't deterministic) and backup/restore (destructive, slow).
- **The access spec** has not been shown to fail on the pre-fix server (see principle 8).
- **One unexplained flake:** a Dashboard smoke failure (one request 500) right after an unrelated wip-local redeploy. It didn't reproduce in later runs, and its trace was overwritten.
- **Deployed installs** (dev-test, prod-test, kb.internal) are checked by in-pod probes after each roll, not by this suite.

## Peter's Voice

- "do 1 - we will roll to other deployments once you are done with that" — the E2E groups were finished before the next image roll, and the roll then carried the fixes the suite found.
- "are you ok with the coverage of the test you have written, or are there still some to be done?" — this led to the versioning and access specs, and to two more fixes.
- "can you describe your whole e2e testing design and reasoning in a fireside, so that other app-YACs can comment / copy?"

## Impact

- **For RC:** the suite is now the gate before an image build. Most of the new groups surfaced a bug unit tests had missed, so the remaining gaps are worth filling.
- **For other apps:**
  - The pattern is copyable as-is: real install, disposable namespaces, UI plus API, checked fixtures, `eventually()`, fail-on-old-code.
  - The twin-namespace check is the one most likely to find something elsewhere. Any app that resolves templates by value under a multi-namespace key had the CASE-905 exposure.
  - CASE-888 (API routes falling through to the SPA) is checked the same way: production build, curl matrix.
- **For the platform:**
  - The suite turned into library feedback: CASE-905 (`useTemplateByValue` without a namespace; then the `BatchSyncAllVars` type gap, CASE-905#3) and consumer verification on CASE-898.
  - Probing the platform before asserting surfaced two facts apps should know. A reference field's `target_templates` is stored as resolved template ids on templates created now; older ones, such as kb's edge types, still hold bare values. Identity fields are immutable on drafts as well as active templates. RC's editor had assumed otherwise, and other apps' template editors may too.
