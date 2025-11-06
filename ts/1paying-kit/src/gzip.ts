/**
 * A simple, pure-TypeScript implementation of Gzip compression and decompression.
 * This implementation is designed for browser environments and focuses on the DEFLATE
 * algorithm with fixed Huffman codes. It does not support all Gzip features (like file headers
 * or dynamic Huffman trees) but is sufficient for basic data compression tasks.
 *
 * References:
 * - GZIP file format specification version 4.3: https://www.ietf.org/rfc/rfc1952.txt
 * - DEFLATE Compressed Data Format Specification version 1.3: https://www.ietf.org/rfc/rfc1951.txt
 */

const GZIP_ID1 = 0x1f
const GZIP_ID2 = 0x8b
const GZIP_CM_DEFLATE = 8

const WINDOW_SIZE = 32768
const MAX_MATCH = 258
const MIN_MATCH = 3
const MAX_CHAIN_HITS = 128

// --- DEFLATE constants for length and distance codes ---

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
  83, 99, 115, 131, 163, 195, 227, 258
]
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0
]

const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577
]
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13
]

/**
 * Represents a token in the LZ77 compression process.
 * It can be either a literal byte or a match (length-distance pair).
 */
type Token =
  | { type: 'literal'; value: number }
  | { type: 'match'; length: number; distance: number }

/**
 * Writes bits to a byte buffer. Used for creating DEFLATE blocks.
 */
class BitWriter {
  private byteBuffer: number[] = []
  private bitBuffer = 0
  private bitLength = 0

  /**
   * Writes a value with a specific bit length to the buffer.
   * @param value The number to write.
   * @param length The number of bits to write from the value.
   */
  writeBits(value: number, length: number) {
    if (length === 0) {
      return
    }
    const mask = (1 << length) - 1
    this.bitBuffer |= (value & mask) << this.bitLength
    this.bitLength += length
    while (this.bitLength >= 8) {
      this.byteBuffer.push(this.bitBuffer & 0xff)
      this.bitBuffer >>>= 8
      this.bitLength -= 8
    }
  }

  /**
   * Aligns the writer to the next byte boundary, flushing any remaining bits.
   */
  alignToByte() {
    if (this.bitLength > 0) {
      this.byteBuffer.push(this.bitBuffer & 0xff)
      this.bitBuffer = 0
      this.bitLength = 0
    }
  }

  /**
   * Returns the written data as a Uint8Array.
   */
  toUint8Array(): Uint8Array {
    this.alignToByte()
    return Uint8Array.from(this.byteBuffer)
  }
}

/**
 * Reads bits from a Uint8Array. Used for parsing DEFLATE blocks.
 */
class BitReader {
  private bitBuffer = 0
  private bitLength = 0
  private offset = 0

  constructor(private readonly bytes: Uint8Array) {}

  /**
   * Ensures that there are at least `n` bits in the bit buffer.
   * @param n The number of bits to ensure.
   */
  private ensureBits(n: number) {
    while (this.bitLength < n) {
      if (this.offset >= this.bytes.length) {
        throw new Error('Unexpected end of stream')
      }
      this.bitBuffer |= this.bytes[this.offset] << this.bitLength
      this.offset += 1
      this.bitLength += 8
    }
  }

  /**
   * Reads a specified number of bits from the stream.
   * @param n The number of bits to read.
   * @returns The read value.
   */
  readBits(n: number): number {
    this.ensureBits(n)
    const value = this.bitBuffer & ((1 << n) - 1)
    this.bitBuffer >>>= n
    this.bitLength -= n
    return value
  }

  /**
   * Peeks at a specified number of bits without advancing the stream.
   * @param n The number of bits to peek.
   * @returns The peeked value.
   */
  peekBits(n: number): number {
    this.ensureBits(n)
    return this.bitBuffer & ((1 << n) - 1)
  }

  /**
   * Aligns the reader to the next byte boundary.
   */
  alignToByte() {
    this.bitBuffer = 0
    this.bitLength = 0
  }

  /**
   * Reads a single byte from the stream.
   */
  readByte(): number {
    return this.readBits(8)
  }

  /**
   * The number of bytes consumed from the input array.
   */
  get consumed(): number {
    return this.offset
  }
}

/**
 * Pre-computed CRC32 table for performance.
 */
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      if ((c & 1) !== 0) {
        c = 0xedb88320 ^ (c >>> 1)
      } else {
        c >>>= 1
      }
    }
    table[i] = c >>> 0
  }
  return table
})()

