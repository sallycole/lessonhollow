import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCreditAccount } from '@/lib/credits'
import { db } from '@/lib/db'
import { ENROLLMENT_COST_CENTS } from '@/lib/pricing'
import { CreditsPageClient } from './credits-client'

export const dynamic = 'force-dynamic'

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const account = await getCreditAccount(user.id)
  const { data: transactions } = await db.getCreditTransactions(user.id, 100)
  const { data: players } = await db.getPlayersByGuide(user.id)
  const freeEnrollmentsRemaining = players?.filter((p: { free_enrollment_used: boolean }) => !p.free_enrollment_used).length ?? 0

  const params = await searchParams
  const showSuccess = params.status === 'success'

  return (
    <div className="space-y-6">
      <CreditsPageClient
        account={account}
        transactions={transactions ?? []}
        enrollmentCostCents={ENROLLMENT_COST_CENTS}
        showSuccess={showSuccess}
        freeEnrollmentsRemaining={freeEnrollmentsRemaining}
      />
    </div>
  )
}
