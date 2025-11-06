import { ed25519 } from '@noble/curves/ed25519'
import { randomBytes } from '@noble/hashes/utils'
import { encode, rfc8949EncodeOptions } from 'cborg'
import { gzipCompress } from './gzip.js'
import type {
  Message,
  PaymentRequirementsResponse,
  TransactionState
} from './types.js'
import { toMessageCompact } from './types.js'

export {
  gzipCompress,
  gzipCompressString,
  gzipDecompress,
  gzipDecompressToString
} from './gzip.js'
export * from './types.js'

const PAYING_ENDPOINT = 'https://1pay.ing/app'
const TXS_ENDPOINT = 'https://txs.1pay.ing/tx'

/**
 * Options for the PayingKit.
 */
export interface PayingKitOptions {
  /**
   * Timeout in milliseconds for waiting for the payment payload.
   * @default 180000 (3 minutes)
   */
  timeoutMs?: number
  /**
   * Initial delay in milliseconds before starting to poll for the transaction status.
   * @default 5000 (5 seconds)
   */
  initialDelayMs?: number
  /**
   * A callback function that is called with the transaction state during polling.
   * @param state The current state of the transaction, including the attempt number.
   */
  onprogress?: (state: TransactionState & { attempt: number }) => void
}

/**
 * The PayingKit class provides methods to interact with the 1pay.ing service.
 */
export class PayingKit {
  #nonce = 0
  #sk: Uint8Array
  #pk: Uint8Array

  /**
   * Creates a new instance of the PayingKit.
   * A new key pair is generated for each instance.
   */
  constructor() {
    this.#sk = randomBytes(32)
    this.#pk = ed25519.getPublicKey(this.#sk)
  }

  /**
   * Tries to get a payment URL and transaction ID from a fetch Response.
   * It checks if the response status is 402 (Payment Required) and if the 'X-PAYMENT-RESPONSE' header is present.
   * @param res The fetch Response object.
   * @returns A object containing the payment URL and transaction ID, or an empty object if payment is not required.
   */
  tryGetPayUrl(res: Response):
    | {
        payUrl: string
        txid: string
      }
    | {} {
    if (res.status !== 402) {
      return {}
    }
    let header = res.headers.get('X-PAYMENT-RESPONSE')
    if (!header) {
      return {}
    }
    const requirements: PaymentRequirementsResponse = JSON.parse(
      base64ToString(header)
    )
    return this.getPayUrl(requirements)
  }

  /**
   * Generates a payment URL and transaction ID from payment requirements.
   * @param requirements The payment requirements response from the server.
   * @returns An object containing the payment URL and the transaction ID.
   */
  getPayUrl(requirements: PaymentRequirementsResponse): {
    payUrl: string
    txid: string
  } {
    const message: Message<PaymentRequirementsResponse> = {
      pubkey: this.#pk,
      nonce: this.#nextNonce(),
      payload: requirements
    }
    const bytes = encode(message, rfc8949EncodeOptions)
    const signature = this.#sign(bytes)
    const txid = bytesToBase64Url(signature)
    const cborBytes = encode(toMessageCompact(message), rfc8949EncodeOptions)
    const compressed = gzipCompress(cborBytes)
    const msg = bytesToBase64Url(compressed)

    return {
      payUrl: `${PAYING_ENDPOINT}?action=pay#msg=${msg}&txid=${txid}`,
      txid
    }
  }

  /**
   * Waits for a payment to be completed and returns the payment payload.
   * This method polls the transaction status endpoint until the transaction is completed or fails.
   * @param txid The transaction ID to wait for.
   * @param options Options for the operation, such as timeout and progress callback.
   * @returns A promise that resolves with the base64-encoded payment payload.
   */
  async waitForPaymentPayload(
    txid: string,
    options: PayingKitOptions = {}
  ): Promise<string> {
    let attempt = 0
    let requestFailed = 0
    const timeoutMs = options.timeoutMs ?? 1000 * 60 * 3 // default 3 minutes
    const startTime = Date.now()
    const url = `${TXS_ENDPOINT}/${txid}`

    // Initial delay to allow payment processing to start
    await new Promise((resolve) =>
      setTimeout(resolve, options.initialDelayMs ?? 5000)
    )

    while (true) {
      attempt += 1
      const response = await fetch(url)
      if (response.status === 200) {
        requestFailed = 0
        const data: TransactionState = await response.json()
        if (data.status === 'completed' && data.result) {
          return data.result
        } else if (data.status === 'error') {
          throw (
            data.error ?? new Error('Unknown error during payment processing')
          )
        } else if (options.onprogress) {
          options.onprogress({ ...data, attempt })
        }
      } else {
        requestFailed += 1
        if (requestFailed >= 3) {
          const text = await response.text()
          throw new Error(
            `Failed to fetch transaction status after 3 attempts: ${text}`
          )
        }

        if (options.onprogress) {
          options.onprogress({ status: 'pending', attempt })
        }
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Timeout waiting for payment payload')
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  #nextNonce(): number {
    this.#nonce += 1
    return this.#nonce
  }

  #sign(message: Uint8Array): Uint8Array {
    return ed25519.sign(message, this.#sk)
  }

  #verify(message: Uint8Array, signature: Uint8Array): boolean {
    return ed25519.verify(message, signature, this.#pk)
  }
}

/**
 * A default instance of the PayingKit.
 */
export const payingKit = new PayingKit()

// function bytesToBase64(bytes: Uint8Array): string {
//   return globalThis.btoa(String.fromCharCode(...bytes))
// }

function bytesToBase64Url(bytes: Uint8Array): string {
  return globalThis
    .btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

// function base64ToBytes(str: string): Uint8Array {
//   return Uint8Array.from(
//     globalThis.atob(str.replaceAll('-', '+').replaceAll('_', '/')),
//     (m) => m.charCodeAt(0)
//   )
// }

function base64ToString(str: string): string {
  return globalThis.atob(str.replaceAll('-', '+').replaceAll('_', '/'))
}
