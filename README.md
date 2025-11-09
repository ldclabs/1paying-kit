# 1Pay.ing Kit

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

-   `ts/1paying-kit`: The core TypeScript SDK (`@ldclabs/1paying-kit`). It provides all the tools needed to handle the HTTP 402 payment flow on the client side.
-   `examples/1paying-coffee-app`: A frontend demo application built with SvelteKit. It fully demonstrates how to use `1paying-kit` to interact with a payment-protected backend.
-   `examples/1paying-coffee-worker`: A backend demo application built with Cloudflare Workers. It shows how to protect an API endpoint and verify payments by integrating with an x402 facilitator.

## Getting Started (Running the Demo)

The fastest way to understand `1paying-kit` is to run the "Buy Me a Coffee" demo project.

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

```typescript
import { payingKit } from '@ldclabs/1paying-kit'

async function fetchData() {
  let response = await fetch('https://api.example.com/premium-data');

  // Check if payment is required
  const {payUrl, txid} = payingKit.tryGetPayUrl(response);
  if (payUrl) {
    // Payment is required, handle it with the kit
    console.log(`Please complete the payment at: ${payUrl}`);
    window.open(payUrl, '1Pay.ing') // Redirect user to sign the payment

    try {
      const payload = await payingKit.waitForPaymentPayload(txid, {
        onprogress: (state) => {
          console.log(`Payment status: ${state.status}, attempt: ${state.attempt}`);
        },
      });
      console.log('Payment successful! Received x402 PaymentPayload:', payload);

      // Now you can retry the original request with the payment payload
      // typically in an 'Authorization' or 'X-Payment' header.
      response = await fetch('https://api.example.com/premium-data', {
        headers: {
          'X-PAYMENT': payload,
        },
      });
    } catch (error) {
      console.error('Payment failed or timed out:', error);
      throw error;
    }
  }

  // Process the successful response
  const data = await response.json();
  console.log('Data received:', data);
}
```

## License

Copyright © 2025 [LDC Labs](https://github.com/ldclabs).

This project is licensed under the Apache-2.0 License. See the [LICENSE](LICENSE) file for details.