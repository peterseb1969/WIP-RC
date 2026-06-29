/**
 * Best-effort read of a WIP backup archive's manifest `format_version` from an
 * uploaded .zip, WITHOUT loading the whole (possibly multi-GB) file.
 *
 * The archive writer puts `manifest.json` first, so its ZIP local file header
 * sits at offset 0. We read a bounded head slice and inflate just that entry
 * using the browser-native DecompressionStream (raw DEFLATE = ZIP's method 8) —
 * no third-party zip dependency.
 *
 * Returns the version string (e.g. "2.0", "3.0") or `null` when it can't be
 * determined. Callers must FAIL OPEN on `null` — let the backend decide — and
 * only block on a positively-detected unsupported version.
 */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed view (the subarray's buffer is typed
  // as ArrayBufferLike, which BlobPart won't accept under strict TS).
  const copy = new Uint8Array(data.length)
  copy.set(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readArchiveFormatVersion(file: File): Promise<string | null> {
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
    const json = JSON.parse(new TextDecoder().decode(raw)) as { format_version?: unknown }
    return typeof json.format_version === 'string' ? json.format_version : null
  } catch {
    return null
  }
}

/** True only when we positively detect a non-v3 archive. */
export function isUnsupportedArchiveVersion(version: string | null): boolean {
  return version != null && !version.startsWith('3')
}
