import { ProfileCard } from './profile-card'
import { PasswordCard } from './password-card'
import { RewardsToggleCard } from './rewards-toggle-card'
import { McpApiKeyCard } from './mcp-api-key-card'
import { ParentalConsentCard } from './parental-consent-card'
import { DeleteAccountCard } from './delete-account-card'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getAccountData() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const metadata = user.user_metadata ?? {}

    const [falKeyResult, playerCountResult] = await Promise.all([
      db.getUserApiKey(user.id, 'fal_ai'),
      db.getPlayerCountByGuide(user.id),
    ])

    return {
      email: user.email ?? '',
      firstName: (metadata.first_name as string) ?? '',
      lastName: (metadata.last_name as string) ?? '',
      timezone: (metadata.timezone as string) ?? 'America/Chicago',
      rewardsEnabled: metadata.gorilla_enabled !== false,
      tasksBetweenRewards: (metadata.video_tasks_required as number) ?? 1,
      consentDate: (metadata.parental_consent_at as string) ?? null,
      hasFalKey: !!falKeyResult.data?.encrypted_key,
      playerCount: playerCountResult.count ?? 0,
    }
  } catch {
    return null
  }
}

export default async function AccountPage() {
  const data = await getAccountData()

  const email = data?.email ?? ''
  const firstName = data?.firstName ?? ''
  const lastName = data?.lastName ?? ''
  const timezone = data?.timezone ?? 'America/Chicago'
  const rewardsEnabled = data?.rewardsEnabled ?? true
  const tasksBetweenRewards = data?.tasksBetweenRewards ?? 1
  const consentDate = data?.consentDate ?? null
  const hasFalKey = data?.hasFalKey ?? false
  const playerCount = data?.playerCount ?? 0

  return (
    <>
      <hgroup>
        <h1>Manage Account</h1>
        <p>Adjust your profile, password, or account preferences.</p>
      </hgroup>
      <div className="account-shell">
        <ProfileCard
          email={email}
          firstName={firstName}
          lastName={lastName}
          timezone={timezone}
        />
        <PasswordCard />
        <RewardsToggleCard
          initialEnabled={rewardsEnabled}
          initialTasksBetweenRewards={tasksBetweenRewards}
          hasFalKey={hasFalKey}
        />
        <McpApiKeyCard />
        {consentDate && <ParentalConsentCard consentDate={consentDate} />}
        <DeleteAccountCard playerCount={playerCount} />
      </div>
    </>
  )
}