/**
 * Computes the CRC32 checksum of a byte array.
 * @param data The input data.
 * @returns The CRC32 checksum.
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i]
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// --- Fixed Huffman tables for DEFLATE ---

const fixedLiteralCodes = new Uint16Array(288)
const fixedLiteralLengths = new Uint8Array(288)
const fixedDistanceCodes = new Uint16Array(32)

const FIXED_LITERAL_MAX_BITS = 9
const FIXED_LITERAL_SHORT_BITS = 7
const fixedLiteralDecode = new Int16Array(1 << FIXED_LITERAL_MAX_BITS)
const fixedLiteralDecodeLength = new Uint8Array(1 << FIXED_LITERAL_MAX_BITS)
const fixedLiteralShortDecode = new Int16Array(1 << FIXED_LITERAL_SHORT_BITS)
const fixedLiteralShortLength = new Uint8Array(1 << FIXED_LITERAL_SHORT_BITS)

const fixedDistanceDecode = new Int16Array(1 << 5)
const fixedDistanceDecodeLength = new Uint8Array(1 << 5)

/**
 * Reverses the bits of a number.
 * @param value The number to reverse.
 * @param width The bit width of the number.
 * @returns The bit-reversed number.
 */
function reverseBits(value: number, width: number): number {
  let out = 0
  for (let i = 0; i < width; i += 1) {
    out = (out << 1) | (value & 1)
    value >>>= 1
  }
  return out
}

/**
 * Builds the fixed Huffman tables for literal/length and distance codes
 * as defined by the DEFLATE specification.
 */
function buildFixedTables() {
  for (let i = 0; i < fixedLiteralShortDecode.length; i += 1) {
    fixedLiteralShortDecode[i] = -1
    fixedLiteralShortLength[i] = 0
  }

  // Generate literal/length codes
  let code = 0
  for (let i = 0; i <= 143; i += 1) {
    fixedLiteralCodes[i] = reverseBits(0x30 + i, 8)
    fixedLiteralLengths[i] = 8
  }
  code = 0
  for (let i = 144; i <= 255; i += 1) {
    fixedLiteralCodes[i] = reverseBits(0x190 + (i - 144), 9)
    fixedLiteralLengths[i] = 9
  }
  for (let i = 256; i <= 279; i += 1) {
    fixedLiteralCodes[i] = reverseBits(i - 256, 7)
    fixedLiteralLengths[i] = 7
  }
  for (let i = 280; i <= 287; i += 1) {
    fixedLiteralCodes[i] = reverseBits(0xc0 + (i - 280), 8)
    fixedLiteralLengths[i] = 8
  }

  // Build decode tables for literal/length codes
  for (let symbol = 0; symbol < fixedLiteralCodes.length; symbol += 1) {
    const len = fixedLiteralLengths[symbol]
    const codeVal = fixedLiteralCodes[symbol]
    const fill = 1 << (FIXED_LITERAL_MAX_BITS - len)
    for (let i = 0; i < fill; i += 1) {
      const index = codeVal | (i << len)
      fixedLiteralDecode[index] = symbol
      fixedLiteralDecodeLength[index] = len
    }

    if (len <= FIXED_LITERAL_SHORT_BITS) {
      const shortFill = 1 << (FIXED_LITERAL_SHORT_BITS - len)
      for (let i = 0; i < shortFill; i += 1) {
        const index = codeVal | (i << len)
        fixedLiteralShortDecode[index] = symbol
        fixedLiteralShortLength[index] = len
      }
    }
  }

  // Build decode tables for distance codes
  for (let i = 0; i < 32; i += 1) {
    const codeVal = reverseBits(i, 5)
    fixedDistanceCodes[i] = codeVal
    fixedDistanceDecode[codeVal] = i
    fixedDistanceDecodeLength[codeVal] = 5
  }
}

buildFixedTables()

/**
 * Finds the DEFLATE length code and extra bits for a given match length.
 * @param length The match length.
 * @returns An object with the code, base length, and number of extra bits.
 */
function findLengthCode(length: number) {
  if (length === 258) {
    return { code: 285, base: 258, extraBits: 0 }
  }
  for (let i = 0; i < LENGTH_BASE.length - 1; i += 1) {
    const base = LENGTH_BASE[i]
    const extra = LENGTH_EXTRA[i]
    const max = base + (1 << extra) - 1
    if (length >= base && length <= max) {
      return { code: 257 + i, base, extraBits: extra }
    }
  }
  throw new Error(`Invalid match length: ${length}`)
}

/**
 * Finds the DEFLATE distance code and extra bits for a given match distance.
 * @param distance The match distance.
 * @returns An object with the code, base distance, and number of extra bits.
 */
