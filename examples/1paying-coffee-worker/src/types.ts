import type {
	PaymentPayload,
	PaymentRequirements,
	SettleResponse
} from '@ldclabs/1paying-kit/types'

export interface X402PaymentResult<T> {
	paymentPayload: PaymentPayload<T>
	paymentRequirements: PaymentRequirements
	settleResponse: SettleResponse
}

const JSON_HEADERS = {
	'content-type': 'application/json'
}

export interface JsonResponse {
	error?: string
	result?: string
	data?: unknown
}

export function jsonResponse<T>(
	body: T,
	status = 200,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			...JSON_HEADERS,
			...headers
		}
	})
}
