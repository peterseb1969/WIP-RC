# RC-Console — Import Formats

RC imports data into WIP through three surfaces. Each one hands the parsed data to a WIP import endpoint, which does the validation and versioning. RC owns no import format of its own: everything it imports lands in whatever namespace, terminology, or template the user chooses.

| Surface | Where | Formats | WIP endpoint |
|---------|-------|---------|--------------|
| Terminology import | Terminologies list ("Import": create from file) and terminology detail (import into this terminology) | CSV / TSV, JSON term array, JSON bundle, OBO Graph JSON, plain-text OBO | def-store `createTerms`, `importTerminology`, `importOntology` |
| Document import | Documents → Import (`/documents/import`) | CSV | document-store `importDocuments` |
| Backup restore | Backup & Restore → Restore | WIP backup archive (.zip, format v3) | document-store `/backup/namespaces/_/restore` |

Code: `src/components/terminologies/ImportPanel.tsx`, `src/lib/terminology-import.ts` (pure helpers, unit-tested in `tests/unit/terminology-import.test.ts`), `src/pages/DocumentImportPage.tsx`, `src/pages/BackupRestorePage.tsx`, `src/lib/archive-version.ts`.

---

## Terminology import

**Format detection** is by file extension: `.csv` / `.tsv` → CSV, `.obo` / `.obo.json` → OBO, anything else → JSON. The file picker accepts `.json,.csv,.tsv,.obo`. A JSON file is then classified by its shape (see below).

**Modes:**
- **Into existing** (terminology detail page). Terms land in the viewed terminology, in its namespace.
- **Create new** (terminologies list page). The user names the vocabulary first. The value and label are prefilled from the filename; the value must be UPPER_SNAKE_CASE, and a namespace is required. The terminology is created if missing and reused if it already exists, because the import endpoints upsert. A JSON bundle carries its own `terminology` object, which takes precedence over the naming fields.

**Idempotency:** re-importing the same file skips existing terms and relations (`skip_duplicates: true`), and the summary counts them as skipped.

**Result:** every path reports terms created / skipped / errored and relations created / skipped / errored, plus up to 50 per-item failures with the term value where known.

### CSV / TSV

- **Source:** any spreadsheet or tool export with a header row.
- **Parsing:** PapaParse in header mode, skipping empty lines. The delimiter is auto-detected, so TSV works.
- **Column mapping** (first matching header wins; `csvRowsToTerms`):

  | Term field | Accepted headers |
  |------------|------------------|
  | `value` (required) | `value`, `code`, `term`, `name` |
  | `label` | `label`, `display_name` |
  | `description` | `description`, `definition` |
  | `aliases` | `aliases`, pipe-separated (`a\|b\|c`), trimmed, empties dropped |
  | `sort_order` | `sort_order`, parsed as a whole number |

- **Transformations:** `created_by: 'rc-console'` is stamped on every term.
- **Routing:** importing into an existing terminology uses `createTerms` (server-side batches of 250). Create-new uses `importTerminology`.
- **Known issues:**
  - A row with no usable value column is skipped and reported as "row(s) had no usable term value".
  - A `sort_order` that is blank or not a whole number is omitted for that term.
  - Relations can't be expressed in CSV.
- **Sample:**
  ```csv
  value,label,description,aliases
  M,Male,,MR|Mr.|MALE
  F,Female,,MS|Ms.|FEMALE
  ```

### JSON — term array

- **Shape:** a top-level array of term objects.
- **Fields read:** `value`, `label`, `description`, `aliases` (array), `sort_order`, `parent_term_id`, `translations`, `metadata`. `created_by` is set to `rc-console`.
- **Routing:** the same as CSV.
- **Sample:**
  ```json
  [{ "value": "M", "label": "Male", "aliases": ["MR", "Mr."] }, { "value": "F", "label": "Female" }]
  ```

### JSON — bundle (terminology export format)

- **Source:** a WIP terminology export, or any file of the same shape.
- **Shape:** `{ "terminology": {...}, "terms": [...], "relations"?: [...] }`.
- **Relations:** both key spellings are accepted. `relations` items use `relation_type`; the legacy `relationships` key with `relationship_type` items also works, so exports made before the rename still import. Each relation is `{ source_term_value, target_term_value, relation_type, target_terminology_value? }`.
- **Routing:** `importTerminology`, in both modes. The bundle's `terminology` object is used, with the namespace overridden to the import target.

### OBO Graph JSON

