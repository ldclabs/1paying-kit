# 1Pay.ing Kit

![1Pay.ing Logo](./1Pay.ing.webp)

[![npm version](https://img.shields.io/npm/v/@ldclabs/1paying-kit.svg)](https://www.npmjs.com/package/@ldclabs/1paying-kit)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English readme](./README.md) | [中文说明](./README_CN.md)

**1Pay.ing Kit** is a client-side SDK that implements the **x402** payment specification proposed by Coinbase—a concrete implementation of HTTP 402—designed to radically simplify the integration and use of Web3 payments.

## Core Philosophy

The x402 specification decouples backend applications from payment services by introducing the "Facilitator" role. **1Pay.ing** builds on this by solving the client-side problem, acting as a "client-side facilitator" that provides a unified payment wallet and SDK. This decouples the client application from the user's specific wallet.

-   **Dual Decoupling**: The backend doesn't need to handle payment specifics, and the client application doesn't need to know which wallet the user has.
-   **Permissionless**: Any application can integrate it, and any user can pay, without prior registration or approval.
-   **Built on Web Standards**: Based on the HTTP 402 status code, making integration minimally invasive to existing web architectures.

## How It Works

`1paying-kit` greatly simplifies the client-side logic for handling HTTP 402 responses.

1.  **Request a Resource**: Your client application requests a protected API as usual.
2.  **Receive a 402 Response**: Your backend service (the resource owner), following the x402 specification, **generates the payment requirements** and returns them to the client with an `HTTP 402 Payment Required` response.
3.  **Handle Payment**: `1paying-kit` intercepts the 402 response, generates a `1Pay.ing` payment link, and the client guides the user to the `1Pay.ing` wallet to complete the payment signature.
4.  **Get Payment Payload**: After the application captures the payment payload via `1paying-kit`, it uses the payload to request the backend again.
5.  **Settle Payment**: The backend receives the resource request with the payment payload, sends the payload to the x402 Facilitator, and waits for settlement.
6.  **Return Resource**: After the Facilitator settles the payment, the backend service can return the protected resource to the client application.

## Repository Contents

This is a monorepo containing the following main parts:

-   [`ts/1paying-kit`](https://github.com/ldclabs/1paying-kit/tree/main/ts/1paying-kit): The core TypeScript SDK (`@ldclabs/1paying-kit`). It provides all the tools needed to handle the HTTP 402 payment flow on the client side.
-   [`examples/1paying-coffee-app`](https://github.com/ldclabs/1paying-kit/tree/main/examples/1paying-coffee-app): A frontend demo application built with SvelteKit. It fully demonstrates how to use `1paying-kit` to interact with a payment-protected backend.
-   [`examples/1paying-coffee-cli`](https://github.com/ldclabs/1paying-kit/tree/main/examples/1paying-coffee-cli): A command-line interface (CLI) demo application. It demonstrates how to use `1paying-kit` in a Node.js environment to handle the entire HTTP 402 payment flow from the terminal.
-   [`examples/1paying-coffee-worker`](https://github.com/ldclabs/1paying-kit/tree/main/examples/1paying-coffee-worker): A backend demo application built with Cloudflare Workers. It shows how to protect an API endpoint and verify payments by integrating with an x402 facilitator.

## Getting Started (Running the Demo)

The fastest way to understand `1paying-kit` is to run the "Buy Me a Coffee" demo project.

### Online Demo

[https://1paying-coffee.zensh.workers.dev/](https://1paying-coffee.zensh.workers.dev/)

### Prerequisites

-   [Node.js](https://nodejs.org/) (v20 or later)
-   [pnpm](https://pnpm.io/)

### Local Development

1.  **Install Dependencies:**
    In the repository root, run:
    ```sh
    pnpm install
    ```

2.  **Start the Backend Worker:**
    Open a new terminal and start the local development server for the Cloudflare Worker.
    ```sh
    pnpm --filter 1paying-coffee-worker dev
    ```
    The backend service will be running at `http://localhost:8787`.

3.  **Start the Frontend App:**
    In another terminal, start the development server for the SvelteKit frontend app.
    ```sh
    pnpm --filter 1paying-coffee-app dev
    ```
    You can now open `http://localhost:5173` in your browser to experience the full payment flow.

## Usage in Your Project

Using `1paying-kit` in your own project is straightforward.

### Installation

```bash
npm install @ldclabs/1paying-kit
```

### Basic Usage

`1paying-kit` can automatically handle the 402 flow by intercepting `fetch`, or you can handle it manually.

This example is designed to be the simplest possible demonstration of a complete `1paying-kit` integration.
```typescript
import { payingKit } from '@ldclabs/1paying-kit'
import { stdin as input, stdout as output } from 'node:process'
import * as readline from 'node:readline/promises'
import { exec } from 'node:child_process'
import { ProxyAgent, setGlobalDispatcher } from 'undici'

const proxy = process.env.http_proxy || process.env.https_proxy
if (proxy) {
  console.log(`Using proxy: ${proxy}`)
  setGlobalDispatcher(new ProxyAgent(proxy))
}

// Run with: npx tsx cli.ts
async function main() {
  const rl = readline.createInterface({ input, output })
  const coffeeStore = 'https://1paying-coffee.zensh.workers.dev'

  console.log('Welcome to the 1Paying Coffee CLI!')
  let response = await fetch(`${coffeeStore}/api/make-coffee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  console.log(`Initial response status: ${response.status}`)
  const { payUrl, txid } = await payingKit.tryGetPayUrl(response)
  if (payUrl && txid) {
    // Payment is required, handle it with the kit
    const _answer = await rl.question(
      `Press ENTER to open in the browser...\n${payUrl} (Enter)`
    )

    // Redirect user to sign the payment
    exec(`open "${payUrl}"`)

    try {
      const payloadHeader = await payingKit.waitForPaymentPayload(txid, {
        onprogress: (state) => {
          process.stdout.write(`\rPayment status: ${state.status}`)
        }
      })

      // Now you can retry the original request with the payment payload
      // typically in an 'Authorization' or 'X-Payment' header.
      response = await fetch(`${coffeeStore}/api/make-coffee`, {
        method: 'POST',
        headers: {
          'X-PAYMENT': payloadHeader
        }
      })
    } catch (error) {
      console.error('Payment failed or timed out:', error)
      throw error
    }
  }

  rl.close()
  // Process the successful response
  const data = await response.json()
  console.log('Your coffee:', data)
}

main().catch((error) => {
  console.error('Error in main:', error)
})
```

## License

Copyright © 2025 [LDC Labs](https://github.com/ldclabs).

This project is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details.