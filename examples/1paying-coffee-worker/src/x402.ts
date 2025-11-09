import {
	type PaymentPayload,
	type PaymentRequirementsResponse,
	type SettleResponse
} from '@ldclabs/1paying-kit/types'
import { base64ToString } from '@ldclabs/1paying-kit/utils'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { jsonResponse, X402PaymentResult } from './types'

export async function settlePayment(
	ctx: Context<{
		Bindings: Env
	}>
): Promise<X402PaymentResult<unknown>> {
	const payment = ctx.req.header('X-PAYMENT')
	const paymentRequirementsResponse: PaymentRequirementsResponse =
		ctx.env.X402_PAYMENT_REQUIREMENTS
	if (!payment) {
		throw new HTTPException(402, {
			res: jsonResponse(paymentRequirementsResponse)
		})
	}

	let paymentPayload: PaymentPayload<unknown>
	try {
		paymentPayload = JSON.parse(base64ToString(payment))
		if (
			paymentPayload.x402Version !== paymentRequirementsResponse.x402Version
		) {
			throw new HTTPException(400, {
				res: jsonResponse({ error: 'Incompatible Payment Version' })
			})
		}
	} catch (e) {
		throw new HTTPException(400, {
			res: jsonResponse({ error: 'Invalid Payment Payload' })
		})
	}

	const paymentRequirements = paymentRequirementsResponse.accepts.find(
		(r) =>
			r.scheme === paymentPayload.scheme && r.network === paymentPayload.network
	)

	if (!paymentRequirements) {
		throw new HTTPException(402, {
			res: jsonResponse({ error: 'Payment Not Accepted' })
		})
	}

	const res = await fetch(`${ctx.env.X402_FACILITATOR}/settle`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			x402Version: paymentRequirementsResponse.x402Version, // old facilitator requires this
			paymentHeader: payment, // old facilitator requires this
			paymentPayload,
			paymentRequirements
		})
	})

	if (!res.ok) {
		throw new HTTPException(400, {
			res: jsonResponse({
				error: `Payment settlement failed, status: ${
					res.status
				}, error: ${await res.text()}`
			})
		})
	}

	const settleResponse: SettleResponse = await res.json()
	if (!settleResponse.success) {
		throw new HTTPException(400, {
			res: jsonResponse({
				error: `Payment settlement unsuccessful, reason: ${settleResponse.errorReason}`
			})
		})
	}

	return {
		paymentPayload,
		paymentRequirements,
		settleResponse
	}
}
