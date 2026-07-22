import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    console.log(`[webhook] Raw body: ${rawBody}`)

    let event: {
      eventType?: string
      orderId?: string
      orgId?: string
    }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventType = event.eventType
    console.log(`[webhook] Event type: ${eventType}, order: ${event.orderId}`)

    // Only process order changes
    if (eventType !== 'order.change' || !event.orderId) {
      console.log(`[webhook] Ignoring event type: ${eventType}`)
      return NextResponse.json({ received: true })
    }

    const zapriteOrderId = event.orderId

    // Idempotency: check if this order has already been processed
    const { data: existingPayment } = await db.getPaymentByZapriteOrderId(zapriteOrderId)
    if (existingPayment) {
      console.log(`[webhook] Order ${zapriteOrderId} already processed`)
      return NextResponse.json({ received: true, already_processed: true })
    }

    // Fetch the full order from the Zaprite API
    const zapriteApiKey = process.env.ZAPRITE_API_KEY
    if (!zapriteApiKey) {
      console.error('[webhook] ZAPRITE_API_KEY not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const verifyUrl = `https://api.zaprite.com/v1/orders/${zapriteOrderId}`
    console.log(`[webhook] Fetching order from ${verifyUrl}`)
    const orderRes = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${zapriteApiKey}` },
    })

    if (!orderRes.ok) {
      const body = await orderRes.text()
      console.error(`[webhook] Zaprite API returned ${orderRes.status} for ${zapriteOrderId}:`, body)
      return NextResponse.json({ error: 'Order fetch failed' }, { status: 500 })
    }

    const order = await orderRes.json()
    console.log(`[webhook] Order ${zapriteOrderId} status: ${order.status}`)

    // Only credit paid/complete orders
    const status = order.status?.toUpperCase()
    if (status !== 'PAID' && status !== 'OVERPAID' && status !== 'COMPLETE') {
      console.log(`[webhook] Order ${zapriteOrderId} not paid yet (${order.status}), skipping`)
      return NextResponse.json({ received: true })
    }

    // Extract metadata from the order
    const metadata = order.metadata
    if (!metadata || metadata.type !== 'topup' || !metadata.userId || !metadata.amount_cents) {
      console.warn(`[webhook] Order ${zapriteOrderId} missing required metadata:`, metadata)
      return NextResponse.json({ received: true })
    }

    const userId = metadata.userId
    const amountCents = parseInt(metadata.amount_cents, 10)

    if (isNaN(amountCents) || amountCents <= 0) {
      console.error(`[webhook] Invalid amount for order ${zapriteOrderId}:`, metadata.amount_cents)
      return NextResponse.json({ received: true })
    }

    // Log overpayment
    if (status === 'OVERPAID') {
      console.warn(`[webhook] Order ${zapriteOrderId} overpaid (total: ${order.totalAmount}). Crediting original amount: ${amountCents}`)
    }

    // Process the payment:
    // 1. Insert payment record
    // 2. Add credits to account
    // 3. Insert credit transaction

    const paymentMethod = order.transactions?.[0]?.method ?? 'unknown'

    const { error: paymentErr } = await db.createPayment({
      user_id: userId,
      zaprite_order_id: zapriteOrderId,
      amount_cents: amountCents,
      currency: 'USD',
      payment_method: paymentMethod,
      credits_added: amountCents,
      paid_at: order.paidAt ?? new Date().toISOString(),
      zaprite_metadata: status === 'OVERPAID'
        ? { overpaid: true, reported_total: order.totalAmount }
        : undefined,
    })

    if (paymentErr) {
      console.error('[webhook] Failed to insert payment:', paymentErr)
      return NextResponse.json({ error: 'Payment insert failed' }, { status: 500 })
    }

    const { error: creditErr } = await db.addCredits(userId, amountCents)
    if (creditErr) {
      console.error('[webhook] Failed to add credits:', creditErr)
      return NextResponse.json({ error: 'Credit update failed' }, { status: 500 })
    }

    const { error: txnErr } = await db.createCreditTransaction({
      user_id: userId,
      type: 'deposit',
      amount_cents: amountCents,
      description: `Credit top-up - $${(amountCents / 100).toFixed(2)}`,
      zaprite_order_id: zapriteOrderId,
    })

    if (txnErr) {
      console.error('[webhook] Failed to insert credit transaction:', txnErr)
      // Credits were already added, log but don't fail
    }

    console.log(`[webhook] Credits added: ${amountCents} cents for user ${userId} (order ${zapriteOrderId})`)
    return NextResponse.json({ received: true, credits_added: amountCents })
  } catch (err) {
    console.error('[webhook] Handler error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
