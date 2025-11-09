# 1Pay.ing Coffee Worker

This is the backend for the "Buy Me a Coffee" demo application, built with Cloudflare Workers. It demonstrates how to protect an API endpoint with x402 payments by integrating with an x402 facilitator.

## Features

-   **HTTP 402 Enforcement**: Interacts with an x402 facilitator to generate `402 Payment Required` responses and verify incoming payments from the `X-PAYMENT` header.
-   **Durable Objects**: Leverages a `CoffeeStore` Durable Object to maintain a persistent, auditable ledger for each "merchant" (the recipient of the coffee funds).
-   **SQLite Persistence**: Within the Durable Object, it uses Cloudflare's built-in SQLite storage (`ctx.storage.sql`) to store every coffee purchase record.
-   **Static Asset Serving**: Serves the `1paying-coffee-app` SvelteKit frontend from its `public` directory, making it a self-contained application.

## API Endpoints

-   `POST /api/make-coffee`: The protected endpoint.
    -   On the first request, it returns an `HTTP 402` response with payment requirements.
    -   When the request is retried with a valid `X-PAYMENT` header, it verifies the payment, records the transaction in the Durable Object, and returns a success message.
-   `GET /api/my-coffee`: Retrieves the purchase history for a given `payer` address from the Durable Object.
-   `/*`: Serves the static frontend application.

## Getting Started

This project is part of the `1paying-kit` monorepo. Ensure you are in the root directory of the monorepo to run the following commands.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v20 or later)
-   [pnpm](https://pnpm.io/)
-   A [Cloudflare account](https://dash.cloudflare.com/sign-up) with Wrangler configured.

### Development

1.  **Install dependencies:**
    ```sh
    pnpm install
    ```

2.  **Start the development server:**
    Open a terminal and run the development server for the worker. This will simulate the Cloudflare environment locally.
    ```sh
    pnpm --filter 1paying-coffee-worker dev
    ```
    The worker will be available at `http://localhost:8787`.

## Configuration and Deployment

Before deploying, you need to configure the necessary Cloudflare resources.

1.  **Update `wrangler.jsonc`:**
    Make sure the `wrangler.jsonc` file in this directory includes the correct x402 config.

    ```jsonc
    // wrangler.jsonc
    "vars": {
    	"X402_FACILITATOR": "https://www.x402.org/facilitator",
    	"X402_PAYMENT_REQUIREMENTS": {
    		"x402Version": 1,
    		"error": "Payment required",
    		"accepts": [
    				{
    					"scheme": "exact",
    					"network": "solana-devnet",
    					"maxAmountRequired": "1000000",
    					"asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    					"payTo": "FRVJU92DEkT6yQyQtyEKwUeKWPqhHeYJqsTCdxUjq8iP",
    					"resource": "https://example.1pay.ing/1paying-coffee/Cappuccino",
    					"description": "Grande Cappuccino with oat milk",
    					"mimeType": "image/png",
    					"maxTimeoutSeconds": 120,
    					"extra": {
    						"feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
    					}
    				},
    				{
    					"scheme": "exact",
    					"network": "solana",
    					"maxAmountRequired": "1000000",
    					"asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    					"payTo": "FRVJU92DEkT6yQyQtyEKwUeKWPqhHeYJqsTCdxUjq8iP",
    					"resource": "https://example.1pay.ing/1paying-coffee/Cappuccino",
    					"description": "Grande Cappuccino with oat milk",
    					"mimeType": "image/png",
    					"maxTimeoutSeconds": 120,
    					"extra": {
    						"feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
    					}
    				}
    		]
    	}
    }
    ```

2.  **Build the Frontend:**
    The worker serves the frontend app. You must build it first so the static assets are copied into the `public` directory.
    ```sh
    pnpm --filter 1paying-coffee-app build
    ```

3.  **Deploy the Worker:**
    Deploy the worker and its associated resources to Cloudflare.
    ```sh
    pnpm --filter 1paying-coffee-worker run deploy
    ```