- **Source:** OBO Foundry / ROBOT `*.obo.json` exports (OBO Graph JSON).
- **Detection:** a `.obo` / `.obo.json` extension, or any JSON with a top-level `graphs` or `nodes` array.
- **Routing:** `importOntology`, which creates the terminology if missing and then loads terms and relations in batches. The terminology value comes from the viewed terminology or the naming step.
- **Known issues:** the server only imports nodes with `"type": "CLASS"` and silently skips anything else. Edge predicates (`is_a`, `part_of`, …) become term relations; the server auto-creates relation types it hasn't seen.
- **Sample:**
  ```json
  { "graphs": [{ "nodes": [
      { "id": "SHP:0000001", "lbl": "Shape", "type": "CLASS" },
      { "id": "SHP:0000002", "lbl": "Polygon", "type": "CLASS" } ],
    "edges": [{ "sub": "SHP:0000002", "pred": "is_a", "obj": "SHP:0000001" }] }] }
  ```

### Plain-text OBO (`.obo`)

- **Source:** OBO 1.2/1.4 flat files (HPO, GO, Mondo, …).
- **Parsing:** `parseOboText` converts the text to OBO Graph JSON in the browser, then the file follows the OBO Graph JSON route above. Content starting with `{` is treated as JSON instead.
- **Tags read from `[Term]` stanzas:**

  | Tag | Becomes |
  |-----|---------|
  | `id` | node id |
  | `name` | label |
  | `def` | definition (the quoted text only) |
  | `synonym` | synonym (quoted text; scope and xrefs ignored) |
  | `is_a` | `is_a` edge |
  | `relationship: <pred> <target>` | edge with that predicate |
  | `is_obsolete: true` | `deprecated` |

  Trailing `! comment` text is stripped, but a `!` inside a quoted string is kept. `[Typedef]` and other stanzas are skipped.
- **Known issues:** this is a minimal parser. Header tags, `xref`, `intersection_of`, `union_of`, `replaced_by`, and synonym scopes are not read. A file with no `[Term]` stanza fails with "No [Term] stanzas found — this does not look like an OBO file."
- **Sample:**
  ```
  [Term]
  id: HP:0000118
  name: Phenotypic abnormality
  def: "A phenotypic abnormality." [HPO:probinson]
  synonym: "Organ abnormality" EXACT []
  is_a: HP:0000001 ! All
  ```

---

## Document import (CSV)

- **Source:** any CSV with a header row whose columns correspond to a template's fields.
- **Wizard steps:** select template → upload → map columns → import → results. The template step lists active, latest-version templates in the top-bar namespace (`page_size: 100`). `/documents/import?template=<VALUE>` skips the template step.
- **Upload:** PapaParse in header mode. Only the first 5 rows are parsed, for the preview; the whole file is sent to the server. A file with no header columns is rejected client-side.
- **Column mapping:** `autoMap` matches each CSV header to a template field by:
  1. its normalized name (lowercased, spaces and hyphens → `_`) equal to a field name; then
  2. its lowercased text equal to a field label.

  Each field is mapped at most once. Unmatched columns default to "skip", and every mapping can be changed by hand.
- **Import:** `client.documents.importDocuments(file, filename, { template_id, column_mapping, namespace, skip_errors: true })`. Values are converted and validated server-side against the template (term fields resolve by value or alias, references by identifier). Identity fields decide new document vs new version.
- **Namespace:** the top-bar namespace is required, and the wizard warns until one is selected.
- **Results:** total rows / succeeded / failed / skipped counts, each successful row tagged new or updated (`is_new`), and up to 50 row-level errors (`row`, `error`).
- **Known issues:**
  - The template step lists up to 1000 templates (the API page maximum); beyond that, a template is only reachable via `?template=`.
  - Arrays, objects, and file fields have no CSV encoding defined client-side, so they depend on the server's conversion.
- **Sample** (template with fields `name`, `email`, `country` [term]):
  ```csv
  name,email,country
  Ada Lovelace,ada@example.org,GB
  ```

---

## Backup restore (archive)

- **Source:** a WIP backup archive produced by RC's Backup tab, `wip-toolkit export`, or the document-store backup API. A combined archive can contain several namespaces.
- **File type:** `.zip` with `manifest.json` as the first entry.
- **Client-side checks:** `readArchiveManifest` reads the manifest from the ZIP in the browser. Archives older than **format v3** are refused before upload (otherwise the restore would create an empty namespace and restore nothing); the UI shows the conversion command `python -m wip_toolkit.convert_archive OLD.zip NEW.zip`. The manifest's namespace list seeds the target mapping.
- **Modes and options:** sent as multipart form data.
  - Restore `mode`, and a `dry_run` preview that uses the same options.
  - `skip_documents`, `skip_files`, `batch_size`.
  - For a fresh restore: `target_namespace` for a single-namespace archive, or `namespace_map` (JSON) for a multi-namespace one. Fresh restore only allows a target with the same name as its source when that namespace is absent, so colliding targets are flagged inline.
- **Transformations:** none client-side. The archive is streamed through the proxy unchanged.
