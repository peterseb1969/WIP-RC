---
session_id: APP-RC-20261018-224716
role: APP-RC
started_at: 2026-10-18T22:47:16
status: closed
continues_from: APP-RC-20261012-143854
ended_at: 2026-10-19T22:59:08
---

# Session APP-RC-20261018-224716

Continues from APP-RC-20261012-143854 (via /wip-wake).

## Session Summary
**Duration:** 2026-10-18 22:47 – 2026-10-19 22:59 (one context window)
**Commits:** 30 (16 substantive, the rest report logs), all pushed; working tree clean; master `f433fc0`
**Lines:** +2442/-444 across 76 files (ee9ec6e..HEAD; includes the scaffold refresh)
**Phase:** 4 — /wip-improve (E2E coverage, bug fixes, lib adoption)

**What happened:**
- **E2E phase 1 finished, then extended to every page.** Started at 25 tests and 3 groups. Now 14 specs, 63 tests, ~2.1 min on an idle wip-local:
  - smoke, lifecycle, imports, namespaces, relationships, reporting;
  - versioning, access, files, api-keys, registry, validation, integrity, infra.

  Design and reasoning are written up as **FIRESIDE-32** (`report-e2e-testing-design.md`) for other app-YACs.
- **Writing the suite surfaced and fixed ten RC bugs:**
  - `cbc9779` **Wrong-namespace writes:** document pages resolved templates by value with no namespace. On wip-local, "New document" for dev-proj-a's CASE_RECORD loaded kb's template and would have written into kb. Also: the list lost its selection when served from cache, and the import never refreshed the list.
  - `305860f` The template editor called an identity change "safe", but the platform rejects it on draft and active templates alike; the identity selector is now locked. Version chips were stale for 60 s.
  - `2a23958` CSV export failures were only logged to the console. Now shown to the user.
  - `b4deeec` CASE-888: unknown API routes returned 200 HTML; now 404 JSON.
  - `01349b4` File fields with wildcard `allowed_types` (`text/*`) refused every file: the check was a literal includes().
  - `5541416` Registry synonyms added in RC never resolved: RC sent singular entity types, the registry uses plural.
  - `695fedc` An edit conflict showed only "Expected version 1, current is 2": RC sniffed the message text instead of reading `error_code`.
  - `810ca72` The production image downloaded an unpinned tsx via npx at every pod start. tsx 4.21.0 is now a pinned runtime dependency.
  - Plus label/`role="alert"` accessibility fixes across forms.
- **Libraries:** scaffold refresh `f6c9bee` → @wip/client 0.61.0, @wip/react 0.21.0. `2a23958` adopts CASE-898 (`reporting.getParity` / `exportTableCsv` / `exportQueryCsv`) and CASE-905 (namespaced `useTemplateByValue`, `useTriggerBatchSync`).
- **Deploys:** Peter built and rolled RC images. I verified each from inside the pod on dev-test, prod-test and kb.internal:
  - `20261018c` (from e4fec53);
  - `20261019a` (from c302180; contains every fix above).

