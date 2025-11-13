<script lang="ts">
  import {
    payingKit,
    base64ToString,
    type SettleResponse
  } from '@ldclabs/1paying-kit'

  interface CoffeeOrderRecord {
    payer: string
    asset: string
    amountRequired: string
    transaction: string
    network: string
    createdAt: number
    updatedAt: number
  }

  const COFFEE_STORE_URL = 'https://1paying-coffee.zensh.workers.dev'

  const heroHighlights = [
    'Radically simplified integration and use of Web3 payments',
    'No changes to your existing account system required',
    'Easily bring permissionless Web3 payments to any Web2 app',
    'Accept global, borderless payments from anyone, anywhere'
  ]

  let isProcessing = $state(false)
  let isFetchingHistory = $state(false)
  let paymentStatus = $state('')
  let errorMessage = $state('')
  let successMessage = $state('')
  let merchant = $state('')
  let payer = $state('')
  let ordersView: Array<
    CoffeeOrderRecord & {
      meta: { symbol: string; name: string; decimals: number }
    }
  > = $state([])
  let payWindow = $state<Window | null>(null)

  function resetState() {
    errorMessage = ''
    successMessage = ''
  }

  async function buyCoffee() {
    if (isProcessing) {
      return
    }

    resetState()
    isProcessing = true

    try {
      const res = await fetch(`${COFFEE_STORE_URL}/api/make-coffee`, {
        method: 'POST'
      })

      if (res.status !== 402) {
        const text = await res.text()
        throw new Error(
          `Expected an HTTP 402 response but received ${res.status}: ${text}`
        )
      }
      const requirements = await res.json()
      const { payUrl, txid } = payingKit.getPayUrl(requirements)

      payWindow = window.open(payUrl, '1paying-checkout')

      const paymentPayload = await payingKit.waitForPaymentPayload(txid, {
        onprogress: (state) => {
          paymentStatus = state.status
        }
      })

      const coffeeRes = await fetch(`${COFFEE_STORE_URL}/api/make-coffee`, {
        method: 'POST',
        headers: {
          'X-PAYMENT': paymentPayload
        }
      })

      if (!coffeeRes.ok) {
        throw new Error(await coffeeRes.text())
      }

      const { result }: { result: { message: string; merchant: string } } =
        await coffeeRes.json()
      successMessage = result.message || 'Enjoy your coffee!'
      merchant = result.merchant

      const header = coffeeRes.headers.get('X-PAYMENT-RESPONSE')
      if (header) {
        const settleInfo = JSON.parse(base64ToString(header)) as SettleResponse
        payer = settleInfo.payer
        await payingKit.submitSettleResult(txid, settleInfo).catch((err) => {
          // Ignore settle submission errors
          console.error('Settle submission error:', err)
        })
        await loadHistory()
      }
    } catch (error) {
      errorMessage = formatError(error)
    } finally {
      isProcessing = false
      if (payWindow && !payWindow.closed) {
        // Close the payment window if it's still open
        // We can not reuse the window for another payment due to browser security policies
        // Error: Blocked a frame with origin "https://1paying-coffee.zensh.workers.dev" from accessing a cross-origin frame.
        payWindow.close()
      }
      payWindow = null
    }
  }

  async function loadHistory() {
    if (!merchant || !payer || isFetchingHistory) {
      return
    }

    isFetchingHistory = true
    try {
      const params = new URLSearchParams({
        payTo: merchant,
        payer: payer,
        limit: '10'
      })

      const res = await fetch(
        `${COFFEE_STORE_URL}/api/my-coffee?${params.toString()}`
      )
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const { result }: { result: CoffeeOrderRecord[] } = await res.json()
      ordersView = result.map((order) => ({
        ...order,
        meta: getAssetMeta(order.asset)
      }))
    } catch (error) {
      errorMessage = formatError(error)
    } finally {
      isFetchingHistory = false
    }
  }

  function formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }

  function getAssetMeta(asset: string): {
    symbol: string
    name: string
    decimals: number
  } {
    const info: Record<
      string,
      { symbol: string; name: string; decimals: number }
    > = {
      '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': {
        symbol: 'USDC',
        name: 'USDC (Devnet)',
        decimals: 6
      },
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
        symbol: 'USDC',
        name: 'USDC',
        decimals: 6
      }
    }

    return (
      info[asset] ?? { symbol: 'Token', name: 'On-chain asset', decimals: 6 }
    )
  }

  function formatAmount(amount: string, decimals: number): string {
    const value = Number(amount) / 10 ** decimals
    if (!Number.isFinite(value)) {
      return amount
    }
    if (value < 1) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: Math.min(decimals, 6),
        maximumFractionDigits: Math.min(decimals, 6)
      })
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.min(decimals, 6)
    })
  }

  function truncate(value: string, size = 4): string {
    if (value.length <= size * 2) {
      return value
    }
    return `${value.slice(0, size)}…${value.slice(-size)}`
  }

  function formatTimestamp(epochSeconds: number): string {
    return new Date(epochSeconds * 1000).toLocaleString()
  }

  function getExplorerUrl(network: string, tx: string): string {
    if (!tx) {
      return ''
    }
    if (network === 'solana-devnet') {
      return `https://solscan.io/tx/${tx}?cluster=devnet`
    }
    if (network === 'solana') {
      return `https://solscan.io/tx/${tx}`
    }
    return ''
  }
</script>

