import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendFeedbackNotification } from '@/lib/notifications'
import { checkApiRateLimit } from '@/lib/rate-limit'

const FEEDBACK_TYPES = ['Bug', 'Feature', 'Use Case', 'General'] as const
type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export async function POST(request: Request) {
  try {
    const { user, response } = await requireAuth()
    if (response) return response

    // Feedback: 5 submissions per user per hour
    const rateLimited = checkApiRateLimit(user.id, 'feedback', 5, 3600_000)
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

    const input = body as {
      feedback_type?: string
      title?: string
      details?: string
    }

    // Validate feedback type
    if (
      !input.feedback_type ||
      !FEEDBACK_TYPES.includes(input.feedback_type as FeedbackType)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid feedback type. Must be one of: Bug, Feature, Use Case, General.',
        },
        { status: 422 }
      )
    }

    // Validate title
    const title = input.title?.trim()
    if (!title || title.length === 0) {
      return NextResponse.json(
        { error: 'Title is required.' },
        { status: 422 }
      )
    }
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less.' },
        { status: 422 }
      )
    }

    // Validate details
    const details = input.details?.trim() || undefined
    if (details && details.length > 5000) {
      return NextResponse.json(
        { error: 'Details must be 5000 characters or less.' },
        { status: 422 }
      )
    }

    const { data, error } = await db.createFeedback({
      user_id: user.id,
      feedback_type: input.feedback_type as FeedbackType,
      title,
      details,
    })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to submit feedback.' },
        { status: 500 }
      )
    }

    // Trigger notification email asynchronously — don't block the response
    sendFeedbackNotification({
      feedbackId: data.id,
      feedbackType: input.feedback_type as FeedbackType,
      title,
      details,
      userEmail: user.email ?? undefined,
      userId: user.id,
    }).catch(() => {
      // Email failure should not affect feedback storage
    })

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
