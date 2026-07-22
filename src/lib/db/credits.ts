import type { SupabaseClient } from '@supabase/supabase-js'

export function createCreditsDb(getClient: () => SupabaseClient) {
  return {
    // --- Credit Accounts ---

    async getCreditAccount(userId: string) {
      return getClient()
        .from('credit_accounts')
        .select('*')
        .eq('user_id', userId)
        .single()
    },

    async createCreditAccount(userId: string) {
      return getClient()
        .from('credit_accounts')
        .insert({ user_id: userId })
        .select()
        .single()
    },

    // --- Credit Transactions ---

    async getCreditTransactions(userId: string, limit = 50) {
      return getClient()
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
    },

    async createCreditTransaction(data: {
      user_id: string
      type: 'deposit' | 'spend' | 'refund'
      amount_cents: number
      description: string
      enrollment_id?: string
      zaprite_order_id?: string
    }) {
      return getClient()
        .from('credit_transactions')
        .insert(data)
        .select()
        .single()
    },

    // --- Payments ---

    async getPaymentsByUser(userId: string, limit = 50) {
      return getClient()
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('paid_at', { ascending: false })
        .limit(limit)
    },

    async getPaymentByZapriteOrderId(zapriteOrderId: string) {
      return getClient()
        .from('payments')
        .select('*')
        .eq('zaprite_order_id', zapriteOrderId)
        .single()
    },

    async createPayment(data: {
      user_id: string
      zaprite_order_id: string
      amount_cents: number
      currency?: string
      payment_method?: string
      credits_added: number
      paid_at: string
      zaprite_metadata?: Record<string, unknown>
    }) {
      return getClient()
        .from('payments')
        .insert(data)
        .select()
        .single()
    },

    async spendEnrollmentCredit(userId: string, enrollmentId: string, description: string) {
      return getClient().rpc('spend_enrollment_credit', {
        p_user_id: userId,
        p_enrollment_id: enrollmentId,
        p_description: description,
      })
    },

    async enrollWithCredit(params: {
      guideUserId: string
      playerId: string
      curriculumId: string
      enrollmentType: string
      studyDaysPerWeek: number
      targetCompletionDate?: string
      targetLoops?: number
      description: string
      tasksPerStudyDay?: number
      startDate?: string
    }) {
      return getClient().rpc('enroll_with_credit', {
        p_guide_user_id: params.guideUserId,
        p_player_id: params.playerId,
        p_curriculum_id: params.curriculumId,
        p_enrollment_type: params.enrollmentType,
        p_study_days_per_week: params.studyDaysPerWeek,
        p_target_completion_date: params.targetCompletionDate ?? null,
        p_target_loops: params.targetLoops ?? null,
        p_description: params.description,
        p_tasks_per_study_day: params.tasksPerStudyDay ?? null,
        // Only sent when set, so the RPC still matches the pre-00018 signature
        // until that migration is applied
        ...(params.startDate ? { p_start_date: params.startDate } : {}),
      })
    },

    async hasDepositTransaction(userId: string) {
      return getClient()
        .from('credit_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'deposit')
    },

    async addCredits(userId: string, amountCents: number) {
      return getClient().rpc('add_credits', {
        p_user_id: userId,
        p_amount_cents: amountCents,
      })
    },
  }
}