function findDistanceCode(distance: number) {
  for (let i = 0; i < DIST_BASE.length; i += 1) {
    const base = DIST_BASE[i]
    const extra = DIST_EXTRA[i]
    const max = base + (1 << extra) - 1
    if (distance >= base && distance <= max) {
      return { code: i, base, extraBits: extra }
    }
  }
  throw new Error(`Invalid match distance: ${distance}`)
}

/**
 * Implements the LZ77 algorithm to find duplicate strings and represent them as tokens.
 * This version uses a hash chain for performance.
 * @param data The input data to tokenize.
 * @returns An array of literal and match tokens.
 */
function collectTokens(data: Uint8Array): Token[] {
  const dataLength = data.length
  if (dataLength === 0) {
    return []
  }

  const tokens: Token[] = []
  const head = new Map<number, number>()
  const prev = new Int32Array(dataLength)
  prev.fill(-1)

  const hashableLimit = dataLength - (MIN_MATCH - 1)

  const computeKey = (position: number) =>
    (data[position] << 16) | (data[position + 1] << 8) | data[position + 2]

  const pruneHead = (key: number, position: number): number => {
    let node = head.get(key) ?? -1
    while (node !== -1 && position - node > WINDOW_SIZE) {
      node = prev[node]
    }
    if (node === -1) {
      head.delete(key)
    } else {
      head.set(key, node)
    }
    return node
  }

  const insertPosition = (position: number) => {
    if (position >= hashableLimit) {
      return
    }
    const key = computeKey(position)
    const node = pruneHead(key, position)
    prev[position] = node
    head.set(key, position)
  }

  const findBestMatch = (position: number) => {
    if (position >= hashableLimit) {
      return { length: 0, distance: 0 }
    }

    const key = computeKey(position)
    let candidate = pruneHead(key, position)
    let bestLength = 0
    let bestDistance = 0
    const maxMatch = Math.min(MAX_MATCH, dataLength - position)

    let attempts = 0
    while (candidate !== -1 && attempts < MAX_CHAIN_HITS) {
      const distance = position - candidate
      if (distance > WINDOW_SIZE) {
        break
      }

      if (
        bestLength >= MIN_MATCH &&
        (position + bestLength >= dataLength ||
          data[position + bestLength] !== data[candidate + bestLength])
      ) {
        candidate = prev[candidate]
        attempts += 1
        continue
      }

      let length = MIN_MATCH
      while (
        length < maxMatch &&
        data[position + length] === data[candidate + length]
      ) {
        length += 1
      }

      if (length > bestLength) {
        bestLength = length
        bestDistance = distance
        if (length >= MAX_MATCH) {
          break
        }
      }

      candidate = prev[candidate]
      attempts += 1
    }

    if (bestLength < MIN_MATCH) {
      return { length: 0, distance: 0 }
    }
    return { length: bestLength, distance: bestDistance }
  }

  let position = 0
  while (position < dataLength) {
    const bestMatch = findBestMatch(position)
    let bestLength = bestMatch.length
    const bestDistance = bestMatch.distance

    if (bestLength >= MIN_MATCH) {
      // Lazy matching: check if a better match is available at the next position.
      let useMatch = true
      if (bestLength < MAX_MATCH && position + 1 < dataLength) {
        const nextMatch = findBestMatch(position + 1)
        if (nextMatch.length > bestLength) {
          useMatch = false
        }
      }

      if (useMatch) {
        tokens.push({
          type: 'match',
          length: bestLength,
          distance: bestDistance
        })
        for (let i = 0; i < bestLength; i += 1) {
          insertPosition(position + i)
        }
        position += bestLength
        continue
      }

      bestLength = 0
    }

    // If no good match is found, or if lazy matching prefers a literal.
    tokens.push({ type: 'literal', value: data[position] })
    insertPosition(position)
    position += 1
  }

  return tokens
}

/**
 * Compresses data using the DEFLATE algorithm with fixed Huffman codes.
 * @param data The input data to compress.
 * @returns The DEFLATE-compressed data.
 */
