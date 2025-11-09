import { stringToBase64 } from '@ldclabs/1paying-kit/utils'
import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { jsonResponse } from './types'
import { settlePayment } from './x402'

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */
export class CoffeeStore extends DurableObject {
	#sql: SqlStorage // SQLite instance

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.#sql = ctx.storage.sql

		// Ensure the order ledger exists before handling requests.
		this.#sql.exec(`
			CREATE TABLE IF NOT EXISTS coffee_order(
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				payer TEXT NOT NULL,
				asset TEXT NOT NULL,
				amount_required TEXT NOT NULL,
				transaction TEXT NOT NULL UNIQUE,
				network TEXT NOT NULL,
				created_at INTEGER NOT NULL DEFAULT (unixepoch()),
				updated_at INTEGER NOT NULL DEFAULT (unixepoch())
			);
			CREATE INDEX IF NOT EXISTS idx_coffee_order_payer ON coffee_order(payer);
			CREATE INDEX IF NOT EXISTS idx_coffee_order_network ON coffee_order(network);
		`)
	}

	async makeCoffee(order: CoffeeOrder): Promise<string> {
		this.#sql.exec(
			`INSERT INTO coffee_order (
				payer,
				asset,
				amount_required,
				transaction,
				network
			) VALUES (?1, ?2, ?3, ?4, ?5)
			ON CONFLICT(transaction) DO UPDATE SET
				payer = excluded.payer,
				asset = excluded.asset,
				amount_required = excluded.amount_required,
				transaction = excluded.transaction,
				network = excluded.network,
				updated_at = unixepoch()
			`,
			order.payer,
			order.asset,
			order.amountRequired,
			order.transaction,
			order.network
		)

		return `Here's your coffee, ${order.payer}!`
	}

	async getOrders(
		payer: string,
		limit = 20,
		network?: string
	): Promise<CoffeeOrderRecord[]> {
		const sanitizedLimit = Math.min(Math.max(limit, 1), 100)
		let query = `
			SELECT
				payer,
				asset,
				amount_required AS amountRequired,
				transaction,
				network,
				created_at AS createdAt,
				updated_at AS updatedAt
			FROM coffee_order
			WHERE payer = ?`
		const bindings: (string | number)[] = [payer]
		if (network) {
			query += ' AND network = ?'
			bindings.push(network)
		}
		query += ' ORDER BY created_at DESC LIMIT ?'
		bindings.push(sanitizedLimit)

		const cursor = this.#sql.exec(query, ...bindings)

		return cursor.toArray().map((row) => ({
			payer: String(row.payer),
			asset: String(row.asset),
			amountRequired: String(row.amountRequired),
			transaction: String(row.transaction),
			network: String(row.network),
			createdAt: Number(row.createdAt),
			updatedAt: Number(row.updatedAt)
		}))
	}
}

interface CoffeeOrder {
	payer: string
	asset: string
	amountRequired: string // bigint as string
	transaction: string
	network: string
}

interface CoffeeOrderRecord extends CoffeeOrder {
	createdAt: number
	updatedAt: number
}

const app = new Hono<{
	Bindings: Env
}>()

app.post('/api/make-coffee', async (ctx) => {
	const result = await settlePayment(ctx)
	const stub = ctx.env.COFFEE_STORE.getByName(result.paymentRequirements.payTo)
	const order: CoffeeOrder = {
		payer: result.settleResponse.payer,
		asset: result.paymentRequirements.asset,
		amountRequired: result.paymentRequirements.maxAmountRequired,
		transaction: result.settleResponse.transaction,
		network: result.paymentPayload.network
	}
	const coffeeMessage = await stub.makeCoffee(order)

	return jsonResponse({ result: coffeeMessage }, 200, {
		'X-PAYMENT-RESPONSE': stringToBase64(JSON.stringify(result.settleResponse))
	})
})

app.get('/api/my-coffee', async (ctx) => {
	const payTo = ctx.req.query('payTo')
	const payer = ctx.req.query('payer')
	const network = ctx.req.query('network') ?? undefined
	const limitParam = ctx.req.query('limit')

	if (!payTo || !payer) {
		return jsonResponse(
			{ error: 'Missing required query parameter payTo or payer' },
			400
		)
	}

	const limit = limitParam ? Number.parseInt(limitParam, 10) : 20
	const stub = ctx.env.COFFEE_STORE.getByName(payTo)
	const orders = await stub.getOrders(
		payer,
		Number.isFinite(limit) ? limit : 20,
		network
	)

	return jsonResponse({ data: orders })
})

export default app satisfies ExportedHandler<Env>
