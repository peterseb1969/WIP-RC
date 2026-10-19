# Commits — APP-RC-20261019-230436

## 8137ccb — fix: term picker searches the whole terminology, including names
**Time:** 23:42
**Files:** 7 changed, +376/-78
**Tests:** 193 unit passed; E2E 66 passed (2.4 min). The 3 new term-picker specs each fail on the old picker (label fix and footer text kept, so the failures land on the search/lookup steps).
**What:** TermFieldInput now runs `defStore.searchTerms` (substring, active, limit 100, scoped to the terminology and its namespace) when the user types. It looks up a stored value outside the first page by value, and resolves a bare terminology_ref in the document's namespace (`resolveTerminologyRef`, shared with `resolveTargetTemplate`). The label names the picker.
**Why:** wip-local's PCT_MOLECULE has 11,210 terms with readable names only in term names, so the 1000-term browser filter couldn't reach most terms. Existing documents showed "(not found)".
**Discovered:** term search's `limit` max is 100, and it needs `namespace` even with a terminology id. `getTerm`'s field form (`?terminology=`) resolves the terminology's value but not its id ("Could not resolve … in terminology '<uuid>'"), while `searchTerms` accepts both. Templates on wip-local store terminology_ref as ids (248/248). Ten terminology values exist in several namespaces (KB_*). `GET /terminologies/<bare value>` without a namespace is rejected as ambiguous.