function deflateFixed(data: Uint8Array): Uint8Array {
  const tokens = collectTokens(data)
  const writer = new BitWriter()

  // BFINAL: 1 (final block), BTYPE: 01 (fixed Huffman)
  writer.writeBits(1, 1)
  writer.writeBits(0b01, 2)

  for (const token of tokens) {
    if (token.type === 'literal') {
      writer.writeBits(
        fixedLiteralCodes[token.value],
        fixedLiteralLengths[token.value]
      )
    } else {
      // Write length code
      const info = findLengthCode(token.length)
      writer.writeBits(
        fixedLiteralCodes[info.code],
        fixedLiteralLengths[info.code]
      )
      if (info.extraBits > 0) {
        writer.writeBits(token.length - info.base, info.extraBits)
      }

      // Write distance code
      const distInfo = findDistanceCode(token.distance)
      writer.writeBits(fixedDistanceCodes[distInfo.code], 5)
      if (distInfo.extraBits > 0) {
        writer.writeBits(token.distance - distInfo.base, distInfo.extraBits)
      }
    }
  }

  // End of block symbol
  writer.writeBits(fixedLiteralCodes[256], fixedLiteralLengths[256])
  writer.alignToByte()
  return writer.toUint8Array()
}

/**
 * Reads a literal/length symbol from the stream using fixed Huffman tables.
 * @param reader The BitReader to read from.
 * @returns The decoded symbol.
 */
function readFixedLiteral(reader: BitReader): number {
  // Fast path for shorter codes
  const shortIndex = reader.peekBits(FIXED_LITERAL_SHORT_BITS)
  const shortLen = fixedLiteralShortLength[shortIndex]
  if (shortLen !== 0) {
    const symbol = fixedLiteralShortDecode[shortIndex]
    reader.readBits(shortLen)
    return symbol
  }

  // Slow path for longer codes
  const bits = reader.peekBits(FIXED_LITERAL_MAX_BITS)
  const symbol = fixedLiteralDecode[bits]
  const len = fixedLiteralDecodeLength[bits]
  if (symbol < 0 || len === 0) {
    throw new Error('Failed to decode literal/length symbol')
  }
  reader.readBits(len)
  return symbol
}

/**
 * Reads a distance symbol from the stream using fixed Huffman tables.
 * @param reader The BitReader to read from.
 * @returns The decoded symbol.
 */
function readFixedDistance(reader: BitReader): number {
  const bits = reader.peekBits(5)
  const symbol = fixedDistanceDecode[bits]
  const len = fixedDistanceDecodeLength[bits]
  if (symbol < 0 || len === 0) {
    throw new Error('Failed to decode distance symbol')
  }
  reader.readBits(len)
  return symbol
}

/**
 * Decompresses data using the DEFLATE algorithm with fixed Huffman codes.
 * @param data The DEFLATE-compressed data.
 * @returns The decompressed data.
 */
function inflateFixed(data: Uint8Array): Uint8Array {
  const reader = new BitReader(data)
  const out: number[] = []
  let done = false

  while (!done) {
    const isFinal = reader.readBits(1) === 1
    const type = reader.readBits(2)

    if (type === 0) {
      // Stored block
      reader.alignToByte()
      const len = reader.readByte() | (reader.readByte() << 8)
      const nlen = reader.readByte() | (reader.readByte() << 8)
      if ((len ^ 0xffff) !== nlen) {
        throw new Error('Stored block length mismatch')
      }
      for (let i = 0; i < len; i += 1) {
        out.push(reader.readByte())
      }
    } else if (type === 1) {
      // Fixed Huffman block
      while (true) {
        const symbol = readFixedLiteral(reader)
        if (symbol < 256) {
          // Literal
          out.push(symbol)
          continue
        }
        if (symbol === 256) {
          // End of block
          break
        }
        // Length
        const lengthInfo = symbol - 257
        if (lengthInfo < 0 || lengthInfo >= LENGTH_BASE.length) {
          throw new Error('Invalid length symbol')
        }
        const baseLen = LENGTH_BASE[lengthInfo]
        const extraLen = LENGTH_EXTRA[lengthInfo]
        const matchLength =
          baseLen + (extraLen > 0 ? reader.readBits(extraLen) : 0)

        // Distance
        const distSymbol = readFixedDistance(reader)
        const baseDist = DIST_BASE[distSymbol]
        const extraDist = DIST_EXTRA[distSymbol]
        const distance =
          baseDist + (extraDist > 0 ? reader.readBits(extraDist) : 0)

        // Copy matched bytes
        const start = out.length - distance
        if (start < 0) {
          throw new Error('Invalid match distance')
        }
        for (let i = 0; i < matchLength; i += 1) {
          out.push(out[start + i])
        }
      }
    } else {
      throw new Error('Unsupported DEFLATE block type')
    }

    if (isFinal) {
      done = true
    }
  }

  return Uint8Array.from(out)
}

/**
 * Reads a 32-bit little-endian integer from a byte array.
 * @param bytes The byte array to read from.
 * @param offset The offset to start reading.
 * @returns The 32-bit unsigned integer.
 */
function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  )
}

