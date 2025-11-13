import { payingKit, type SettleResponse } from '@ldclabs/1paying-kit'
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
      const header = response.headers.get('X-PAYMENT-RESPONSE')
      if (header) {
        const settleInfo: SettleResponse = JSON.parse(
          Buffer.from(header, 'base64').toString()
        )

        // Optionally submit the settle result back to 1pay.ing for better analytics
        await payingKit.submitSettleResult(txid, settleInfo).catch((err) => {
          // Ignore settle submission errors
          console.error('Settle submission error:', err)
        })
      }
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
