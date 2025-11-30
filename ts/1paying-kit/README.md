# 1Paying Kit (TypeScript)

This is the TypeScript version of the client SDK for [1Pay.ing](https://1pay.ing), a decentralized payment protocol. It provides a simple and efficient way to integrate 1Pay.ing into your web applications, enabling you to request and verify payments with ease.

This library is designed to be lightweight and work in modern browser environments, using standard Web APIs like `fetch` and the Web Crypto API where possible.

## Features

- **Easy Integration**: A simple `PayingKit` class to handle payment flows.
- **Automatic 402 Handling**: `tryGetPayUrl` method to automatically handle `402 Payment Required` responses.
- **Payment URL Generation**: Create payment URLs from server-provided requirements.
- **Payment Verification**: `waitForPaymentPayload` to poll for payment completion and retrieve the payload.
- **Lightweight**: Minimal dependencies, relying on `@noble/` for cryptography and `cborg` for CBOR encoding.

## Installation

You can install the package using npm or your favorite package manager:

```bash
npm install @ldclabs/1paying-kit
```

## Usage

Here's a basic example of how to use the `PayingKit` to handle a payment-required API response.

```typescript
import { payingKit } from '@ldclabs/1paying-kit'

async function fetchData() {
  let response = await fetch('https://api.example.com/premium-data')

  // Check if payment is required
  const {payUrl, txid} = await payingKit.tryGetPayUrl(response)
  if (payUrl) {
    // Payment is required, handle it with the kit
    console.log(`Please complete the payment at: ${payUrl}`)
    window.open(payUrl, '1Pay.ing') // Redirect user to sign the payment

    try {
      const payload = await payingKit.waitForPaymentPayload(txid, {
        onprogress: (state) => {
          console.log(`Payment status: ${state.status}, attempt: ${state.attempt}`)
        },
      })
      console.log('Payment successful! Received x402 PaymentPayload:', payload)

      // Now you can retry the original request with the payment payload
      // typically in an 'Authorization' or 'X-Payment' header.
      response = await fetch('https://api.example.com/premium-data', {
        headers: {
          'X-PAYMENT': payload,
        },
      })
    } catch (error) {
      console.error('Payment failed or timed out:', error)
      throw error
    }
  }

  // Process the successful response
  const data = await response.json()
  console.log('Data received:', data)
}
```

## API Reference

### `PayingKit`

The main class for interacting with the 1Pay.ing service.

#### `payingKit`

An instance of the `PayingKit` class initialized with a new Ed25519 key pair.

#### `async tryGetPayUrl(res: Response): Promise<{ payUrl: string | null; txid: string | null }>`

Parses a `fetch` `Response`. If the status is `402` and the `X-PAYMENT-RESPONSE` header is present, it returns an object with the `payUrl` and `txid`. Otherwise, it returns an empty object.

#### `async getPayUrl(requirements: PaymentRequirementsResponse): Promise<{ payUrl: string; txid: string }>`

Generates a payment URL and transaction ID from the payment requirements provided by the server.

#### `waitForPaymentPayload(txid: string, options?: PayingKitOptions): Promise<string>`

Polls the 1Pay.ing transaction service until the payment is completed.

- `txid`: The transaction ID from `getPayUrl` or `tryGetPayUrl`.
- `options`:
  - `timeoutMs` (optional): Timeout in milliseconds. Defaults to 3 minutes.
  - `onprogress` (optional): A callback function `(state: TransactionState & { attempt: number }) => void` that receives polling status updates.

Returns a promise that resolves with the base64-encoded payment payload upon success or rejects on failure or timeout.

### Gzip Utilities

The library also exports the underlying Gzip compression and decompression functions.

- `async gzipCompress(data: Uint8Array): Promise<Uint8Array>`
- `async gzipDecompress(data: Uint8Array): Promise<Uint8Array>`
- `isGzip(data: Uint8Array): boolean`

## License

Copyright © 2025 [LDC Labs](https://github.com/ldclabs).

Licensed under the Apache License. See [LICENSE](LICENSE) for details.
