/**
 * Encodes a Uint8Array to a base64 string.
 * @param bytes The Uint8Array to encode.
 * @returns The base64 encoded string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof (bytes as any).toBase64 === 'function') {
    return (bytes as any).toBase64()
  }
  return globalThis.btoa(String.fromCharCode(...bytes))
}

/**
 * Encodes a Uint8Array to a base64url string.
 * @param bytes The Uint8Array to encode.
 * @returns The base64url encoded string.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof (bytes as any).toBase64 === 'function') {
    return (bytes as any).toBase64({ alphabet: 'base64url', omitPadding: true })
  }

  return globalThis
    .btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/**
 * Decodes a base64 or base64url encoded string to a Uint8Array.
 * @param str The base64 or base64url encoded string.
 * @returns The decoded Uint8Array.
 */
export function base64ToBytes(str: string): Uint8Array {
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    if (str.includes('-') || str.includes('_')) {
      return (Uint8Array as any).fromBase64(str, { alphabet: 'base64url' })
    }
    return (Uint8Array as any).fromBase64(str)
  }
  return Uint8Array.from(
    globalThis.atob(str.replaceAll('-', '+').replaceAll('_', '/')),
    (m) => m.charCodeAt(0)
  )
}

/**
 * Decodes a base64 or base64url encoded string to a regular string.
 * @param str The base64 or base64url encoded string.
 * @returns The decoded string.
 */
export function base64ToString(str: string): string {
  return globalThis.atob(str.replaceAll('-', '+').replaceAll('_', '/'))
}

/**
 * Encodes a regular string to a base64 string.
 * @param str The string to encode.
 * @returns The base64 encoded string.
 */
export function stringToBase64(str: string): string {
  return globalThis.btoa(str)
}
