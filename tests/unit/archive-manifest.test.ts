import { describe, it, expect, beforeAll } from 'vitest'
import { gzipSync, deflateRawSync } from 'node:zlib'
import {
  readArchiveManifest,
  readArchiveFormatVersion,
  isUnsupportedArchiveVersion,
} from '@/lib/archive-version'

// jsdom's Blob has no .stream(), which the reader needs to feed
// DecompressionStream (which jsdom DOES provide). Polyfill it so these tests
// exercise the real inflate path with real DEFLATE bytes rather than
// side-stepping to stored entries — real archives are compressed.
beforeAll(() => {
  if (typeof Blob.prototype.stream !== 'function') {
    Blob.prototype.stream = function (this: Blob) {
      const blob = this
      return new ReadableStream({
        async start(controller) {
          controller.enqueue(new Uint8Array(await blob.arrayBuffer()))
          controller.close()
        },
      })
    } as Blob['stream']
  }
})

// The reader parses a real ZIP local file header off the head of the archive,
// so the fixtures here are real (tiny) ZIPs rather than mocks — that is the
// part worth testing, since a malformed read silently degrades the
// fresh-restore mapping to "type it by hand".

function zipWithManifest(payload: unknown, opts: { store?: boolean; name?: string } = {}): File {
  const name = opts.name ?? 'manifest.json'
  const nameBytes = Buffer.from(name, 'utf8')
  const raw = Buffer.from(JSON.stringify(payload), 'utf8')
  const body = opts.store ? raw : deflateRawSync(raw)
  const method = opts.store ? 0 : 8

  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0) // PK\x03\x04
  header.writeUInt16LE(20, 4) // version needed
  header.writeUInt16LE(0, 6) // flags
  header.writeUInt16LE(method, 8)
  header.writeUInt32LE(0, 14) // crc (unchecked by the reader)
  header.writeUInt32LE(body.length, 18) // compressed size
  header.writeUInt32LE(raw.length, 22) // uncompressed size
  header.writeUInt16LE(nameBytes.length, 26)
  header.writeUInt16LE(0, 28) // extra length

  const bytes = Buffer.concat([header, nameBytes, body])
  return new File([new Uint8Array(bytes)], 'archive.zip')
}

describe('readArchiveManifest', () => {
  it('lists every namespace a multi-namespace archive carries', async () => {
    const m = await readArchiveManifest(zipWithManifest({
      format_version: '3.0',
      namespace: '',
      namespaces: [
        { prefix: 'kb', counts: { documents: 614 } },
        { prefix: 'library', counts: { documents: 19 } },
      ],
    }))

    expect(m?.format_version).toBe('3.0')
    expect(m?.namespaces.map(n => n.prefix)).toEqual(['kb', 'library'])
    expect(m?.namespaces[0]?.counts?.documents).toBe(614)
  })

  it('falls back to the single-namespace shorthand when no list is present', async () => {
    const m = await readArchiveManifest(zipWithManifest({
      format_version: '3.0',
      namespace: 'clintrial',
    }))

    expect(m?.namespaces.map(n => n.prefix)).toEqual(['clintrial'])
  })

  it('does not double-count when both the list and the shorthand are present', async () => {
    const m = await readArchiveManifest(zipWithManifest({
      format_version: '3.0',
      namespace: 'kb',
      namespaces: [{ prefix: 'kb' }],
    }))

    expect(m?.namespaces.map(n => n.prefix)).toEqual(['kb'])
  })

  it('reads a stored (uncompressed) manifest entry', async () => {
    const m = await readArchiveManifest(
      zipWithManifest({ format_version: '3.0', namespace: 'kb' }, { store: true }),
    )
    expect(m?.namespaces.map(n => n.prefix)).toEqual(['kb'])
  })

  it('carries the advisory manifest fields through', async () => {
    const m = await readArchiveManifest(zipWithManifest({
      format_version: '3.0',
      namespace: 'kb',
      exported_at: '2026-07-21T09:00:00Z',
      source_host: 'wip-host',
      include_files: true,
      include_inactive: false,
    }))

    expect(m?.exported_at).toBe('2026-07-21T09:00:00Z')
    expect(m?.source_host).toBe('wip-host')
    expect(m?.include_files).toBe(true)
    expect(m?.include_inactive).toBe(false)
  })

  it('returns null rather than throwing when the head is not a zip', async () => {
    const notAZip = new File([new Uint8Array(Buffer.from('this is not a zip at all'))], 'x.zip')
    expect(await readArchiveManifest(notAZip)).toBeNull()
  })

  it('returns null when the first entry is not manifest.json', async () => {
    const m = await readArchiveManifest(
      zipWithManifest({ format_version: '3.0' }, { name: 'documents.jsonl' }),
    )
    expect(m).toBeNull()
  })

  it('returns null on a compression method it cannot inflate', async () => {
    // Method 8 is the only compressed form the reader handles; gzip-framed
    // bytes under a bogus method must fail closed, not produce garbage.
    const raw = Buffer.from(JSON.stringify({ format_version: '3.0' }))
    const body = gzipSync(raw)
    const nameBytes = Buffer.from('manifest.json')
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(12, 8) // method 12 (bzip2) — unsupported
    header.writeUInt32LE(body.length, 18)
    header.writeUInt16LE(nameBytes.length, 26)
    const f = new File([new Uint8Array(Buffer.concat([header, nameBytes, body]))], 'a.zip')

    expect(await readArchiveManifest(f)).toBeNull()
  })
})

describe('readArchiveFormatVersion', () => {
  it('still reads just the version', async () => {
    const v = await readArchiveFormatVersion(
      zipWithManifest({ format_version: '2.0', namespace: 'old' }),
    )
    expect(v).toBe('2.0')
  })
})

describe('isUnsupportedArchiveVersion', () => {
  it('blocks a positively-detected v2 archive', () => {
    expect(isUnsupportedArchiveVersion('2.0')).toBe(true)
  })

  it('accepts v3', () => {
    expect(isUnsupportedArchiveVersion('3.0')).toBe(false)
  })

  it('fails open on an unreadable manifest — the backend decides', () => {
    expect(isUnsupportedArchiveVersion(null)).toBe(false)
  })
})
