# Commits — APP-RC-20261019-230436

## 8137ccb — fix: term picker searches the whole terminology, including names
**Time:** 23:42
**Files:** 7 changed, +376/-78
**Tests:** 193 unit passed; E2E 66 passed (2.4 min). The 3 new term-picker specs each fail on the old picker (label fix and footer text kept, so the failures land on the search/lookup steps).
**What:** TermFieldInput now runs `defStore.searchTerms` (substring, active, limit 100, scoped to the terminology and its namespace) when the user types. It looks up a stored value outside the first page by value, and resolves a bare terminology_ref in the document's namespace (`resolveTerminologyRef`, shared with `resolveTargetTemplate`). The label names the picker.
**Why:** wip-local's PCT_MOLECULE has 11,210 terms with readable names only in term names, so the 1000-term browser filter couldn't reach most terms. Existing documents showed "(not found)".
**Discovered:** term search's `limit` max is 100, and it needs `namespace` even with a terminology id. `getTerm`'s field form (`?terminology=`) resolves the terminology's value but not its id ("Could not resolve … in terminology '<uuid>'"), while `searchTerms` accepts both. Templates on wip-local store terminology_ref as ids (248/248). Ten terminology values exist in several namespaces (KB_*). `GET /terminologies/<bare value>` without a namespace is rejected as ambiguous.

## f7334fd — fix: reference picker offers every target template and searches all documents
**Time:** 23:57
**Files:** 14 changed, +842/-314
**Tests:** 202 unit passed; E2E 70 passed (2.7 min). Of the 4 new reference-picker tests, 3 fail on the old picker at the targeted step. The namespace guard passes on both, because the old picker never searched the server. The "second target" test's old failure has two causes: B never offered, and the label convention changed.
**What:** New DocumentRefPicker and RefCombobox (the shared dropdown was moved out of ReferenceFieldInput).
- Candidates come from queryDocuments (template_id in all targets) per allowed namespace.
- Typed search runs reporting-sync /search (substring) per namespace and template; the hits are loaded by document_id in [...].
- A stored id is looked up with getDocument. Labels come from header_fields, else identity_fields.
- Edge endpoints use ownNamespaceOnly. DocumentFormPage passes the document's namespace in edit mode.
- TermRefPicker delegates to TermFieldInput.
**Why:** Peter's next item.
- Multi-target fields (kb FLAG_RECORD.flagged_document: 9 targets) offered one template.
- Only 50 docs were reachable.
- No-target fields listed all namespaces.
- Existing references outside the 50 showed "(not found)".
**Discovered:**
- Probed in throwaway namespaces (deleted afterwards): a document reference into another namespace is refused until that namespace is in allowed_external_refs. A document in B using A's template needs B to allow A too. The cross-namespace error carries no error_code.
- getDocument by canonical id ignores ?namespace (resolves regardless).
- documents/query accepts template_id and document_id "in" filters; its page_size max is 1000. Reporting search per-type max is 100, and its document hits carry only id plus a generic label.
- On wip-local no field uses reference_type term; 11 use document, 1 terminology.
- Edit mode was passing template.namespace to the field widgets, although a document may live outside its template's namespace.

## 78fac0e — feat: sub-forms for nested template objects; edits sent as a real merge patch
**Time:** 00:10
**Files:** 9 changed, +446/-65
**Tests:** 208 unit passed; E2E 74 passed (2.7 min). The clear-nested-field test fails with the old patch loop (kind: beta survived on the server). The other three can only fail on the old form for lack of sub-forms. Real wip-local documents were checked in the edit form, without saving: AA_BOOK_STRUCTURE (13 items, nested array inside each) and PCT_TRIAL_ELIGIBILITY (9 items, term fields resolved). No page errors, and neither is dirty on load.
**What:** NestedObjectInput (pinned template version, recursing through FieldInput, JSON fallback if the template can't load). ArrayFieldInput: stable keys and item cards. FieldInput: object + template_ref → sub-form; emptied → null. mergePatch (RFC 7396 diff) replaces the top-level shallow diff for both save and dirty check.
**Why:** Peter's third item. The three real nested arrays rendered as per-item JSON textareas. Keyed by position, removing an item showed the next item's JSON. Object-field edits kept removed keys.
**PoNIF:** none. Note: the platform requires array_template_ref_version on array-item template refs.
**Discovered:** Probe (throwaway namespace, deleted): nested mandatory fields, types and unknown keys are validated (paths like items[0].name). Nested **term** fields are neither validated nor resolved: an unknown value is accepted, a name is stored as written, and term_references stays empty. Candidate case, pending Peter.

## 69b1251 — fix: Table Browser namespace chips no longer crowd out the table list
**Time:** 00:10
**Files:** 1 changed
**Tests:** reporting spec 6/6, full E2E 74/74 with the fix.
**What:** Chip area capped (max-h-24, own scroll), named as a group.
**Why:** The full run failed the Table Browser test: 44 namespace chips filled the panel, and the sticky header covered the table button.
**Discovered:** 34 of 47 reporting schemas on wip-local have no registry namespace. They are left behind inconsistently by namespace deletion. Cause unverified; candidate case, pending Peter.
