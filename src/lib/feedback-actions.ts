'use server'

import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { sendFeedbackNotification } from '@/lib/notifications'

const FEEDBACK_TYPES = ['Bug', 'Feature', 'Use Case', 'General'] as const
type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export async function submitFeedback(input: {
  feedback_type: string
  title: string
  details?: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in.' }
  }

  // Validate feedback type
  if (!FEEDBACK_TYPES.includes(input.feedback_type as FeedbackType)) {
    return { error: 'Invalid feedback type.' }
  }

  // Validate title
  const title = input.title?.trim()
  if (!title || title.length === 0) {
    return { error: 'Title is required.' }
  }
  if (title.length > 200) {
    return { error: 'Title must be 200 characters or less.' }
  }

  // Validate details
  const details = input.details?.trim() || undefined
  if (details && details.length > 5000) {
    return { error: 'Details must be 5000 characters or less.' }
  }

  const { data, error } = await db.createFeedback({
    user_id: user.id,
    feedback_type: input.feedback_type as FeedbackType,
    title,
    details,
  })

  if (error) {
    return { error: 'Failed to submit feedback. Please try again.' }
  }

  // Trigger notification email asynchronously
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

  return {}
}
