import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { MINIMUM_TOPUP_CENTS, TOPUP_INCREMENT_CENTS } from '@/lib/pricing'
import { checkApiRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuth()
    if (response) return response

    // General API: 100 requests per user per minute
    const rateLimited = checkApiRateLimit(user.id, 'create-topup')
    if (rateLimited) return rateLimited

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 422 }
      )
    }

    const input = body as { amount_cents?: number }
    const amountCents = input.amount_cents

    const ABSOLUTE_MIN_CENTS = 100 // $1 floor for test purchases
    if (
      typeof amountCents !== 'number' ||
      !Number.isInteger(amountCents) ||
      amountCents < ABSOLUTE_MIN_CENTS ||
      (amountCents < MINIMUM_TOPUP_CENTS && amountCents % 100 !== 0) ||
      (amountCents >= MINIMUM_TOPUP_CENTS && amountCents % TOPUP_INCREMENT_CENTS !== 0)
    ) {
      return NextResponse.json(
        {
          error: `Amount must be at least ${MINIMUM_TOPUP_CENTS} cents and a multiple of ${TOPUP_INCREMENT_CENTS}.`,
        },
        { status: 422 }
      )
    }

    const zapriteApiKey = process.env.ZAPRITE_API_KEY
    if (!zapriteApiKey) {
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 503 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const zapriteResponse = await fetch('https://api.zaprite.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${zapriteApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: 'USD',
        label: `Lesson Hollow Credits — $${amountCents / 100}`,
        externalUniqId: `lesson_hollow_topup_${user.id}_${Date.now()}`,
        redirectUrl: `${appUrl}/credits?status=success`,
        customerData: { email: user.email },
        metadata: {
          userId: user.id,
          type: 'topup',
          amount_cents: amountCents.toString(),
        },
        tags: ['topup'],
      }),
    })

    if (!zapriteResponse.ok) {
      const errText = await zapriteResponse.text()
      console.error('Zaprite order creation failed:', zapriteResponse.status, errText)
      return NextResponse.json(
        { error: 'Failed to create payment order' },
        { status: 502 }
      )
    }

    const order = await zapriteResponse.json()

    return NextResponse.json({ checkoutUrl: order.checkoutUrl }, { status: 201 })
  } catch (err) {
    console.error('create-topup error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
