import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '../supabase/admin'
import { createPlayersDb } from './players'
import { createCurriculaDb } from './curricula'
import { createTasksDb } from './tasks'
import { createEnrollmentsDb } from './enrollments'
import { createPlayerTasksDb } from './player-tasks'
import { createActivityDb } from './activity'
import { createRewardsDb } from './rewards'
import { createCreditsDb } from './credits'
import { createScopingDb } from './scoping'
import { createApiKeysDb } from './api-keys'
import { createDiscoveryDb } from './discovery'
import { createOAuthDb } from './oauth'
import { createEnrollmentRequestsDb } from './enrollment-requests'

function createDatabase() {
  let _client: SupabaseClient | null = null
  const getClient = () => {
    if (!_client) {
      _client = createAdminClient()
    }
    return _client
  }

  return {
    ...createPlayersDb(getClient),
    ...createCurriculaDb(getClient),
    ...createTasksDb(getClient),
    ...createEnrollmentsDb(getClient),
    ...createPlayerTasksDb(getClient),
    ...createActivityDb(getClient),
    ...createRewardsDb(getClient),
    ...createCreditsDb(getClient),
    ...createScopingDb(getClient),
    ...createApiKeysDb(getClient),
    ...createDiscoveryDb(getClient),
    ...createOAuthDb(getClient),
    ...createEnrollmentRequestsDb(getClient),
  }
}

export const db = createDatabase()
