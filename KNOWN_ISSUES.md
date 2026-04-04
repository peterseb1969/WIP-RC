# RC-Console — Known Issues

## Open Issues

### NL Query requires ANTHROPIC_API_KEY
**Status:** known
**Severity:** low
**Description:** The NL Query page shows an "unavailable" notice when ANTHROPIC_API_KEY is not set in .env. This is by design — the feature requires a paid API key.
**Context:** The app is fully functional without NL Query. All other 15 pages work without it.

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
**Description:** Vite warns that the JS bundle exceeds 500KB (currently ~596KB). Could be reduced with code splitting via dynamic imports.
**Context:** Not a functional issue. All pages load fine. Can be addressed with `React.lazy()` and route-based splitting.

### No E2E tests
**Status:** deferred
**Severity:** medium
**Description:** Only unit tests exist (35 tests). No E2E tests with a real WIP instance.
**Context:** Requires a running WIP instance in CI. Can be added with Playwright.

### OIDC auth not tested end-to-end
**Status:** known
**Severity:** medium
**Description:** The OIDC auth middleware (auth.ts) is complete but has not been tested with a live Dex instance from this console. It was ported from the scaffold template.
**Context:** Dev mode runs without auth (OIDC_ISSUER not set). The auth code is proven from other WIP apps but needs verification for this specific app.

### MongoDB document filter is basic
**Status:** known
**Severity:** low
**Description:** MongoDB document browsing only supports filtering by a single field=value pair. No support for range queries, regex, or nested field access.
**Context:** Sufficient for quick inspection. Advanced querying should go through the NL Query interface.
