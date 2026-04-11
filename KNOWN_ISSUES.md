# RC-Console — Known Issues

## Open Issues

### Document form: term fields capped at 100 entries
**Status:** deferred
**Severity:** low
**Description:** `TermFieldInput` loads up to 100 active terms from the referenced terminology. Terminologies with more than 100 active terms will have some terms unreachable via the picker.
**Context:** Almost all practical terminologies fit well under this cap. Beyond that we'd need a debounced scoped search (pattern exists in `TermSearchPicker`). Tracked for v2. File a CASE to BE-YAC if encountered in practice.

### Document form: nested-object arrays are read-only placeholders
**Status:** deferred
**Severity:** low
**Description:** Array fields whose items are nested template objects (`array_template_ref` set, `array_item_type` null or `object`) render as a gray "not editable in the form view yet" notice. The form view does not currently support per-item sub-forms. Encountered on `aa.AA_CHARACTER.relationships`.
**Context:** Editing these fields requires a nested FieldInput-per-subfield UI that cleanly handles dirty tracking and validation per row. v2 work. Until then, nested-object arrays can be edited via the API, MCP tools, or a JSON scratchpad.

### Document form: reference pickers query first target only
**Status:** known
**Severity:** low
**Description:** `ReferenceFieldInput` for document references only queries the first entry in `target_templates`. Templates with multiple allowed target templates will only show candidates from the first.
**Context:** Rare in practice. Fix requires merging results from multiple `useDocuments` queries. Low priority.

### Document form: file uploads orphan on form abandonment
**Status:** known
**Severity:** low
**Description:** If the user uploads a file into a `file` field and then cancels or navigates away without saving, the upload remains in storage with `reference_count = 0`.
**Context:** The Files page lists orphan candidates. A future `/improve` pass could either (a) track pending uploads in session storage and prompt on unload or (b) add a server-side TTL on unreferenced files. For v1, manual cleanup is fine.

### Document form: object fields use JSON textarea
**Status:** known (by design)
**Severity:** cosmetic
**Description:** Object-type fields render as a plain textarea with JSON.parse validation, not a keyed form.
**Context:** This is an admin tool, not a general data entry app. A rich nested-object editor is a significant lift with diminishing returns. The textarea is sufficient for power users who understand JSON structure.

### NL Query requires ANTHROPIC_API_KEY
**Status:** known
**Severity:** low
**Description:** The NL Query page shows an "unavailable" notice when ANTHROPIC_API_KEY is not set in .env. This is by design — the feature requires a paid API key.
**Context:** The app is fully functional without NL Query. All other pages work without it.

### No CodeMirror for SQL editor
**Status:** deferred
**Severity:** cosmetic
**Description:** The PostgreSQL query pad uses a plain textarea instead of CodeMirror with SQL syntax highlighting. DESIGN.md originally specified CodeMirror.
**Context:** Deferred to keep the initial build focused. A textarea with monospace font works fine for ad-hoc queries. CodeMirror can be added via `/improve`.

### No ontology graph visualization
**Status:** deferred
**Severity:** low
**Description:** The existing Vue console uses Cytoscape.js for ontology relationship graphs. RC-Console shows term details but not a graph view.
**Context:** Peter approved deferring this. The ontology browser can be added as a sub-route on the terminology detail page.

### Chunk size warning on build
**Status:** known
**Severity:** cosmetic
**Description:** Vite warns that the JS bundle exceeds 500KB (currently ~822KB). Could be reduced with code splitting via dynamic imports.
**Context:** Not a functional issue. All pages load fine. Can be addressed with `React.lazy()` and route-based splitting.

### No E2E tests
**Status:** deferred
**Severity:** medium
**Description:** Only unit tests exist (35 tests). No E2E tests with a real WIP instance.
**Context:** Requires a running WIP instance in CI. Can be added with Playwright.

### Document table view returns 500 on some templates (CASE-35)
**Status:** open
**Severity:** medium
**Description:** The table view (`/documents/:tv/table`) returns a 500 error for some templates. The root cause is under investigation on the WIP side.
**Context:** Not all templates are affected. Standard templates with simple field types work fine.

### MongoDB document filter is basic
**Status:** known
**Severity:** low
**Description:** MongoDB document browsing only supports filtering by a single field=value pair. No support for range queries, regex, or nested field access.
**Context:** Sufficient for quick inspection. Advanced querying should go through the NL Query interface.

## Resolved Issues

### OIDC auth not tested end-to-end
**Resolved:** 2026-04-09
**Description:** OIDC auth middleware was untested with a live Dex instance from this console.
**Resolution:** Tested end-to-end as part of CASE-38 production deployment. Added OAuth state parameter, trust proxy, and session cookie path fixes.

### Backup archive OOM on large namespaces (CASE-28)
**Resolved:** 2026-04-09
**Description:** ArchiveWriter caused OOM when backing up large namespaces.
**Resolution:** Fixed on the WIP side. RC-Console backup page uses streaming download proxy to handle large archives without buffering the entire response in memory.

### Template duplicate creates broken copy (CASE-36)
**Resolved:** 2026-04-09
**Description:** Duplicating a template via the UI produced a broken copy.
**Resolution:** Fixed on the WIP side. The amber warning was removed from the Duplicate button.

### Vite pre-bundled deps cache after lib bump
**Resolved:** 2026-04-08
**Description:** After bumping @wip/client and @wip/react, Vite served stale pre-bundled exports, causing `SyntaxError: does not provide an export named 'useUpdateDocument'`.
**Resolution:** Delete `node_modules/.vite` and restart `npm run dev`. Standard Vite cache hygiene after tarball bumps. Not a code bug.
