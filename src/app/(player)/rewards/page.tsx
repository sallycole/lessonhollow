import { redirect } from 'next/navigation'
import { getEffectiveUser } from '@/lib/masquerade'
import { db } from '@/lib/db'
import { RewardsClient } from './rewards-client'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const effectiveUser = await getEffectiveUser()
  if (!effectiveUser) redirect('/login')

  let playerId: string | null = null
  let tasksRequired = 1

  if (effectiveUser.isMasquerading && effectiveUser.playerId) {
    playerId = effectiveUser.playerId
    const { data: player } = await db.getPlayerById(playerId)
    tasksRequired = player?.video_tasks_required ?? 1
  } else {
    const { data: player } = await db.getPlayerByAuthUserId(effectiveUser.userId)
    if (player) {
      playerId = player.id
      tasksRequired = player.video_tasks_required ?? 1
    }
  }

  if (!playerId) redirect('/dashboard')

  const params = await searchParams
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [speechesResult, lastSpeechResult, taskCountsResult] = await Promise.all([
    db.getSpeechesByPlayerPaginated(playerId, currentPage, PAGE_SIZE),
    db.getLastCompletedSpeech(playerId),
    db.getTasksCompletedSince(playerId, null),
  ])

  const allSpeeches = speechesResult.data ?? []
  const totalCount = speechesResult.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const lastSpeech = lastSpeechResult.data

  let tasksCompleted = 0
  if (lastSpeech) {
    const [taskResult, spontResult] = await db.getTasksCompletedSince(
      playerId,
      lastSpeech.created_at
    )
    tasksCompleted = (taskResult.count ?? 0) + (spontResult.count ?? 0)
  } else {
    tasksCompleted = (taskCountsResult[0].count ?? 0) + (taskCountsResult[1].count ?? 0)
  }

  const hasCompletedSpeech = !!lastSpeech
  const rewardUnlocked = !hasCompletedSpeech || tasksCompleted >= tasksRequired

  const guideUserId = effectiveUser.isMasquerading
    ? effectiveUser.guideUserId!
    : (await (async () => {
        const { data: player } = await db.getPlayerById(playerId)
        return player?.guide_id ?? effectiveUser.userId
      })())

  const { data: apiKeyRow } = await db.getUserApiKey(guideUserId, 'fal_ai')
  const hasFalKey = !!apiKeyRow?.encrypted_key

  const creditGateReason: string | null = hasFalKey ? null : 'FAL_KEY_MISSING'

  return (
    <RewardsClient
      speeches={allSpeeches}
      currentPage={currentPage}
      totalPages={totalPages}
      rewardUnlocked={rewardUnlocked}
      tasksCompleted={tasksCompleted}
      tasksRequired={tasksRequired}
      creditGateReason={creditGateReason}
      isMasquerading={effectiveUser.isMasquerading}
    />
  )
}