**WIP interactions:**
- **Filed:** CASE-905 (@wip/react by-value hooks ignore namespace; implemented in 0.21.0). CASE-908 (registry synonym entity_type is unvalidated).
- **BE-YAC on CASE-908:** the real defect is caller-supplied synonym namespace/type. Probing it found that registry writes do no namespace authorization at all → **CASE-910 (open)**.
- **Comments:** 905#3 (`BatchSyncAllVars` lacks `namespace`), 898#3 (consumer check), 888#3 (RC done), 908#3 (0 scope-mismatched synonyms on all four installs, validated with a planted control).
- **Platform facts learned by probing:**
  - identity_fields are immutable even on drafts;
  - reference-field `target_templates` is stored as resolved ids on new templates (kb's older edge types hold bare values);
  - new API keys take ~14 s to be accepted, revocation ~28 s;
  - the integrity check scans all documents (~25 s on wip-local);
  - registry lookups match entity_type exactly;
  - `/wip/api/<unknown service>` returns 200 HTML from the platform.

**Dead ends / corrections:**
- **Checking that a spec fails on the old code, and where that fell short.** For each fix I stashed it and ran the spec on the old code. Twice it showed the test proved less than it seemed:
  - the relationships spec passed on the old picker (new templates store ids), so that fix rests on unit tests;
  - the access spec was not run against pre-fix server code (it would restart the dev server and drop the in-memory Anthropic key).
- **Playwright on CodeMirror:** `fill()` leaves the completion list open over the buttons below; press Escape. Verified with real typing that users don't hit this.
- **Overclaims caught before publishing:**
  - FIRESIDE-32 first credited the suite with bugs found by hand or by CASE-888;
  - an unverified README claim was removed;
  - I first told Peter the namespaced CSV export might 422 on k8s; it returns 200.
- **Ambiguous root cause:** the API-keys spec's first 401 can't be attributed. The locator read the wrong `<code>`, and I added the propagation wait at the same time.

**Downstream impact:**
- **Infra:**
  - wip-local's podman VM hung once after a full run (cause unknown). After Peter restarted the machine, `wip-caddy` (the 8443 ingress) stayed Exited until `podman start wip-caddy`.
  - `.mcp.json` is no longer tracked (`946cab0`). The other machine loses its copy on pull: restore with `git show 740a6a7:.mcp.json > .mcp.json` or re-run the scaffold.
- **Test artifacts:** Playwright failure logs in `test-results/` contain the deploy API key in request headers (gitignored; documented in README).

**Unfinished:**
- **Platform-gated:**
  - CASE-908 / CASE-910 fixes (BE-YAC). When they ship, RC's synonym form can drop its namespace/type pickers and must surface `synonym_scope_mismatch` / `merge_scope_mismatch`.
  - CASE-905#3 (`BatchSyncAllVars` namespace type): no reply yet; RC keeps its own sync-all mutation.
  - CASE-888 waits on the other apps.
- **Peter's call:** wip-local kb edge types serve `resolved: null` (rerun the heal, or did data change?).
- **Unverified loose ends:**
  - DocumentTablePage maps any 500 to "enable reporting sync";
  - two one-off E2E flakes (Dashboard 500 after a redeploy; a lifecycle blank page after the machine restart);
  - the podman hang.
- **Backlog (KNOWN_ISSUES):** reference picker first-target/50, term picker 1000, nested-object arrays, NL Query, Mongo aggregation, ontology graph, bundle size, E2E has no CI.

**For the next YAC — handover:**
1. **Start:** `/wip-wake`, then `git fetch` and compare origin/master (a clone was once 37 commits behind). Read this summary, `commits.md` (per-commit detail with "Discovered" notes) and `session-updates.md`. The wip MCP server should now start on this machine, because `.mcp.json` is local and has /Users/peter paths.
2. **Tests:**
   - `npm test` → 189 unit tests.
   - `npm run test:e2e` → 63 tests, ~2.1 min. Run it with `run_in_background` (the Bash cap is 60 s), on an idle install, after `nc -z localhost 8443`.
   - Prerequisites: users `e2e@wip.local` (wip-admins) and `viewer@wip.local`; `ALLOWED_GROUPS=wip-admins` on RC; secrets in `~/.wip-deploy/wip-local/secrets/`.
   - Specs are self-contained: one disposable `rc-e2e-<stamp>` namespace plus `<stamp>-twin` per run, cleaned up by setup and teardown. Read the run state lazily (in `beforeAll`), not at describe time.
3. **Writing specs (FIRESIDE-32 has the reasons):**
   - UI for the behaviour under test; API for fixtures and outcome checks.
   - Fixture helpers check per-item results (`createTemplate` / `createDocuments`).
   - `eventually()` for reporting-sync and key-cache propagation.
   - Probe the platform in a throwaway `rc-e2e-probe` namespace (deletion_mode full; delete it after) before asserting its behaviour.
   - Stash the fix and confirm the spec fails on the old code.
   - Fix a missing accessible name in the app rather than reaching for CSS selectors.
   - Set URL-synced filters via the URL.
   - On CodeMirror: `fill()` + `press('Escape')`, then click the button.
4. **Dev container:** the `--app-source` container mounts this clone (Express 3011, Vite 5174, /apps/rc/). Restart it after dependency changes; a restart drops the in-memory Anthropic key (ask Peter before NL live tests). If WIP is unreachable after a podman machine restart, check `wip-caddy`.
5. **Deploy verification:** Peter builds (`gh workflow run build.yaml --repo peterseb1969/WIP-RC --ref master -f tag=YYYYMMDDx`) and rolls. Then verify from inside each pod (`kubectl -n <dev-test|prod-test|kb> exec`, node fetch with X-WIP-User/X-WIP-Groups headers):
   - image tag and digest; `tag_overrides.react-console` in the deployer state;
   - none/viewer/admin → 401/403/200;
   - missing API route → 404 JSON;
   - MongoDB, NATS, health;
   - no "will be installed" line in the log;
   - fix strings present in `/app/dist/assets`.

   The script pattern is in `session-updates.md` (20261019a entry).
6. **Conventions:**
   - Pin npm deps exact, ≥2 weeks old.
   - Log every commit in commits.md.
   - No case tokens in user-facing text.
   - Verify before asserting: this session's corrections all came from checking.
