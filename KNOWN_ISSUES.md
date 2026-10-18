# RC-Console — Known Issues

## Open Issues

### Registered views: edits to app-owned views are overwritten by the app
**Status:** known (by design)
**Severity:** low
**Description:** Apps re-register their views on every bootstrap. Replacing an app-registered view from the Views tab lasts only until that app next starts.
**Context:** This is the platform's intended lifecycle. The Views tab detects views whose `registered_by` isn't this console and shows a warning in both the detail and edit views. RC stamps its own saves `rc-console:<user>`.

### Registered views: listing can be stale after a Vite hot-reload (dev only)
**Status:** known
**Severity:** cosmetic
**Description:** In `npm run dev`, a hot-reload of the views hooks module can leave the Views tab's listing showing the previous definition after a save, while the row preview is current. A normal page load does not reproduce it, and it was verified clean on reload.
**Context:** A development artifact of module hot replacement, not a production issue.

### Edge-type endpoint picker offers only the edge's own namespace
**Status:** known (by design)
**Severity:** low
**Description:** The Source/Target template pickers in the template builder list only entity and reference templates in the edge type's namespace.
**Context:** An edge document's `source_ref`/`target_ref` must resolve within the edge's own namespace (the platform rejects cross-namespace edges), and a bare value resolves only there. Endpoints that don't exist in the selected namespace (e.g. a duplicate retargeted to another namespace) are listed ticked with "not in <ns>" so they can be removed.

### Document form: reference picker queries only the first target, at most 50 candidates
**Status:** known
**Severity:** low
**Description:** `DocumentRefPicker` (`src/components/documents/ReferenceFieldInput.tsx`) only queries the first entry in `target_templates` — templates allowing several targets offer candidates from the first only — and loads at most 50 candidate documents.
**Context:** Merging several `useDocuments` queries and adding search are the fixes. (Target resolution used to run against a 100-template list and could find nothing on installs with more templates; fixed 2026-10-12 — every all-templates list now fetches the API maximum of 1000.)

