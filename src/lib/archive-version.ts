/**
 * Best-effort read of a WIP backup archive's `manifest.json` from an uploaded
 * .zip, WITHOUT loading the whole (possibly multi-GB) file.
 *
 * The archive writer puts `manifest.json` first, so its ZIP local file header
 * sits at offset 0. We read a bounded head slice and inflate just that entry
 * using the browser-native DecompressionStream (raw DEFLATE = ZIP's method 8) —
 * no third-party zip dependency.
 *
 * Everything here is advisory. Callers must FAIL OPEN on `null` — let the
 * backend decide — and only block on a positively-detected bad value. The one
 * place the manifest is load-bearing is the fresh-restore namespace map, which
 * needs the archive's source namespaces to build its inputs; when the read
 * fails we fall back to letting the operator type the mapping by hand.
 */

/** One namespace as the archive manifest lists it. */
export interface ArchiveNamespace {
  prefix: string
  /** Per-entity-type counts, when the manifest carries them. */
  counts?: Record<string, number>
}

export interface ArchiveManifest {
  format_version: string | null
  /** Every namespace in the archive. Single-namespace archives list exactly one. */
  namespaces: ArchiveNamespace[]
  exported_at?: string
  source_host?: string
  include_files?: boolean
  include_inactive?: boolean
}
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed view (the subarray's buffer is typed
  // as ArrayBufferLike, which BlobPart won't accept under strict TS).
  const copy = new Uint8Array(data.length)
  copy.set(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Raw manifest JSON from the archive head, or null when unreadable. */
async function readManifestJson(file: File): Promise<Record<string, unknown> | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer())
    if (head.length < 30) return null
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength)
    if (dv.getUint32(0, true) !== 0x04034b50) return null // PK\x03\x04 local file header
    const flags = dv.getUint16(6, true)
    if (flags & 0x1) return null // encrypted — can't read
    const method = dv.getUint16(8, true)
    const compSize = dv.getUint32(18, true)
    const nameLen = dv.getUint16(26, true)
    const extraLen = dv.getUint16(28, true)
    const name = new TextDecoder().decode(head.subarray(30, 30 + nameLen))
    if (name !== 'manifest.json') return null
    const start = 30 + nameLen + extraLen
    if (compSize === 0 || start + compSize > head.length) return null // streamed size, or bigger than the slice
    const comp = head.subarray(start, start + compSize)
    let raw: Uint8Array
    if (method === 0) raw = comp // stored
    else if (method === 8) raw = await inflateRaw(comp) // raw DEFLATE (ZIP)
    else return null
    const json: unknown = JSON.parse(new TextDecoder().decode(raw))
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function readArchiveFormatVersion(file: File): Promise<string | null> {
  const json = await readManifestJson(file)
  return typeof json?.format_version === 'string' ? json.format_version : null
}

/**
 * Read the manifest's shape: format version plus the namespaces the archive
 * carries. Returns null when the manifest can't be read at all.
 *
 * The writer emits `namespaces: [{prefix, counts, …}]` for every archive, and a
 * top-level `namespace` string as the single-namespace shorthand — accept
 * either, since older v3 archives in the wild may carry only the latter.
 */
export async function readArchiveManifest(file: File): Promise<ArchiveManifest | null> {
  const json = await readManifestJson(file)
  if (!json) return null

  const namespaces: ArchiveNamespace[] = []
  const listed = json.namespaces
  if (Array.isArray(listed)) {
    for (const entry of listed) {
      if (typeof entry === 'string') {
        namespaces.push({ prefix: entry })
      } else if (entry && typeof entry === 'object') {
        const prefix = (entry as { prefix?: unknown }).prefix
        if (typeof prefix === 'string' && prefix) {
          const counts = (entry as { counts?: unknown }).counts
          namespaces.push({
            prefix,
            counts:
              counts && typeof counts === 'object'
                ? (counts as Record<string, number>)
                : undefined,
          })
        }
      }
    }
  }
  // Single-namespace shorthand — only when the list did not already supply it.
  if (namespaces.length === 0 && typeof json.namespace === 'string' && json.namespace) {
    namespaces.push({ prefix: json.namespace })
  }

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined)

  return {
    format_version: str(json.format_version) ?? null,
    namespaces,
    exported_at: str(json.exported_at),
    source_host: str(json.source_host),
    include_files: bool(json.include_files),
    include_inactive: bool(json.include_inactive),
  }
}

/** True only when we positively detect a non-v3 archive. */
export function isUnsupportedArchiveVersion(version: string | null): boolean {
  return version != null && !version.startsWith('3')
}
