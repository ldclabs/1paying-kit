const GZIP_ID1 = 0x1f
const GZIP_ID2 = 0x8b
const GZIP_CM_DEFLATE = 8

const supportsNativeCompression =
  typeof CompressionStream !== 'undefined' &&
  typeof Blob !== 'undefined' &&
  typeof Response !== 'undefined'

const supportsNativeDecompression =
  typeof DecompressionStream !== 'undefined' &&
  typeof Blob !== 'undefined' &&
  typeof Response !== 'undefined'

export function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = data
  if (byteLength === 0) {
    return new ArrayBuffer(0)
  }
  if (buffer instanceof ArrayBuffer) {
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer
    }
    return buffer.slice(byteOffset, byteOffset + byteLength)
  }
  const copy = new Uint8Array(byteLength)
  copy.set(data)
  return copy.buffer
}

export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  if (!supportsNativeCompression) {
    return Promise.resolve(data)
  }
  const stream = new CompressionStream('gzip')
  const chunk = toArrayBuffer(data)
  const resultStream = new Blob([chunk]).stream().pipeThrough(stream)
  const buffer = await new Response(resultStream).arrayBuffer()
  return new Uint8Array(buffer)
}

export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  if (!supportsNativeDecompression) {
    return Promise.resolve(data)
  }
  const stream = new DecompressionStream('gzip')
  const chunk = toArrayBuffer(data)
  const resultStream = new Blob([chunk]).stream().pipeThrough(stream)
  const buffer = await new Response(resultStream).arrayBuffer()
  return new Uint8Array(buffer)
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