<div class="relative min-h-screen overflow-hidden bg-stone-950 text-stone-100">
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,76,44,0.28),transparent_65%)]"
  ></div>
  <div
    class="pointer-events-none absolute -bottom-60 left-1/2 size-[620px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
  ></div>

  <div class="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-24">
    <div class="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <section class="space-y-10">
        <div class="space-y-6">
          <div class="flex items-center gap-4">
            <span
              class="inline-flex items-center rounded-full border border-amber-600/40 bg-amber-500/10 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-amber-100"
              >1Pay.ing DEMO</span
            >
            <a
              href="https://github.com/ldclabs/1paying-kit"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center rounded-full border border-amber-600/40 bg-amber-500/10 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-amber-100 hover:bg-white/10"
            >
              <span>Github</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="ml-1 size-4"
              >
                <path
                  d="M16.0037 9.41421L7.39712 18.0208L5.98291 16.6066L14.5895 8H7.00373V6H18.0037V17H16.0037V9.41421Z"
                ></path>
              </svg>
            </a>
          </div>

          <h1
            class="text-center text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Buy the builder a coffee with x402 payments.
          </h1>
          <p class="text-lg text-stone-300 sm:text-xl">
            Trigger a real HTTP 402 flow, sign it with 1Pay.ing wallet, and let
            the 1Pay.ing barista serve a fresh cup.
          </p>
        </div>

        <ul class="grid gap-3 sm:grid-cols-2">
          {#each heroHighlights as highlight}
            <li
              class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-stone-200"
            >
              <span class="mt-1 size-2 rounded-full bg-amber-500"></span>
              <span>{highlight}</span>
            </li>
          {/each}
        </ul>
      </section>

      <section class="space-y-6">
        <div
          class="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <div class="flex flex-col justify-center gap-4">
            <h2 class="text-xl font-semibold text-white"
              >Buy the builder a coffee</h2
            >
            <img
              src="/_assets/images/1paying-coffee.webp"
              alt="1Pay.ing Coffee Logo"
              class="m-auto my-4 w-xs rounded-lg"
            />

            {#if errorMessage}
              <p class="mt-2 text-sm text-red-500">
                {errorMessage}
              </p>
            {:else if successMessage}
              <p class="mt-2 text-sm text-emerald-300">
                {successMessage}
              </p>
            {:else}
              <p class="mt-2 text-sm text-stone-300">
                Send a real micro-payment to the builder. Your transaction
                history will be used as a basis for future 1Pay.ing token
                airdrops.
              </p>
            {/if}
          </div>

          <div class="mt-6 flex flex-col gap-2">
            <button
              type="button"
              class="m-auto inline-flex w-xs cursor-pointer items-center justify-center rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              onclick={buyCoffee}
              disabled={isProcessing}
            >
              {isProcessing
                ? `Waiting for payment...${paymentStatus}`
                : 'Pay with 1Pay.ing'}
            </button>
          </div>
        </div>
      </section>
    </div>

    <section
      class="mt-20 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-white">Coffee ledger</h2>
        </div>
        {#if payer && merchant}
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            onclick={loadHistory}
            disabled={isFetchingHistory}
          >
            {isFetchingHistory ? 'Refreshing...' : 'Refresh'}
          </button>
        {/if}
      </div>

      {#if isFetchingHistory}
        <p class="mt-6 text-sm text-stone-300">Fetching your latest coffees…</p>
      {:else if ordersView.length}
        <div class="mt-6 grid gap-4 md:grid-cols-2">
          {#each ordersView as order (order.transaction)}
            <article
              class="rounded-2xl border border-white/10 bg-stone-900/60 p-5"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-white">
                    {order.meta.symbol} · {order.network}
                  </p>
                  <p class="mt-1 text-xs text-stone-400"
                    >{formatTimestamp(order.createdAt)}</p
                  >
                </div>
                <p class="text-lg font-semibold text-white">
                  {formatAmount(order.amountRequired, order.meta.decimals)}
                  {order.meta.symbol}
                </p>
              </div>
              <dl class="mt-4 grid gap-3 text-xs text-stone-300">
                <div>
                  <dt
                    class="font-semibold tracking-[0.35em] text-stone-500 uppercase"
                    >Payer</dt
                  >
                  <dd class="mt-1 font-mono text-sm"
                    >{truncate(order.payer, 6)}</dd
                  >
                </div>
                <div>
                  <dt
                    class="font-semibold tracking-[0.35em] text-stone-500 uppercase"
                  >
                    Transaction
                  </dt>
                  <dd class="mt-1 font-mono text-sm">
                    {#if getExplorerUrl(order.network, order.transaction)}
                      <a
                        class="text-amber-300 hover:text-amber-200"
                        href={getExplorerUrl(order.network, order.transaction)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {truncate(order.transaction, 6)}
                      </a>
                    {:else}
                      {truncate(order.transaction, 6)}
                    {/if}
                  </dd>
                </div>
              </dl>
            </article>
          {/each}
        </div>
      {:else}
        <p class="mt-6 text-sm text-stone-300">
          Nothing here yet. Start the flow to record your first coffee.
        </p>
      {/if}
    </section>
  </div>

  <div
    class="flex flex-col items-end justify-end gap-2 p-10 text-xs text-white"
  >
    <p
      >© {new Date().getFullYear()}
      <a class="font-outfit font-bold" href="https://1pay.ing" target="_blank"
        >1Pay.ing</a
      >. All rights reserved.</p
    >
  </div>
</div>
