/**
 * Represents the state of a 1Pay.ing payment transaction.
 */
export interface TransactionState {
  /** The status of the transaction. */
  status: 'pending' | 'accepted' | 'completed' | 'error'
  /** Details about an error if the transaction failed. */
  error?: { code: number; message: string; data?: unknown }
  /** The result of the transaction, typically a PaymentPayload encoded as a base64 string. */
  result?: string
}

/**
 * Represents a generic message structure.
 * @template T The type of the payload, typically a PaymentRequirementsResponse
 */
export interface Message<T> {
  /** The public key of the sender, 32 bytes ed25519. */
  pubkey: Uint8Array // 32 bytes ed25519 pubkey
  /** A number used once to prevent replay attacks. */
  nonce: number
  /** The payload of the message. */
  payload: T
}

/**
 * Represents a compact version of a generic message structure.
 * @template TC The type of the compact payload.
 */
export interface MessageCompact<TC> {
  /** The public key of the sender. */
  pk: Uint8Array // pubkey
  /** A number used once to prevent replay attacks. */
  n: number // nonce
  /** The compact payload of the message, typically a PaymentRequirementsResponseCompact */
  p: TC // payload
}

/**
 * Converts a compact or standard message into a standard `Message<PaymentRequirementsResponse>`.
 * @param msg The message to convert.
 * @returns The standard message.
 */
export function toMessage(
  msg:
    | MessageCompact<PaymentRequirementsResponseCompact>
    | Message<PaymentRequirementsResponse>
): Message<PaymentRequirementsResponse> {
  if ('pubkey' in msg && 'nonce' in msg && 'payload' in msg) {
    return msg
  }

  return {
    pubkey: msg.pk,
    nonce: msg.n,
    payload: {
      x402Version: msg.p.x,
      error: msg.p.e,
      accepts: msg.p.a.map(toPaymentRequirements)
    }
  }
}

/**
 * Converts a standard or compact message into a compact `MessageCompact<PaymentRequirementsResponseCompact>`.
 * @param msg The message to convert.
 * @returns The compact message.
 */
export function toMessageCompact(
  msg:
    | MessageCompact<PaymentRequirementsResponseCompact>
    | Message<PaymentRequirementsResponse>
): MessageCompact<PaymentRequirementsResponseCompact> {
  if ('pk' in msg && 'n' in msg && 'p' in msg) {
    return msg
  }

  return {
    pk: msg.pubkey,
    n: msg.nonce,
    p: {
      x: msg.payload.x402Version,
      e: msg.payload.error,
      a: msg.payload.accepts.map(toPaymentRequirementsCompact)
    }
  }
}

/**
 * The x402 requirements for a payment.
 */
export interface PaymentRequirements {
  /** Payment scheme identifier (e.g., "exact"). */
  scheme: 'exact' | 'upto'
  /** Blockchain network identifier (e.g., "icp-druyg-tyaaa-aaaaq-aactq-cai"). */
  network: string
  /** Required payment amount in atomic token units. */
  maxAmountRequired: string
  /** Token ledger canister address. */
  asset: string
  /** Recipient wallet address for the payment. */
  payTo: string
  /** The protected resource, e.g., URL of the resource endpoint. */
  resource: string
  /** Human-readable description of the resource. */
  description: string
  /** MIME type of the expected response. */
  mimeType?: string
  /** JSON schema describing the response format. */
  outputSchema?: object
  /** Maximum time allowed for payment completion in seconds. */
  maxTimeoutSeconds: number
  /** Scheme-specific additional information. */
  extra?: object
}

/**
 * Represents a compact version of `PaymentRequirements`.
 */
export interface PaymentRequirementsCompact {
  /** Payment scheme identifier. */
  s: 'exact' | 'upto' // scheme
  /** Blockchain network identifier. */
  n: string // network
  /** Required payment amount in atomic token units. */
  mar: string // maxAmountRequired
  /** Token ledger canister address. */
  a: string // asset
  /** Recipient wallet address for the payment. */
  p: string // payTo
  /** The protected resource. */
  r: string // resource
  /** Human-readable description of the resource. */
  d: string // description
  /** MIME type of the expected response. */
  mt?: string // mimeType
  /** JSON schema describing the response format. */
  os?: object // outputSchema
  /** Maximum time allowed for payment completion in seconds. */
  mts: number // maxTimeoutSeconds
  /** Scheme-specific additional information. */
  ex?: object // extra
}