/**
 * Writes a 32-bit little-endian integer to a byte array.
 * @param target The byte array to write to.
 * @param offset The offset to start writing.
 * @param value The 32-bit integer to write.
 */
function writeUint32LE(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff
  target[offset + 1] = (value >>> 8) & 0xff
  target[offset + 2] = (value >>> 16) & 0xff
  target[offset + 3] = (value >>> 24) & 0xff
}

/**
 * Compresses data into the Gzip format.
 *
 * Note: This is a simplified Gzip implementation for browser environments.
 * It does not support all Gzip header options and is intended for basic use cases.
 * For more complex needs, a mature library like `node:zlib` is recommended.
 *
 * @param data The raw data to compress.
 * @returns A Uint8Array containing the Gzip-compressed data.
 */
export function gzipCompress(data: Uint8Array): Uint8Array {
  const deflated = deflateFixed(data)
  const crc = crc32(data)
  const result = new Uint8Array(10 + deflated.length + 8)

  // Gzip header
  result[0] = GZIP_ID1
  result[1] = GZIP_ID2
  result[2] = GZIP_CM_DEFLATE
  result[3] = 0 // Flags
  result[4] = 0 // MTIME
  result[5] = 0
  result[6] = 0
  result[7] = 0
  result[8] = 0 // XFL
  result[9] = 0xff // OS

  // DEFLATE payload
  result.set(deflated, 10)

  // Gzip footer
  writeUint32LE(result, result.length - 8, crc)
  writeUint32LE(result, result.length - 4, data.length >>> 0)
  return result
}

/**
 * Decompresses data from the Gzip format.
 * @param data The Gzip-compressed data.
 * @returns A Uint8Array containing the decompressed raw data.
 * @throws If the data is not valid Gzip or uses unsupported features.
 */
export function gzipDecompress(data: Uint8Array): Uint8Array {
  if (data.length < 18) {
    throw new Error('Invalid gzip data')
  }
  if (
    data[0] !== GZIP_ID1 ||
    data[1] !== GZIP_ID2 ||
    data[2] !== GZIP_CM_DEFLATE
  ) {
    throw new Error('Unsupported gzip header')
  }

  const flags = data[3]
  let offset = 10

  // Skip optional header fields if present
  if ((flags & 0x04) !== 0) {
    // FEXTRA
    if (offset + 2 > data.length) {
      throw new Error('Invalid gzip extra field length')
    }
    const xlen = data[offset] | (data[offset + 1] << 8)
    offset += 2 + xlen
  }
  if ((flags & 0x08) !== 0) {
    // FNAME
    while (offset < data.length && data[offset] !== 0) {
      offset += 1
    }
    offset += 1
  }
  if ((flags & 0x10) !== 0) {
    // FCOMMENT
    while (offset < data.length && data[offset] !== 0) {
      offset += 1
    }
    offset += 1
  }
  if ((flags & 0x02) !== 0) {
    // FHCRC
    offset += 2
  }

  if (offset > data.length - 8) {
    throw new Error('Incomplete gzip payload')
  }

  const payload = data.subarray(offset, data.length - 8)
  const inflated = inflateFixed(payload)

  const expectedCrc = readUint32LE(data, data.length - 8)
  const expectedSize = readUint32LE(data, data.length - 4)

  if (crc32(inflated) !== expectedCrc) {
    throw new Error('CRC32 mismatch')
  }
  if ((inflated.length & 0xffffffff) !== expectedSize) {
    throw new Error('Size mismatch')
  }

  return inflated
}

/**
 * Compresses a string into a Gzip-formatted Uint8Array.
 * The string is first encoded to UTF-8.
 * @param text The string to compress.
 * @returns A Uint8Array containing the Gzip-compressed data.
 */
export function gzipCompressString(text: string): Uint8Array {
  return gzipCompress(new TextEncoder().encode(text))
}

/**
 * Decompresses Gzip data into a string.
 * The decompressed data is decoded as UTF-8.
 * @param data The Gzip-compressed data.
 * @returns The decompressed string.
 */
export function gzipDecompressToString(data: Uint8Array): string {
  return new TextDecoder().decode(gzipDecompress(data))
}

/**
 * Checks if the given data is in Gzip format by inspecting the magic numbers.
 * @param data The data to check.
 * @returns True if the data is Gzip-formatted, false otherwise.
 */
export function isGzip(data: Uint8Array): boolean {
  return (
    data.length > 3 &&
    data[0] === GZIP_ID1 &&
    data[1] === GZIP_ID2 &&
    data[2] === GZIP_CM_DEFLATE
  )
}
