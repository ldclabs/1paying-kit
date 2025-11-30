import { randomBytes } from 'node:crypto'
import { gunzipSync, gzipSync, constants as zlibConstants } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { gzipCompress, gzipDecompress, isGzip } from './gzip.js'

const encoder = new TextEncoder()

const makeRepeatingData = (length: number): Uint8Array => {
  const data = new Uint8Array(length)
  const pattern = encoder.encode('ABCD')
  for (let i = 0; i < length; i += 1) {
    data[i] = pattern[i % pattern.length] as number
  }
  return data
}

describe('gzip compression utilities', async () => {
  it('round-trips a small buffer', async () => {
    const input = new Uint8Array([1, 2, 3, 4, 5])
    const compressed = await gzipCompress(input)
    const decompressed = await gzipDecompress(compressed)
    expect(Array.from(decompressed)).toEqual(Array.from(input))
  })

  it('round-trips an empty buffer', async () => {
    const input = new Uint8Array(0)
    const compressed = await gzipCompress(input)
    expect(compressed.length).toBeGreaterThanOrEqual(18)
    expect(await gzipDecompress(compressed)).toEqual(input)
  })

  it('round-trips a large, repetitive buffer', async () => {
    const input = makeRepeatingData(4096)
    const compressed = await gzipCompress(input)
    expect(compressed.length).toBeLessThan(input.length + 18)
    expect(await gzipDecompress(compressed)).toEqual(input)
  })

  it('produces a standards-compliant gzip header', async () => {
    const input = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const compressed = await gzipCompress(input)
    expect(isGzip(compressed)).toBe(true)
    expect(await gzipDecompress(compressed)).toEqual(input)
  })

  it('rejects invalid gzip headers', async () => {
    const invalid = new Uint8Array([0x00, 0x00, 0x00])
    await expect(() => gzipDecompress(invalid)).rejects.toThrow()

    const wrongMagic = new Uint8Array(18)
    wrongMagic.set([0x00, 0x8b, 0x08])
    await expect(() => gzipDecompress(wrongMagic)).rejects.toThrow()
  })

  it('rejects truncated payloads', async () => {
    const malformed = new Uint8Array(18)
    malformed.set([0x1f, 0x8b, 0x08, 0x08, 0, 0, 0, 0, 0, 0xff], 0)
    await expect(() => gzipDecompress(malformed)).rejects.toThrow()
  })

  it('validates CRC and size footers', async () => {
    const input = makeRepeatingData(128)
    const compressed = await gzipCompress(input)

    const crcCorrupted = compressed.slice()
    crcCorrupted[crcCorrupted.length - 8]! ^= 0xff
    await expect(() => gzipDecompress(crcCorrupted)).rejects.toThrow()

    const sizeCorrupted = compressed.slice()
    sizeCorrupted[sizeCorrupted.length - 4]! ^= 0xff
    await expect(() => gzipDecompress(sizeCorrupted)).rejects.toThrow()
  })

  it('rejects unsupported DEFLATE block types', async () => {
    const input = encoder.encode('dynamic block test')
    const compressed = await gzipCompress(input)
    const mutated = compressed.slice()
    mutated[10] = (mutated[10]! & ~0x06) | 0x04
    await expect(() => gzipDecompress(mutated)).rejects.toThrow()
  })

  it('fuzzes random payloads against node:zlib', async () => {
    const iterations = 8
    for (let i = 0; i < iterations; i += 1) {
      const size = Math.floor(Math.random() * 4096 * 256)
      const input = randomBytes(size)

      const ours = await gzipCompress(input)
      const gunzipped = gunzipSync(ours)
      expect(Uint8Array.from(gunzipped)).toEqual(Uint8Array.from(input))

      const zlibCompressed = gzipSync(input, { level: zlibConstants.Z_FIXED })
      const restored = await gzipDecompress(new Uint8Array(zlibCompressed))
      expect(Array.from(restored)).toEqual(Array.from(input))
    }
  })
})
