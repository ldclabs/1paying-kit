# 1Pay.ing Coffee App

A "Buy Me a Coffee" demo application showcasing HTTP 402 payments with the [`1paying-kit`](https://github.com/ldclabs/1paying-kit).

This project is a live demonstration of how to integrate Web3 micropayments into a web application. It simulates a "buy me a coffee" scenario where users can send a real micro-payment to the builder.

The application consists of two main parts within the monorepo:
- `1paying-coffee-app`: A SvelteKit frontend that handles the user interface and payment flow.
- `1paying-coffee-worker`: A Cloudflare Worker backend that requires x402 payments for a protected resource and records successful "purchases" in a Durable Object.

## Online Demo

[https://1paying-coffee.zensh.workers.dev/](https://1paying-coffee.zensh.workers.dev/)

## How It Works

1. The user clicks the "Pay with 1Pay.ing" button.
2. The SvelteKit app sends a request to the `/api/make-coffee` endpoint on the Cloudflare Worker.
3. The worker, using `1paying-kit`'s server-side utilities, returns an `HTTP 402 Payment Required` response.
4. The frontend `1paying-kit` intercepts this response, opens the 1Pay.ing wallet for the user to approve the transaction.
5. Upon successful payment, the kit provides a `paymentPayload`.
6. The frontend automatically retries the original request, this time including the `paymentPayload` in the `X-PAYMENT` header.
7. The worker verifies the payment, records the order in its SQLite-backed Durable Object, and returns a success message.
8. The user's coffee purchase history is then displayed on the page.

## Getting Started

This project is part of the `1paying-kit` monorepo. Ensure you are in the root directory of the monorepo to run the following commands.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/)

### Development

1.  **Install dependencies:**
    ```sh
    pnpm install
    ```

2.  **Start the backend worker:**
    Open a new terminal and run the development server for the Cloudflare Worker.
    ```sh
    pnpm --filter 1paying-coffee-worker dev
    ```

3.  **Start the frontend app:**
    In another terminal, run the development server for the SvelteKit app.
    ```sh
    pnpm --filter 1paying-coffee-app dev
    ```
    The application will be available at `http://localhost:5173`.

## Building and Deployment

To create a production version of the app and deploy it with the worker:

1.  **Build the frontend:**
    ```sh
    pnpm --filter 1paying-coffee-app build
    ```
    This command builds the SvelteKit app and automatically copies the static assets into the `1paying-coffee-worker/public` directory.

2.  **Deploy the worker:**
    ```sh
    pnpm --filter 1paying-coffee-worker run deploy
    ```
    This will publish the worker along with the frontend assets to your Cloudflare account.