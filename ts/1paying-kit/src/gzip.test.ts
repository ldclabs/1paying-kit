import { randomBytes } from 'node:crypto'
import { gunzipSync, gzipSync, constants as zlibConstants } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  gzipCompress,
  gzipCompressString,
  gzipDecompress,
  gzipDecompressToString
} from './gzip.js'

const encoder = new TextEncoder()

const makeRepeatingData = (length: number): Uint8Array => {
  const data = new Uint8Array(length)
  const pattern = encoder.encode('ABCD')
  for (let i = 0; i < length; i += 1) {
    data[i] = pattern[i % pattern.length] as number
  }
  return data
}

describe('gzip compression utilities', () => {
  it('round-trips a small buffer', () => {
    const input = new Uint8Array([1, 2, 3, 4, 5])
    const compressed = gzipCompress(input)
    const decompressed = gzipDecompress(compressed)
    expect(Array.from(decompressed)).toEqual(Array.from(input))
  })

  it('round-trips an empty buffer', () => {
    const input = new Uint8Array(0)
    const compressed = gzipCompress(input)
    expect(compressed.length).toBeGreaterThanOrEqual(18)
    expect(gzipDecompress(compressed)).toEqual(input)
  })

  it('round-trips a large, repetitive buffer', () => {
    const input = makeRepeatingData(4096)
    const compressed = gzipCompress(input)
    expect(compressed.length).toBeLessThan(input.length + 18)
    expect(gzipDecompress(compressed)).toEqual(input)
  })

  it('produces a standards-compliant gzip header', () => {
    const input = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const compressed = gzipCompress(input)
    expect(Array.from(compressed.slice(0, 10))).toEqual([
      0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff
    ])
    expect(gzipDecompress(compressed)).toEqual(input)
  })

  it('compresses and decompresses UTF-8 text', () => {
    const input = '支付要求: ' + '测试'.repeat(32)
    const compressed = gzipCompressString(input)
    const decompressed = gzipDecompressToString(compressed)
    expect(decompressed).toBe(input)
  })

  it('rejects invalid gzip headers', () => {
    const invalid = new Uint8Array([0x00, 0x00, 0x00])
    expect(() => gzipDecompress(invalid)).toThrow('Invalid gzip data')

    const wrongMagic = new Uint8Array(18)
    wrongMagic.set([0x00, 0x8b, 0x08])
    expect(() => gzipDecompress(wrongMagic)).toThrow('Unsupported gzip header')
  })

  it('rejects truncated payloads', () => {
    const malformed = new Uint8Array(18)
    malformed.set([0x1f, 0x8b, 0x08, 0x08, 0, 0, 0, 0, 0, 0xff], 0)
    expect(() => gzipDecompress(malformed)).toThrow('Incomplete gzip payload')
  })

  it('validates CRC and size footers', () => {
    const input = makeRepeatingData(128)
    const compressed = gzipCompress(input)

    const crcCorrupted = compressed.slice()
    crcCorrupted[crcCorrupted.length - 8]! ^= 0xff
    expect(() => gzipDecompress(crcCorrupted)).toThrow('CRC32 mismatch')

    const sizeCorrupted = compressed.slice()
    sizeCorrupted[sizeCorrupted.length - 4]! ^= 0xff
    expect(() => gzipDecompress(sizeCorrupted)).toThrow('Size mismatch')
  })

  it('rejects unsupported DEFLATE block types', () => {
    const input = encoder.encode('dynamic block test')
    const compressed = gzipCompress(input)
    const mutated = compressed.slice()
    mutated[10] = (mutated[10]! & ~0x06) | 0x04
    expect(() => gzipDecompress(mutated)).toThrow(
      'Unsupported DEFLATE block type'
    )
  })

  it('fuzzes random payloads against node:zlib', () => {
    const iterations = 32
    for (let i = 0; i < iterations; i += 1) {
      const size = Math.floor(Math.random() * 4096 * 256)
      const input = randomBytes(size)

      const ours = gzipCompress(input)
      const gunzipped = gunzipSync(ours)
      expect(Uint8Array.from(gunzipped)).toEqual(Uint8Array.from(input))

      const zlibCompressed = gzipSync(input, { level: zlibConstants.Z_FIXED })
      const restored = gzipDecompress(new Uint8Array(zlibCompressed))
      expect(Array.from(restored)).toEqual(Array.from(input))
    }
  })
})
