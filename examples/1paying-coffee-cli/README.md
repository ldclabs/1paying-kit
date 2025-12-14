# 1Pay.ing Coffee CLI Example

This directory contains a simple, self-contained command-line interface (CLI) example that demonstrates how to integrate the `1paying-kit` in a Node.js environment. The CLI application "buys a coffee" from a payment-protected API, handling the entire HTTP 402 payment flow from the terminal.

This example is designed to be the simplest possible demonstration of a complete `1paying-kit` integration.

## How It Works

The script `cli.ts` performs the following steps:

1.  **Initial Request**: It makes a `POST` request to the `/api/make-coffee` endpoint, which requires payment.
2.  **Handle 402 Response**: The server responds with `402 Payment Required`. The script uses `payingKit.tryGetPayUrl()` to parse this response and extract the unique payment URL and transaction ID.
3.  **User Payment**: It prints the payment URL to the console and prompts the user to open it in a browser to authorize the payment with their 1Pay.ing wallet.
4.  **Wait for Payload**: While the user is paying, the script uses `payingKit.waitForPaymentPayload()` to poll for the payment confirmation. It displays the payment status in real-time directly in the console.
5.  **Retry with Payment**: Once the payment is successful, the kit returns a payment payload header. The script retries the initial request, this time including the payload in the `PAYMENT-SIGNATURE` header.
6.  **Success**: The server validates the payment and returns the protected resource (a JSON object representing a coffee). The CLI then prints the final result.

## How to Run

### Prerequisites

-   [Node.js](https://nodejs.org/) (v20 or later)
-   [pnpm](https://pnpm.io/)
-   The backend service must be running.

### Steps

1.  **Install Dependencies:**
    From the repository root, run:
    ```sh
    pnpm install
    ```

2.  **Run the CLI:**
    In another terminal, execute the CLI script from the repository root:
    ```sh
    npx tsx cli.ts
    ```
    Follow the prompts in the console to complete the payment flow.

## Proxy Support

The script automatically detects and uses `http_proxy` or `https_proxy` environment variables if they are set, which is useful for development in corporate or restricted network environments.