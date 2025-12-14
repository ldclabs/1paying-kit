import {
	type PaymentPayload,
	type PaymentRequired,
	type SettleResponse
} from '@ldclabs/1paying-kit/types'
import { base64ToString, stringToBase64 } from '@ldclabs/1paying-kit/utils'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { jsonResponse, X402PaymentResult } from './types'

export async function settlePayment(
	ctx: Context<{
		Bindings: Env
	}>
): Promise<X402PaymentResult<unknown>> {
	const payment =
		ctx.req.header('PAYMENT-SIGNATURE') || ctx.req.header('X-PAYMENT')
	const paymentRequired: PaymentRequired = ctx.env.X402_PAYMENT_REQUIRED
	const paymentHeader = {
		'PAYMENT-REQUIRED': stringToBase64(JSON.stringify(paymentRequired))
	}
	if (!payment) {
		throw new HTTPException(402, {
			res: jsonResponse({ error: 'Payment Required' }, 402, paymentHeader)
		})
	}

	let paymentPayload: PaymentPayload<unknown>
	try {
		paymentPayload = JSON.parse(base64ToString(payment))
	} catch (e) {
		throw new HTTPException(400, {
			res: jsonResponse({ error: 'Invalid Payment Payload' }, 400)
		})
	}

	if (paymentPayload.x402Version !== paymentRequired.x402Version) {
		throw new HTTPException(400, {
			res: jsonResponse({ error: 'Incompatible Payment Version' }, 400)
		})
	}

	const has = paymentRequired.accepts.find((req) => {
		return deepEqual(req, paymentPayload.accepted)
	})
	if (!has) {
		throw new HTTPException(400, {
			res: jsonResponse({ error: 'Payment Requirements Not Accepted' }, 400)
		})
	}

	const facilitator = (ctx.env.X402_FACILITATORS as Record<string, string>)[
		paymentPayload.accepted.network
	]

	if (!facilitator) {
		throw new HTTPException(500, {
			res: jsonResponse({ error: 'No Facilitator Configured for Network' }, 500)
		})
	}

	const res = await fetch(`${facilitator}/settle`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			x402Version: paymentPayload.x402Version, // old facilitator requires this
			paymentHeader: payment, // old facilitator requires this
			paymentPayload,
			paymentRequirements: paymentPayload.accepted
		})
	})

	if (!res.ok) {
		throw new HTTPException(500, {
			res: jsonResponse(
				{
					error: `Payment settlement failed, status: ${
						res.status
					}, error: ${await res.text()}`
				},
				500
			)
		})
	}

	const settleResponse: SettleResponse = await res.json()
	if (!settleResponse.success) {
		throw new HTTPException(402, {
			res: jsonResponse(
				{
					error: `Payment settlement unsuccessful, reason: ${settleResponse.errorReason}`
				},
				402,
				paymentHeader
			)
		})
	}

	return {
		paymentPayload,
		paymentRequirements: paymentPayload.accepted,
		settleResponse
	}
}

function deepEqual(a: any, b: any): boolean {
	if (a === b) return true
	if (
		typeof a !== 'object' ||
		a === null ||
		typeof b !== 'object' ||
		b === null
	)
		return false
	const keysA = Object.keys(a)
	const keysB = Object.keys(b)
	if (keysA.length !== keysB.length) return false
	for (const key of keysA) {
		if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false
	}
	return true
}
