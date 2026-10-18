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
