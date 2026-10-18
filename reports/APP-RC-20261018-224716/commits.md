# Commits — APP-RC-20261018-224716

## cbc9779 — fix: document pages use the selected namespace's template
**Time:** 23:01
**Files:** 10 changed, +173/-41
**Tests:** 180 unit passed; E2E imports 3/3, same-named templates 3/3, relationships 3/3 against wip-local
**What:** New useRouteTemplate hook (?template_id= wins, a bare value resolves in the selected namespace). Form, table and import pages use it; the detail page uses the document's template_id. The list page's links carry template_id. Reference pickers resolve bare target values in the form's namespace (resolveTargetTemplate). The import refreshes cached document lists. The list page's namespace reset no longer wipes a ?template= or recall selection.
**Why:** Found while writing the E2E imports spec. On wip-local `GET /templates/by-value/CASE_RECORD` without a namespace returns kb's template, and 28 values exist in more than one namespace. "New document" from dev-proj-a's CASE_RECORD would have written into kb.
**Discovered:** @wip/react's useTemplateByValue has no namespace parameter, and its query key ignores namespace. Namespace-scoped by-value does not fall back to `wip` (404). The new namespaces spec fails on the old code (it loaded the twin namespace's template). The relationships spec does not discriminate the picker fix: the platform now stores a reference field's target_templates as the resolved template_id (verified with a probe in a throwaway namespace: bare "P" was stored as P's id), so the old by-id match already worked for new templates. The by-value path is hit only by older fields that still hold bare values, such as kb's edge types (AGENT_PARTICIPATED source_ref: ['FIRESIDE', 'CASE_RECORD', …]).

## 881d641 — test: E2E imports, relationships, reporting and same-named templates
**Time:** 23:03
**Files:** 12 changed, +488/-19
**Tests:** E2E 36 passed (36.2 s); unit 180 passed
**What:** Four new specs (imports, namespaces, relationships, reporting), a second disposable "<run>-twin" namespace in global setup/teardown, checked fixture helpers (createTemplate, createDocuments), view-editor label association, README/KNOWN_ISSUES/CHANGELOG.
**Why:** Completes E2E phase 1 (groups imports, reporting, relationships from the handover), plus a regression spec for cbc9779.
**PoNIF:** #4 bulk-first: template/document fixture POSTs answer 200 on per-item errors; the helpers check results[i].status.
**Discovered:** Document writes need template_id (template_value is rejected, 422). Documents keep the submitted term value ("Crimson") and record the resolution in term_references (matched_via: alias). The registered-views list is {namespace, views}. A terminology created from a CSV takes its label from the file name.

## 305860f — fix: template editor locks identity fields; version chips refresh
**Time:** 23:17
**Files:** 4 files changed, 111 insertions(+), 35 deletions(-)
**Tests:** unit 183 passed (3 new VersionWarnings tests; 2 of them fail on the old component); E2E versioning 4/4
**What:** The identity selector is locked in edit mode. VersionWarnings blocks any identity change (draft or active, any document count) with an accurate message pointing at Duplicate, checked before the draft early-return. Save as Draft respects blocking warnings. The template page's version list no longer has a 60 s staleTime.
**Why:** Probed in throwaway rc-e2e-probe namespaces: the platform rejects identity_fields changes on active AND draft templates ("immutable across versions … a fork"), yet RC said "safe". The version chips were missing after minting v2 (found by the versioning spec).
**PoNIF:** #2 confirmed live: a schema change gives v2 with v1 still active.

## 4b1b021 — test: E2E template versioning and access control
**Time:** 23:17
**Files:** 8 files changed, 198 insertions(+), 11 deletions(-)
**Tests:** E2E 44 passed (42.1 s)
**What:** versioning.spec.ts (4) and access.spec.ts (4); shared Dex login in support/login.ts; viewer settings in env.ts; docs.
**Why:** Peter's top two coverage gaps: versioning (PoNIF #2) and the ALLOWED_GROUPS fix 3461408, which until now was checked only by hand.
**Discovered:** Deactivating a template version navigates to the template list. In the dev container the SPA shell renders for the viewer (Vite serves it); the denial shows on the API and proxy calls and in page error states. Not verified that the access spec fails on pre-3461408 server code: reverting server/auth.ts would restart the dev server and drop the in-memory Anthropic key.