/**
 * Converts a compact or standard payment requirement into a standard `PaymentRequirements`.
 * @param req The payment requirement to convert.
 * @returns The standard `PaymentRequirements` object.
 */
export function toPaymentRequirements(
  req: PaymentRequirementsCompact | PaymentRequirements
): PaymentRequirements {
  if ('scheme' in req) {
    return req
  }

  const obj: PaymentRequirements = {
    scheme: req.s,
    network: req.n,
    maxAmountRequired: req.mar,
    asset: req.a,
    payTo: req.p,
    resource: req.r,
    description: req.d,
    maxTimeoutSeconds: req.mts
  }
  if (req.mt) {
    obj.mimeType = req.mt
  }
  if (req.os) {
    obj.outputSchema = req.os
  }
  if (req.ex) {
    obj.extra = req.ex
  }
  return obj
}

/**
 * Converts a standard or compact payment requirement into a compact `PaymentRequirementsCompact`.
 * @param req The payment requirement to convert.
 * @returns The compact `PaymentRequirementsCompact` object.
 */
export function toPaymentRequirementsCompact(
  req: PaymentRequirementsCompact | PaymentRequirements
): PaymentRequirementsCompact {
  if ('s' in req) {
    return req
  }

  const obj: PaymentRequirementsCompact = {
    s: req.scheme,
    n: req.network,
    mar: req.maxAmountRequired,
    a: req.asset,
    p: req.payTo,
    r: req.resource,
    d: req.description,
    mts: req.maxTimeoutSeconds
  }
  if (req.mimeType) {
    obj.mt = req.mimeType
  }
  if (req.outputSchema) {
    obj.os = req.outputSchema
  }
  if (req.extra) {
    obj.ex = req.extra
  }
  return obj
}

/**
 * Represents the response containing payment requirements.
 */
export interface PaymentRequirementsResponse {
  /** The version of the X402 protocol. */
  x402Version: number
  /** An error message if the request failed. */
  error: string
  /** A list of accepted payment requirements. */
  accepts: PaymentRequirements[]
}

/**
 * Represents a compact version of `PaymentRequirementsResponse`.
 */
export interface PaymentRequirementsResponseCompact {
  /** The version of the X402 protocol. */
  x: number // x402Version
  /** An error message if the request failed. */
  e: string // error
  /** A list of accepted compact payment requirements. */
  a: PaymentRequirementsCompact[] // accepts
}

/**
 * Represents a generic payment payload.
 * @template T The type of the scheme-specific payload.
 */
export interface PaymentPayload<T> {
  /** The version of the X402 protocol. */
  x402Version: number
  /** The payment scheme identifier. */
  scheme: string
  /** The blockchain network identifier. */
  network: string
  /** The scheme-specific payload. */
  payload: T
}

/** Represents the verification and settlement request structure for X402 payments.
 * @template T The type of the payment payload.
 */
export interface X402Request<T> {
  paymentPayload: PaymentPayload<T>
  paymentRequirements: PaymentRequirements
}

/**
 * Represents the response for verifying a payment.
 */
export interface VerifyResponse {
  /** Indicates whether the payment is valid. */
  isValid: boolean
  /** The address of the payer. */
  payer: string
  /** The reason why the payment is invalid, if applicable. */
  invalidReason?: string
}

/**
 * Represents the response for settling a payment.
 */
export interface SettleResponse {
  /** Indicates whether the settlement was successful. */
  success: boolean
  /** The reason why the settlement failed, if applicable. */
  errorReason?: string
  /** The ID of the transaction being settled. */
  transaction: string
  /** The blockchain network where the transaction was processed. */
  network: string
  /** The address of the payer. */
  payer: string
}

/**
 * Represents the result of updating a payment transaction status.
 */
export type UpdatePaymentTxStatus = {
  tx: string
  status: 'finalized' | 'failed'
}
