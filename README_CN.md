# 1Pay.ing Kit

[![npm version](https://img.shields.io/npm/v/@ldclabs/1paying-kit.svg)](https://www.npmjs.com/package/@ldclabs/1paying-kit)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English readme](./README.md) | [中文说明](./README_CN.md)

**1Pay.ing Kit** 是一个客户端 SDK，它实现了由 Coinbase 提出的 **x402** 支付规范（一个具体的 HTTP 402 实现），旨在将 Web3 支付的集成和使用体验简化到极致。

## 核心理念

x402 规范通过引入“支付服务商 (Facilitator)” 的角色，解耦了后端应用与具体的支付服务。而 **1Pay.ing** 则在此基础上解决了客户端的问题，通过提供统一的支付钱包和 SDK，充当了“客户端的 Facilitator”，从而实现了客户端应用与用户钱包的解耦。

-   **双重解耦**：后端应用无需关心支付细节，客户端应用也无需关心用户使用何种钱包。
-   **无需许可**：任何应用都可以集成，任何用户都可以支付，无需预先注册或审批。
-   **遵循 Web 标准**：基于 HTTP 402 状态码，使得集成对现有 Web 架构的侵入性降到最低。

## 工作流程

`1paying-kit` 极大地简化了处理 HTTP 402 响应的客户端逻辑。

1.  **请求资源**：您的客户端应用像往常一样请求一个受保护的 API。
2.  **收到 402 响应**：您的后端服务（资源方）根据 x402 规范 **生成支付要求**，以 `HTTP 402 Payment Required` 返给客户端。
3.  **处理支付**：`1paying-kit` 自动拦截 402 响应，生成一个 `1Pay.ing` 支付链接，客户端引导用户跳转到 `1Pay.ing` 钱包完成支付签名。
4.  **获取支付凭证**：应用通过 `1paying-kit` 捕获到支付凭证后，用支付凭证再次请求后端。
5.  **支付结算**：后端收到携带支付凭证的资源请求，先将支付凭证发送给 x402 Facilitator 并等待结算。
6.  **返回资源**：后端服务等待 Facilitator 结算后，即可返回受保护的资源给应用客户端。

## 仓库内容

这是一个 monorepo 仓库，包含以下主要部分：

-   `ts/1paying-kit`: 核心的 TypeScript SDK (`@ldclabs/1paying-kit`)。它提供了在客户端处理 HTTP 402 支付流程所需的所有工具。
-   `examples/1paying-coffee-app`: 一个使用 SvelteKit 构建的前端示例应用。它完整地展示了如何使用 `1paying-kit` 与一个需要付费的后端进行交互。
-   `examples/1paying-coffee-worker`: 一个使用 Cloudflare Worker 构建的后端示例应用。它演示了如何保护一个 API 端点，并通过与 x402 Facilitator 的交互来要求和验证支付。

## 快速开始 (运行示例项目)

最快了解 `1paying-kit` 的方式就是运行 "Buy Me a Coffee" 示例项目。

### 环境要求

-   [Node.js](https://nodejs.org/) (v20 或更高版本)
-   [pnpm](https://pnpm.io/)

### 本地开发

1.  **安装依赖:**
    在仓库根目录运行：
    ```sh
    pnpm install
    ```

2.  **启动后端 Worker:**
    打开一个新终端，为 Cloudflare Worker 启动本地开发服务。
    ```sh
    pnpm --filter 1paying-coffee-worker dev
    ```
    后端服务将在 `http://localhost:8787` 上运行。

3.  **启动前端应用:**
    在另一个终端中，为 SvelteKit 前端应用启动开发服务。
    ```sh
    pnpm --filter 1paying-coffee-app dev
    ```
    现在，您可以在浏览器中打开 `http://localhost:5173` 来体验完整的支付流程。

## 在您的项目中使用

在您自己的项目中使用 `1paying-kit` 非常简单。

### 安装

```bash
npm install @ldclabs/1paying-kit
```

### 基础用法

`1paying-kit` 可以通过 `fetch` 拦截的方式自动处理 402 流程，或者您也可以手动处理。

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

## 许可证

Copyright © 2025 [LDC Labs](https://github.com/ldclabs).

本项目基于 Apache-2.0 许可证。详情请见 [LICENSE](LICENSE) 文件。