### Document form: term fields load at most 1000 terms
**Status:** deferred
**Severity:** low
**Description:** `TermFieldInput` loads up to 1000 active terms from the referenced terminology (the API's page maximum). Larger terminologies have unreachable terms in the picker.
**Context:** The cap was raised from 100 (comment and the "showing the first N" notice now match, 2026-10-12). Beyond 1000 a debounced scoped search is needed; the pattern exists in `TermSearchPicker`.

### Document form: nested-object arrays are read-only placeholders
**Status:** deferred
**Severity:** low
**Description:** Array fields whose items are nested template objects (`array_template_ref` set, `array_item_type` unset) render a gray "Nested object arrays aren't editable in the form view yet" notice (`ArrayFieldInput.tsx`). Encountered on `aa.AA_CHARACTER.relationships`.
**Context:** Editing them needs a per-item sub-form with its own dirty tracking and validation. Until then, edit via the API, MCP tools, or a JSON tool.

### Document form: file uploads orphan on form abandonment
**Status:** known
**Severity:** low
**Description:** A file uploaded into a `file` field stays in storage with `reference_count = 0` if the form is cancelled or abandoned.
**Context:** The Files page flags orphans (`reference_count === 0` / status `orphan`) for manual cleanup. Possible fixes are tracking pending uploads and prompting on unload, or a server-side TTL on unreferenced files.

### Document form: object fields use a JSON textarea
**Status:** known (by design)
**Severity:** cosmetic
**Description:** Object-type fields render as a plain textarea with JSON parse validation, not a keyed form (`ObjectFieldInput.tsx`).
**Context:** This is an admin tool. The textarea is enough for users who understand the JSON structure.

### NL Query needs an Anthropic key
**Status:** known
**Severity:** low
**Description:** The NL Query page shows an "unavailable" notice unless `ANTHROPIC_API_KEY` is set, or a key is provided at runtime on the API Keys page (held in memory only, lost on restart). wip-local currently has neither, so the agent's end-to-end behaviour, including the `list_registered_views` tool added 2026-10-12, has only been verified at the tool level (`executeTool` against live WIP), not through Claude.
**Context:** Everything else in the app works without it.

### MongoDB query pad: no aggregation pipelines yet
**Status:** deferred (by design for the first cut)
**Severity:** low
**Description:** The MongoDB query pad runs `find` (filter, projection, sort, limit, skip) plus a total count. Aggregation pipelines aren't supported.
**Context:** Analytics belong in the PostgreSQL Query Pad. A pipeline editor would reuse `CodeEditor` and `findUnsafe` (`server/infra/mongo-query.ts`), and would also have to reject `$out` and `$merge` (the `read` role refuses them, but RC should name the reason) and keep `maxTimeMS`.

### No ontology graph visualization
**Status:** deferred
**Severity:** low
**Description:** The Vue console draws ontology graphs with Cytoscape.js. RC shows term relations (Relationships tab) and a Hierarchy tab, but no graph view.
**Context:** Peter approved deferring this.

### Bundle size warning on build
**Status:** known
**Severity:** cosmetic
**Description:** The production JS bundle is one chunk of about 1,112 kB (288 kB gzipped; measured 2026-10-12), above Vite's 500 kB warning.
**Context:** Not a functional issue. Route-based splitting with `React.lazy()` would reduce it.

### E2E suite: local only
**Status:** known (phase 1 complete, local)
**Severity:** low
**Description:** `npm run test:e2e` (Playwright) covers smoke, the data lifecycle, imports, same-named templates across namespaces, relationships, reporting (incl. CSV export, Table Browser download, Parity and a forced Batch Sync), template versioning, access control and the infrastructure pages: 48 tests, about 50 s against wip-local. Not yet covered: files, the API Keys and Registry pages, form validation errors, and the Integrity page. It does not run in CI.
**Context:** Phase 1 is local only, by decision (2026-10-18). Run it before image builds. CI would need a WIP install per run (phase 2, not planned). NL Query and backup/restore are deliberately excluded for now.


### Query editors were plain textareas; no MongoDB query editor
**Resolved:** 2026-10-18. The shared CodeMirror 6 `CodeEditor` serves the Query Pad, the registered-view editor and the new MongoDB query pad: highlighting, autocomplete, Ctrl/Cmd+Enter, Format.

### MongoDB page refused once MongoDB required authentication (CASE-892)
**Resolved:** 2026-10-18. The page logs in as the deployer-injected `MONGO_USER` (`read-all` role, read-only). Verified live on wip-local. The document-browse filter now rejects `$`-prefixed field paths, which would otherwise run server-side JavaScript under the read role.

### NATS page unreachable once NATS required authentication (CASE-852)
**Resolved:** 2026-10-17. WIP `f0fc0a64` added the read-only `nats-monitor` role, and RC's manifest declares `nats_client: {roles: [nats-monitor]}`. The deployer injects `NATS_URL`, `NATS_USER=react-console` and `NATS_PASSWORD`; verified live on wip-local (all three NATS routes return data as `react-console`).

### Platform: first query after a column-changing view replace failed (CASE-859)
**Resolved:** 2026-10-12 (reporting-sync `94238418` prepares each `/query` explicitly; verified on wip-local, 6/6 reads succeed after a replace). RC's one-shot retry was removed.

### Platform: `ReportQueryResult.rows` mistyped; empty results had no columns (CASE-861)
**Resolved:** 2026-10-12 (@wip/client 0.54.0 `4ffeb597`; server columns fix in `94238418`). RC adopted 0.54.0 and now reads `/query` through `client.reporting.runQuery`.

### Platform: legacy edge-type endpoints served `resolved: null` (CASE-858)
**Resolved:** 2026-10-12 (template-store `45931c5e` adds `POST /api/template-store/maintenance/heal-endpoints`). Run on wip-local for kb, library, dev-wip-song and restore-rerun: 99 entries filled, 0 unresolvable, no version bumps. Other installs with pre-CASE-830 edge types need the same pass (dry-run first). RC still reads `lookup_value`, which works either way.

### Document table view returned 500 on some templates (CASE-35)
**Resolved:** before 2026-10-12 (CASE-35 closed, platform side)
**Description:** `GET /api/document-store/table/{template_id}` returned 500 for some templates (e.g. `aa.AA_CHARACTER`).
**Resolution:** Fixed in WIP. The current `AA_CHARACTER` template's table view returns 200 on wip-local (checked 2026-10-12).

### Term picker capped at 100 terms
**Resolved:** before 2026-10-12
**Description:** `TermFieldInput` loaded only 100 terms per terminology.
**Resolution:** It now requests `page_size: 1000`. See the open issue for the remaining 1000 cap.

### OIDC auth not tested end-to-end
**Resolved:** 2026-04-09
**Description:** OIDC auth middleware was untested with a live Dex instance from this console.
**Resolution:** Tested end-to-end as part of CASE-38 production deployment. Added the OAuth state parameter, trust proxy, and session cookie path fixes.

### Backup archive OOM on large namespaces (CASE-28)
**Resolved:** 2026-04-09
**Description:** ArchiveWriter caused OOM when backing up large namespaces.
**Resolution:** Fixed on the WIP side. Backup downloads stream through the Express proxy, and since 2026-07 restore uploads stream too (@wip/proxy 0.5.0).

### Template duplicate creates broken copy (CASE-36)
**Resolved:** 2026-04-09
**Description:** Duplicating a template via the UI produced a broken copy.
**Resolution:** Fixed on the WIP side. The amber warning was removed from the Duplicate button.

### Vite pre-bundled deps cache after lib bump
**Resolved:** 2026-04-08
**Description:** After bumping @wip/client and @wip/react, Vite served stale pre-bundled exports (`SyntaxError: does not provide an export named …`).
**Resolution:** Delete `node_modules/.vite` and restart `npm run dev`. This is standard cache hygiene after tarball bumps, not a code bug.
