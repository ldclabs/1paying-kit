import { ed25519 } from '@noble/curves/ed25519'
import { randomBytes } from '@noble/hashes/utils'
import { encode, rfc8949EncodeOptions } from 'cborg'
import { gzipCompress } from './gzip.js'
import type {
  Message,
  PaymentRequirementsResponse,
  TransactionState
} from './types.js'
import { toMessageCompact, type SettleResponse } from './types.js'
import { base64ToString, bytesToBase64Url } from './utils.js'

export * from './gzip.js'
export * from './types.js'
export * from './utils.js'

const PAYING_ENDPOINT = 'https://1pay.ing/sign'
const API_ENDPOINT = 'https://api.1pay.ing/tx'

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
   * An AbortSignal to cancel the operation.
   */
  signal?: AbortSignal
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
  async tryGetPayUrl(res: Response): Promise<{
    payUrl: string | null
    txid: string | null
  }> {
    if (res.status !== 402) {
      return { payUrl: null, txid: null }
    }
    const requirements: PaymentRequirementsResponse = await res.json()
    return this.getPayUrl(requirements)
  }

  /**
   * Generates a payment URL and transaction ID from payment requirements.
   * @param requirements The payment requirements response from the server.
   * @returns An object containing the payment URL and the transaction ID.
   */
  async getPayUrl(requirements: PaymentRequirementsResponse): Promise<{
    payUrl: string
    txid: string
  }> {
    const message: Message<PaymentRequirementsResponse> = {
      pubkey: this.#pk,
      nonce: this.#nextNonce(),
      payload: requirements
    }

    const cborBytes = encode(toMessageCompact(message), rfc8949EncodeOptions)
    const signature = this.#sign(cborBytes)
    const txid = bytesToBase64Url(signature)
    const msg = bytesToBase64Url(await gzipCompress(cborBytes))

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
    const signal: AbortSignal | null | undefined = options.signal
    const startTime = Date.now()
    const url = `${API_ENDPOINT}/${txid}`

    // Initial delay to allow payment processing to start
    await new Promise((resolve) =>
      setTimeout(resolve, options.initialDelayMs ?? 5000)
    )

    while (true) {
      attempt += 1
      const response = await fetch(url, { signal })
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

  /**
   * (Optional) Submits a settle response to update the transaction status.
   * @param txid The transaction ID to update.
   * @param res The settle response containing the transaction and success status.
   */
  async submitSettleResult(
    txid: string,
    res: SettleResponse | string
  ): Promise<void> {
    const info: SettleResponse =
      typeof res === 'string'
        ? JSON.parse(base64ToString(res))
        : res
    await fetch(`${API_ENDPOINT}/${txid}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tx: info.transaction,
        status: info.success ? 'finalized' : 'failed'
      })
    })
  }

  #nextNonce(): number {
    this.#nonce += 1
    return this.#nonce
  }

  #sign(message: Uint8Array): Uint8Array {
    return ed25519.sign(message, this.#sk)
  }

  verify(message: Uint8Array, signature: Uint8Array): boolean {
    return ed25519.verify(signature, message, this.#pk)
  }
}

/**
 * A default instance of the PayingKit.
 */
export const payingKit = new PayingKit()
